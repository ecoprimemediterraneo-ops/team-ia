// Webhook receiver de Instagram Messaging (Meta Graph API) para Marta.
//
// FLUJO:
//   1. Meta llama GET /api/marta/webhook con hub.verify_token → respondemos challenge si coincide.
//   2. Meta llama POST /api/marta/webhook cuando llega un DM o comentario a la cuenta IG conectada.
//   3. Para DMs: extraemos texto + sender.id, generamos respuesta con Claude Haiku
//      y la enviamos vía Graph API /{ig-user-id}/messages.
//   4. Para COMENTARIOS (entry[].changes con field "comments"): el camino entero
//      —reglas, DM y respuesta pública en el hilo— vive en
//      `lib/marta-comment-flow.ts`, y las llamadas a Graph en `lib/marta-graph.ts`.
//      Están fuera de aquí para poder dispararlos sin ir a comentar a Instagram
//      a mano (ver /api/admin/marta-probar-comentario).
//
// Vars de entorno (.env.local + Vercel):
//   INSTAGRAM_VERIFY_TOKEN   — token compartido con Meta para validar el webhook
//   INSTAGRAM_USER_ID        — IG user id (no el username) de la cuenta Business/Creator
//   INSTAGRAM_ACCESS_TOKEN   — token con scope instagram_business_manage_messages
//                              (si vacío, usamos WHATSAPP_ACCESS_TOKEN como fallback — mismo System User)
//   ANTHROPIC_API_KEY        — para generar respuesta con Claude
//
// Doc Meta: https://developers.facebook.com/docs/messenger-platform/instagram/webhook

import { NextResponse } from "next/server";
import { comprobarFirmaMeta } from "@/lib/meta-firma";
import { anthropic, MODELS } from "@/lib/claude";
import { martaPrompt } from "@/lib/marta-prompt";
import {
  appendTurn,
  getConversation,
  type Conversation,
} from "@/lib/conversation-store";
import { logEvent, makeEventId } from "@/lib/event-log";
import { resolveTenantFromMeta } from "@/lib/tenants";
import { procesarComentario } from "@/lib/marta-comment-flow";
import { apuntarMensaje } from "@/lib/marta-inbox";
import { sendInstagramDM, usernameDeIgsid } from "@/lib/marta-graph";
import { kvTryLock } from "@/lib/supabase";
import { idiomaDeTexto, type Idioma } from "@/lib/idioma";

async function safeLogEvent(...args: Parameters<typeof logEvent>): Promise<void> {
  try {
    await logEvent(...args);
  } catch (err) {
    console.error("[marta/webhook] event log error:", err);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// GET — handshake con Meta
// -----------------------------------------------------------------------------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.INSTAGRAM_VERIFY_TOKEN;

  if (mode === "subscribe" && token && expected && token === expected) {
    console.log("[marta/webhook] GET handshake OK");
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[marta/webhook] GET handshake FAILED", {
    mode,
    tokenMatch: token === expected,
    hasExpected: Boolean(expected),
  });
  return new Response("Forbidden", { status: 403 });
}

// -----------------------------------------------------------------------------
// POST — recepción de eventos Instagram
// -----------------------------------------------------------------------------
type IGMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
  };
};

type IGCommentChange = {
  field?: string;
  value?: {
    id?: string; // comment id
    text?: string;
    from?: { id?: string; username?: string };
    media?: { id?: string };
  };
};

type WebhookPayload = {
  object?: string; // "instagram"
  entry?: Array<{
    id?: string;
    time?: number;
    messaging?: IGMessagingEvent[];
    changes?: IGCommentChange[];
  }>;
};

/**
 * ¿Este DM ya se ha procesado? Descarta la segunda copia del mismo mensaje.
 *
 * POR QUÉ HACE FALTA
 * ------------------
 * La cuenta está conectada a la app por DOS productos a la vez —inicio de sesión
 * con Facebook e inicio de sesión con Instagram— y los dos entregan cada DM al
 * mismo callback. Se veía en los logs de producción: dos POST con el mismo `mid`
 * en el mismo milisegundo, uno con la firma de la app de Meta y otro con la de
 * la app de Instagram. Marta contestaba DOS veces, con dos textos distintos,
 * porque cada copia pedía su propia respuesta a la IA.
 *
 * Aunque se desconecte una de las dos vías, cualquier reentrega de Meta produce
 * lo mismo, así que el descarte vive aquí y no depende de la configuración.
 *
 * POR QUÉ UN LOCK Y NO "LEER Y ESCRIBIR"
 * --------------------------------------
 * Las dos copias llegan a la vez, en dos invocaciones distintas. Leer "¿lo he
 * visto?" y luego apuntarlo deja una ventana en la que las dos leen "no". El
 * `kvTryLock` de Supabase hace un INSERT sobre la clave primaria: solo uno de
 * los dos puede ganarlo. Se guarda 72 h, la misma ventana que el descarte de
 * comentarios duplicados.
 *
 * Sin Supabase (local) el lock siempre concede, así que en local se descarta
 * con un registro en memoria: vale para un único proceso, que es lo que hay.
 */
/** Los textos van recortados al registro: el bucket de eventos es una clave por mes. */
const recorteLog = (t: string | undefined, max = 300): string | undefined =>
  t === undefined ? undefined : t.length > max ? `${t.slice(0, max)}…` : t;

const MID_TTL_MS = 72 * 60 * 60 * 1000;
const midsVistosLocal = new Map<string, number>();

async function dmYaProcesado(mid: string | undefined): Promise<boolean> {
  // Sin `mid` no hay forma de reconocer la copia: se procesa, como antes.
  if (!mid) return false;
  const ahora = Date.now();
  for (const [k, t] of midsVistosLocal) if (ahora - t > MID_TTL_MS) midsVistosLocal.delete(k);
  if (midsVistosLocal.has(mid)) return true;
  midsVistosLocal.set(mid, ahora);
  try {
    const concedido = await kvTryLock(`marta-dm-mid:${mid}`, MID_TTL_MS, "marta-webhook");
    return !concedido;
  } catch (err) {
    // Si el almacén falla, se prefiere contestar dos veces a no contestar nunca.
    console.error("[marta/webhook] no se ha podido comprobar el duplicado del DM:", err);
    return false;
  }
}

export async function POST(req: Request) {
  // El cuerpo se lee CRUDO porque la firma de Meta es el HMAC de estos bytes
  // exactos: parsear y volver a serializar cambia espacios y orden, y entonces
  // no cuadra nunca.
  const crudo = await req.text();
  const firma = comprobarFirmaMeta(crudo, req.headers.get("x-hub-signature-256"));
  if (!firma.ok) {
    console.warn("[marta/webhook] POST rechazado:", firma.motivo);
    return NextResponse.json({ ok: false, error: "firma" }, { status: 401 });
  }
  if (!firma.comprobada) {
    console.warn(`[marta/webhook] FIRMA SIN COMPROBAR: ${firma.motivo}`);
  }

  let body: WebhookPayload;
  try {
    body = JSON.parse(crudo) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  console.log("[marta/webhook] POST payload:", JSON.stringify(body).slice(0, 1500));

  try {
    const entries = body.entry ?? [];
    for (const entry of entries) {
      // Resolver tenant a partir del id del entry (IG user id de la cuenta receptora).
      const tenantId = await resolveTenantFromMeta({ instagramUserId: entry.id });

      // NI MENSAJES NI CAMBIOS: se dice. Un `entry` con otra forma —Meta ha
      // cambiado algo, o llega un tipo de evento que aquí no se espera— salía
      // del bucle sin una sola línea y el evento se perdía sin rastro.
      if (!entry.messaging?.length && !entry.changes?.length) {
        console.warn(
          `[marta/webhook] DESCARTADO: entry sin messaging ni changes ` +
            `(tenant=${tenantId} id=${entry.id} claves=${Object.keys(entry).join(",")})`,
        );
      }

      // --- DMs ---
      const messaging = entry.messaging ?? [];
      for (const ev of messaging) {
        if (ev.message?.is_echo === true) {
          console.log("[marta/webhook] eco propio ignorado");
          continue;
        }
        const senderId = ev.sender?.id;
        const text = ev.message?.text;
        if (!senderId || !text) {
          console.log("[marta/webhook] evento sin sender/text ignorado");
          continue;
        }

        const rxTs = new Date().toISOString();
        const mid = ev.message?.mid;

        // ANTES de pedir respuesta a la IA: si esta es la segunda copia del mismo
        // mensaje, se descarta aquí y no se contesta dos veces.
        if (await dmYaProcesado(mid)) {
          console.log(`[marta/webhook] DM DUPLICADO descartado mid=${(mid ?? "").slice(0, 24)}… from=${senderId}`);
          continue;
        }

        console.log(`[marta/webhook] DM RX tenant=${tenantId} from=${senderId} idioma=${idiomaDeTexto(text)} text="${text}"`);

        // Memoria: si no hay turnos (o estaba stale → ya limpiado on-read),
        // se trata como primer mensaje.
        const conv = await getConversation("marta", senderId);
        const isNew = !conv || conv.turns.length === 0;

        // Marta contesta en el idioma en que le escriben. Ante la duda, castellano,
        // que es lo de siempre.
        const idiomaCliente = idiomaDeTexto(text);
        const reply = await generateReply(text, isNew, conv, idiomaCliente);
        console.log(`[marta/webhook] AI reply: "${reply}"`);

        const sendResult = await sendInstagramDM(senderId, reply);
        // Enviado SOLO si Meta lo aceptó. Además de `error`, cuentan como no
        // enviado `skipped` (falta configuración, p. ej. FACEBOOK_PAGE_ID) y
        // `simulado` (local sin Graph): mirar solo `error` pintaba "Enviado" en la
        // tabla para un mensaje que no había salido.
        const dmOk = !(
          sendResult &&
          typeof sendResult === "object" &&
          ("error" in sendResult || "skipped" in sendResult || "simulado" in sendResult)
        );

        // El @usuario. El payload del DM solo trae el IGSID —un número que no le
        // dice nada a nadie en una tabla—, así que se le pregunta a Meta una vez y
        // se recuerda. Si falla, la fila sale con el IGSID: no se inventa un nombre.
        const username = await usernameDeIgsid(senderId).catch(() => undefined);

        // Persistir tras el envío. El payload de IG no trae nombre legible
        // (solo IGSID), así que `name` queda sin actualizar.
        await appendTurn("marta", senderId, "user", text);
        await appendTurn("marta", senderId, "assistant", reply);

        // Y en la BANDEJA, que es otra cosa: `appendTurn` alimenta la memoria de
        // la IA —se recorta, caduca a las 24 h y no se puede listar— y esto es
        // el historial que ve el cliente en pantalla. `apuntarMensaje` nunca
        // lanza: un fallo aquí no puede tumbar el webhook, porque Meta lo
        // reintentaría y el DM saldría dos veces.
        await apuntarMensaje(tenantId, senderId, { de: "cliente", texto: text, ts: rxTs, id: mid }, username);
        await apuntarMensaje(tenantId, senderId, {
          de: "nosotros",
          texto: reply,
          ts: new Date().toISOString(),
          via: "automatico",
        });

        // LOS DM EN "ACTIVIDAD RECIENTE".
        //
        // Estos dos eventos ya se escribían, pero SIN `kind` y sin textos: solo el
        // remitente y la latencia. Servían para el informe mensual, que solo
        // cuenta, y el historial del panel —que filtra por `kind`— los dejaba
        // fuera siempre. Por eso Marta contestaba un DM y en la tabla no salía
        // nada. Se les pone tipo, @usuario, lo recibido, lo enviado y si Meta lo
        // aceptó; los ids no cambian, así que el informe mensual sigue igual.
        await safeLogEvent(tenantId, {
          id: makeEventId("message_in", "marta", mid),
          ts: rxTs,
          type: "message_in",
          channel: "marta",
          senderId,
          meta: { kind: "dm_in", mid, username, texto: recorteLog(text) },
        });
        await safeLogEvent(tenantId, {
          id: makeEventId("message_out", "marta", mid),
          type: "message_out",
          channel: "marta",
          senderId,
          meta: {
            kind: "dm_out",
            mid,
            username,
            texto: recorteLog(reply),
            ok: dmOk,
            error: dmOk ? undefined : JSON.stringify(sendResult).slice(0, 300),
            latencyMs: Date.now() - Date.parse(rxTs),
          },
        });
        console.log(
          `[marta/webhook] TX result:`,
          JSON.stringify(sendResult).slice(0, 500),
        );
      }

      // --- Comentarios → DM (función estrella ManyChat) ---
      const changes = entry.changes ?? [];
      for (const change of changes) {
        if (change.field !== "comments") {
          // Con las claves del valor: "no soportado" a secas no dice si es un
          // `mentions`, un `story_insights` o un comentario con otro nombre.
          console.log(
            `[marta/webhook] DESCARTADO change field no soportado: ${change.field} ` +
              `(claves del valor: ${Object.keys(change.value ?? {}).join(",") || "ninguna"})`,
          );
          continue;
        }
        console.log(
          `[marta/webhook] COMMENT RX tenant=${tenantId} entry=${entry.id} ` +
            `comment=${change.value?.id ?? "?"} from=${change.value?.from?.username ?? change.value?.from?.id ?? "?"} ` +
            `media=${change.value?.media?.id ?? "?"}`,
        );
        const v = change.value ?? {};
        const res = await procesarComentario(tenantId, entry.id, {
          commentId: v.id ?? "",
          text: v.text ?? "",
          fromId: v.from?.id,
          username: v.from?.username,
          mediaId: v.media?.id,
        });
        console.log(`[marta/webhook] COMMENT resultado: ${res.detalle}`);
      }
    }
  } catch (err) {
    console.error("[marta/webhook] error procesando POST:", err);
    // 200 igualmente para que Meta no reintente.
  }

  return NextResponse.json({ ok: true });
}


// -----------------------------------------------------------------------------
// Generar respuesta con Claude
// -----------------------------------------------------------------------------
/**
 * Lo que se le añade al prompt cuando el cliente escribe en inglés.
 *
 * El prompt de Marta está en castellano y le pide responder en castellano, así
 * que a un "How much does it cost?" le contestaba en español. En castellano no
 * se añade NADA: la llamada es exactamente la de siempre.
 */
const INSTRUCCION_INGLES =
  "\n\nIDIOMA DE ESTA RESPUESTA: el cliente te ha escrito en INGLÉS. Responde en inglés natural " +
  "y breve, aunque el resto de estas instrucciones y el historial estén en castellano. Mantén todo " +
  "lo demás igual: los mismos precios, planes, enlaces y reglas de formato (sin markdown, lo " +
  "importante en MAYÚSCULAS). Los nombres propios de los planes no se traducen.";

/** Lo que se contesta si no hay IA o falla, en el idioma del cliente. */
const RESPALDO = {
  sinIA: { es: "¡Hola! Hemos recibido tu mensaje, te respondemos en breve.", en: "Hi! We've got your message and we'll reply shortly." },
  vacio: { es: "¡Hola! Hemos recibido tu mensaje, te respondemos en breve.", en: "Hi! We've got your message and we'll reply shortly." },
  error: { es: "¡Hola! Hemos recibido tu mensaje, te respondemos en cuanto podamos.", en: "Hi! We've got your message and we'll get back to you as soon as we can." },
} as const;

async function generateReply(
  message: string,
  firstMessage: boolean,
  conv: Conversation | null,
  idioma: Idioma = "es",
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return RESPALDO.sinIA[idioma];
  }

  const history = (conv?.turns ?? []).map((t) => ({
    role: t.role,
    content: t.text,
  }));

  const currentUserContent =
    `${firstMessage ? "[PRIMER MENSAJE]" : "[CONVERSACIÓN YA INICIADA]"}\nMensaje recibido:\n"${message}"`;

  try {
    const ai = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 400,
      system: idioma === "en" ? martaPrompt + INSTRUCCION_INGLES : martaPrompt,
      messages: [
        ...history,
        { role: "user", content: currentUserContent },
      ],
    });

    const text = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();
    return text || RESPALDO.vacio[idioma];
  } catch (err) {
    console.error("[marta/webhook] error generando respuesta IA:", err);
    return RESPALDO.error[idioma];
  }
}
