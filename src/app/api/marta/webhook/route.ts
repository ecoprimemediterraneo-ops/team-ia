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
import { sendInstagramDM } from "@/lib/marta-graph";

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

        console.log(`[marta/webhook] DM RX from=${senderId} text="${text}"`);

        // Memoria: si no hay turnos (o estaba stale → ya limpiado on-read),
        // se trata como primer mensaje.
        const conv = await getConversation("marta", senderId);
        const isNew = !conv || conv.turns.length === 0;

        const reply = await generateReply(text, isNew, conv);
        console.log(`[marta/webhook] AI reply: "${reply}"`);

        const sendResult = await sendInstagramDM(senderId, reply);

        // Persistir tras el envío. El payload de IG no trae nombre legible
        // (solo IGSID), así que `name` queda sin actualizar.
        await appendTurn("marta", senderId, "user", text);
        await appendTurn("marta", senderId, "assistant", reply);

        await safeLogEvent(tenantId, {
          id: makeEventId("message_in", "marta", mid),
          ts: rxTs,
          type: "message_in",
          channel: "marta",
          senderId,
        });
        await safeLogEvent(tenantId, {
          id: makeEventId("message_out", "marta", mid),
          type: "message_out",
          channel: "marta",
          senderId,
          meta: { latencyMs: Date.now() - Date.parse(rxTs) },
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
          console.log(`[marta/webhook] change field no soportado: ${change.field}`);
          continue;
        }
        console.log(`[marta/webhook] COMMENT RX tenant=${tenantId} entry=${entry.id}`);
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
async function generateReply(
  message: string,
  firstMessage: boolean,
  conv: Conversation | null,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "¡Hola! Hemos recibido tu mensaje, te respondemos en breve.";
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
      system: martaPrompt,
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
    return text || "¡Hola! Hemos recibido tu mensaje, te respondemos en breve.";
  } catch (err) {
    console.error("[marta/webhook] error generando respuesta IA:", err);
    return "¡Hola! Hemos recibido tu mensaje, te respondemos en cuanto podamos.";
  }
}
