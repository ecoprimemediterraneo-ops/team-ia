// Webhook receiver de WhatsApp Business (Meta Graph API) para Pablo.
//
// FLUJO:
//   1. Meta llama GET /api/pablo/webhook con hub.verify_token → respondemos challenge si coincide.
//   2. Meta llama POST /api/pablo/webhook cuando llega un mensaje al número WhatsApp Business.
//   3. Extraemos texto + número del remitente, generamos respuesta con Claude Haiku,
//      y la enviamos de vuelta vía Graph API /messages.
//
// Vars de entorno necesarias (.env.local + Vercel):
//   WEBHOOK_VERIFY_TOKEN       — token compartido con Meta para validar el webhook
//   WHATSAPP_PHONE_NUMBER_ID   — ID del número emisor (no el número en sí)
//   WHATSAPP_ACCESS_TOKEN      — long-lived token con scope whatsapp_business_messaging
//   ANTHROPIC_API_KEY          — para generar la respuesta con Claude
//
// Doc Meta: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks

import { NextResponse } from "next/server";
import { anthropic, MODELS } from "@/lib/claude";
import { PABLO_SYSTEM } from "@/lib/pablo-prompt";
import {
  appendTurn,
  getConversation,
  type Conversation,
} from "@/lib/conversation-store";
import { logEvent, makeEventId, getMonthEvents, monthKey } from "@/lib/event-log";
import { resolveTenantFromMeta, getTenantSector } from "@/lib/tenants";
import { getFicha, fichaToPromptContext } from "@/lib/ficha";
import { buildSectorSystem, getSectorPrompt } from "@/lib/sector-prompts";
import {
  findPendingProposalByWhatsapp,
  markProposalPublished,
  markProposalRejected,
  recordClientReply,
} from "@/lib/marta-proposals";
import { publishToInstagram } from "@/lib/marta-publish";
import { classifyClientReply } from "@/lib/marta-intent";
import { getRoute, openRoute, closeRoute } from "@/lib/wa-route";
import { regenerateProposal, MAX_REGEN } from "@/lib/marta-regen";
import { sendWhatsAppImage, sendWhatsAppVideo } from "@/lib/whatsapp-sender";
import { kvTryLock, supabaseEnabled } from "@/lib/supabase";
import {
  tryAgendarFromText,
  detectAppointmentIntent,
  missingFieldsToQuestion,
  formatStartHumanES,
} from "@/lib/appointment-intent";
import {
  findEntryByProposalId,
  markCalendarEntryPublished,
  markCalendarEntryRejected,
} from "@/lib/marta-calendar";
import {
  findPendingRocioByWhatsapp,
  markRocioPublished,
  markRocioRejected,
  recordRocioClientReply,
} from "@/lib/rocio-proposals";
import { replyToReview } from "@/lib/google-business";

// Logging de eventos del informe mensual. Silencioso ante fallos para no
// romper el flujo principal del webhook.
async function safeLogEvent(...args: Parameters<typeof logEvent>): Promise<void> {
  try {
    await logEvent(...args);
  } catch (err) {
    console.error("[pablo/webhook] event log error:", err);
  }
}

// Idempotencia por id de mensaje de Meta. WhatsApp Cloud API REINTENTA la
// entrega si el webhook no responde 200 rápido — y la regeneración de Marta
// tarda (Haiku + gpt-image-1). Sin esto, cada reintento del MISMO mensaje
// reejecutaba la regeneración → 3 propuestas encadenadas. Reclamamos el msg.id
// UNA sola vez (lock atómico en Supabase; Set en memoria en local): los
// reintentos posteriores se ignoran.
const seenLocal = new Set<string>();
async function claimMessageOnce(msgId: string): Promise<boolean> {
  if (!msgId) return true; // sin id no podemos deduplicar; procesamos
  if (supabaseEnabled()) {
    // kvTryLock inserta atómicamente; si ya existe y está fresco → false.
    return await kvTryLock(`wa-msg:${msgId}`, 10 * 60 * 1000, "pablo");
  }
  if (seenLocal.has(msgId)) return false;
  seenLocal.add(msgId);
  if (seenLocal.size > 2000) seenLocal.clear();
  return true;
}

// Idempotencia: ¿ya hay una cita registrada para este teléfono a esa hora?
// Evita que, al detectar la cita sobre el transcript completo, se vuelva a
// reservar el mismo hueco en cada mensaje posterior del cliente.
async function alreadyBookedForPhone(
  tenantId: string,
  phone: string,
  startIso: string,
): Promise<boolean> {
  try {
    const months = new Set([monthKey(startIso), monthKey(new Date().toISOString())]);
    const evs = (
      await Promise.all([...months].map((m) => getMonthEvents(tenantId, m)))
    ).flat();
    return evs.some((e) => {
      if (e.type !== "appointment_set") return false;
      const m = (e.meta ?? {}) as Record<string, unknown>;
      return m.customerPhone === phone && (m.fechaIso === startIso || m.horaIso === startIso);
    });
  } catch {
    return false;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH_VERSION = "v21.0";

// -----------------------------------------------------------------------------
// GET — verificación inicial del webhook (handshake con Meta)
// -----------------------------------------------------------------------------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token && expected && token === expected) {
    console.log("[pablo/webhook] GET handshake OK");
    // Meta exige devolver el challenge como text/plain
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[pablo/webhook] GET handshake FAILED", {
    mode,
    tokenMatch: token === expected,
    hasExpected: Boolean(expected),
  });
  return new Response("Forbidden", { status: 403 });
}

// -----------------------------------------------------------------------------
// POST — recepción de mensajes
// -----------------------------------------------------------------------------
type IncomingMsg = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  // Otros tipos (image, audio, etc.) los ignoramos por ahora
};

type WebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: IncomingMsg[];
        statuses?: Array<{ id: string; status: string; recipient_id: string }>;
      };
      field?: string;
    }>;
  }>;
};

export async function POST(req: Request) {
  let body: WebhookPayload;
  try {
    body = (await req.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  console.log("[pablo/webhook] POST payload:", JSON.stringify(body).slice(0, 1500));

  // Meta espera 200 rápido. Procesamos best-effort y respondemos al final.
  try {
    const entries = body.entry ?? [];
    for (const entry of entries) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // Estados (delivered, read, sent) — solo loggear
        if (value.statuses?.length) {
          for (const s of value.statuses) {
            console.log(
              `[pablo/webhook] status ${s.status} msg=${s.id} to=${s.recipient_id}`,
            );
          }
          continue;
        }

        // Resolver tenant a partir del phone_number_id del receptor (nuestro número).
        const phoneNumberId = value.metadata?.phone_number_id;
        const tenantId = await resolveTenantFromMeta({ whatsappPhoneNumberId: phoneNumberId });

        const messages = value.messages ?? [];
        const contacts = value.contacts ?? [];
        for (const msg of messages) {
          // Solo texto por ahora
          if (msg.type !== "text" || !msg.text?.body) {
            console.log(`[pablo/webhook] mensaje no-texto ignorado: ${msg.type}`);
            continue;
          }

          // Idempotencia: procesa cada mensaje UNA sola vez. Los reintentos de
          // Meta (cuando la regeneración tarda) se ignoran aquí → no se encadenan
          // varias generaciones para el mismo mensaje.
          if (!(await claimMessageOnce(msg.id))) {
            console.log(`[pablo/webhook] mensaje duplicado (reintento de Meta) ignorado: ${msg.id}`);
            continue;
          }

          const from = msg.from; // número del cliente (sin '+')
          const text = msg.text.body;
          const customerName = contacts.find((c) => c.wa_id === from)?.profile?.name;

          // Ts de recepción para medir latencia de respuesta del agente.
          const rxTs = new Date().toISOString();

          console.log(
            `[pablo/webhook] RX from=${from} name=${customerName ?? "?"} text="${text}"`,
          );

          // === SESIÓN DE RUTEO ===
          // Si este número está en mitad de un flujo con un agente, sus
          // respuestas SIGUIENTES van a ESE agente hasta que el flujo termine
          // (aunque el clasificador falle o la propuesta deje de estar pending).
          const route = await getRoute(from);
          const forceMarta = route?.agent === "marta";

          // === INTERCEPTOR: ¿propuesta de Rocío pendiente (respuesta a reseña)? ===
          // Antes que Marta para no mezclar. Aprobación → publica en Google.
          // Se salta si hay una sesión activa de Marta para este número.
          if (!forceMarta) try {
            const rocioP = await findPendingRocioByWhatsapp(from);
            if (rocioP) {
              const cls = await classifyClientReply(text);
              await recordRocioClientReply(rocioP, text, cls.intent);
              console.log(`[pablo/webhook] Rocio proposal id=${rocioP.id} intent=${cls.intent}`);
              if (cls.intent === "ok") {
                // El usuario que pertenezca al tenant es el receptor —
                // simplificación: usamos el email del fundador para los
                // tokens GBP. En multi-tenant: mapear tenantId→userEmail.
                const founder = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
                const redirectUri = `https://aiteam.marketing/api/rocio/callback`;
                const r = await replyToReview(founder, redirectUri, rocioP.reviewName, rocioP.draftReply);
                if (r.ok) {
                  await markRocioPublished(rocioP);
                  await safeLogEvent(rocioP.tenantId, {
                    id: makeEventId("review_replied", "rocio", rocioP.reviewName),
                    type: "review_replied",
                    channel: "rocio",
                    meta: { rating: rocioP.rating },
                  });
                  await sendWhatsAppText(from, "¡Publicado en Google! ⭐ La respuesta ya está visible.");
                } else {
                  console.error(`[pablo/webhook] Rocio reply falló: ${r.reason} ${r.detail}`);
                  await sendWhatsAppText(from, "Recibí tu OK, pero Google me ha rechazado la respuesta. Lo revisamos y volvemos a intentarlo.");
                }
              } else if (cls.intent === "rechazar") {
                await markRocioRejected(rocioP);
                await sendWhatsAppText(from, "Sin problema, descartado 👌");
              } else {
                await sendWhatsAppText(from, "Vale, ¿cómo quieres que reformule la respuesta a la reseña?");
              }
              continue;
            }
          } catch (err) {
            console.error("[pablo/webhook] error en interceptor de Rocío:", err);
          }

          // === INTERCEPTOR: ¿propuesta de Marta pendiente para este número? ===
          // Si hay propuesta pendiente, este mensaje NO va a Claude/Pablo.
          // Clasificamos con Haiku la intención y respondemos según las 4 categorías:
          //   ok               → publicar
          //   cambiar_foto     → "¿Qué cambio quieres en la imagen?"
          //   cambiar_caption  → "¿Qué quieres ajustar del texto?"
          //   rechazar         → cancelar propuesta, "OK, descartado"
          //   feedback_general → "Vale, lo ajusto. Cuéntame qué cambias."
          try {
            const proposal = await findPendingProposalByWhatsapp(from);
            if (!proposal && forceMarta) {
              // Sesión de Marta activa pero sin propuesta pendiente: el flujo ya
              // terminó. Limpiamos y dejamos pasar al flujo normal de Pablo.
              await closeRoute(from);
            }
            if (proposal) {
              const cls = await classifyClientReply(text);
              await recordClientReply(proposal, text, cls.intent);
              console.log(
                `[pablo/webhook] Marta proposal id=${proposal.id} intent=${cls.intent} foto=${cls.changeFoto} caption=${cls.changeCaption} (conf=${cls.confidence.toFixed(2)}, src=${cls.source})`,
              );
              const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://aiteam.marketing";

              if (cls.intent === "ok") {
                const pub = await publishToInstagram({
                  mediaType: proposal.mediaType,
                  mediaUrl: proposal.imageUrl,
                  caption: proposal.caption,
                });
                if ("ok" in pub && pub.ok) {
                  let permalink: string | undefined;
                  try {
                    const tk = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
                    if (tk) {
                      const r = await fetch(
                        `https://graph.facebook.com/v21.0/${pub.igMediaId}?fields=permalink`,
                        { headers: { Authorization: `Bearer ${tk}` } },
                      );
                      if (r.ok) {
                        const j = (await r.json()) as { permalink?: string };
                        permalink = j.permalink;
                      }
                    }
                  } catch { /* noop */ }
                  await markProposalPublished(proposal, pub.igMediaId, permalink);
                  // Si esta propuesta venía de un entry del calendario, márcalo.
                  try {
                    const calEntry = await findEntryByProposalId(proposal.tenantId, proposal.id);
                    if (calEntry) await markCalendarEntryPublished(proposal.tenantId, calEntry.id, pub.igMediaId);
                  } catch { /* noop */ }
                  const ack = permalink
                    ? `¡Publicado! 🎉\n\nVer post: ${permalink}`
                    : `¡Publicado! 🎉`;
                  await sendWhatsAppText(from, ack);
                  await closeRoute(from); // flujo terminado
                } else if ("skipped" in pub && pub.skipped) {
                  await sendWhatsAppText(
                    from,
                    "Recibí tu OK, pero la publicación está desactivada ahora mismo. Te aviso en cuanto se reactive.",
                  );
                } else {
                  const reason = "detail" in pub ? pub.detail : "error desconocido";
                  console.error(`[pablo/webhook] publish falló: ${reason}`);
                  await sendWhatsAppText(
                    from,
                    "Recibí tu OK, pero Instagram me ha rechazado la publicación. Lo revisamos y volvemos a intentarlo.",
                  );
                }
              } else if (cls.intent === "rechazar") {
                await markProposalRejected(proposal);
                // Propaga al calendario si la propuesta venía de allí.
                try {
                  const calEntry = await findEntryByProposalId(proposal.tenantId, proposal.id);
                  if (calEntry) await markCalendarEntryRejected(proposal.tenantId, calEntry.id);
                } catch { /* noop */ }
                await closeRoute(from); // flujo terminado
                await sendWhatsAppText(
                  from,
                  "Sin problema, descartado 👌 Cuando quieras otra propuesta me dices.",
                );
              } else if (!(cls.changeFoto ?? false) && !(cls.changeCaption ?? false)) {
                // feedback_general SIN cambio concreto → pedir aclaración (no
                // regenerar a ciegas). La sesión sigue activa con Marta.
                await sendWhatsAppText(
                  from,
                  "Vale 👍 Dime exactamente qué cambio: la foto, el texto, o ambos — y qué quieres distinto.",
                );
                await openRoute(from, "marta", proposal.id);
              } else {
                // === CAMBIOS: regenerar DE VERDAD (foto y/o texto) ===
                const changeFoto = cls.changeFoto ?? (cls.intent === "cambiar_foto");
                const changeCaption = cls.changeCaption ?? (cls.intent === "cambiar_caption");
                await sendWhatsAppText(from, "Vale, lo rehago con esos cambios… dame un momento 🎨");
                const regen = await regenerateProposal({
                  proposal,
                  changeFoto,
                  changeCaption,
                  feedback: text,
                  baseUrl: SITE,
                });
                if (regen.kind === "ok") {
                  const isVid = proposal.mediaType === "REELS" || proposal.mediaType === "STORIES_VIDEO";
                  if (isVid) await sendWhatsAppVideo(from, regen.imageUrl, regen.caption);
                  else await sendWhatsAppImage(from, regen.imageUrl, regen.caption);
                  const partes = [regen.changedFoto ? "imagen" : null, regen.changedCaption ? "texto" : null]
                    .filter(Boolean)
                    .join(" y ");
                  await sendWhatsAppText(
                    from,
                    `Aquí tienes la nueva versión${partes ? ` (${partes})` : ""}. ¿La publico? Responde OK o dime qué más cambio.`,
                  );
                  await openRoute(from, "marta", regen.proposal.id); // sigue el flujo
                } else if (regen.kind === "limit") {
                  await sendWhatsAppText(
                    from,
                    `Llevamos ${MAX_REGEN} versiones 😅 Para no marear, dime "ok" para publicar la última o te llamo y lo cerramos juntos.`,
                  );
                  await openRoute(from, "marta", proposal.id);
                } else if (regen.kind === "needs_video") {
                  await sendWhatsAppText(
                    from,
                    "Para cambiar el vídeo, pásame el MP4 nuevo (vertical 9:16) y lo preparo. El texto sí puedo reescribirlo si me dices cómo.",
                  );
                  await openRoute(from, "marta", proposal.id);
                } else {
                  console.error(`[pablo/webhook] regen falló: ${regen.detail}`);
                  await sendWhatsAppText(
                    from,
                    "Uy, se me atascó al rehacerlo. Dime otra vez qué cambias y lo intento de nuevo.",
                  );
                  await openRoute(from, "marta", proposal.id);
                }
              }
              // Saltamos el flujo normal de Pablo para este mensaje.
              continue;
            }
          } catch (err) {
            console.error("[pablo/webhook] error en interceptor de Marta:", err);
            // Caemos al flujo normal de Pablo si algo falla en el interceptor.
          }

          // === INTERCEPTOR: ¿el cliente quiere reservar cita? ===
          // Solo para sectores que agendan citas de clientes finales (dental,
          // estetica). El sector "vendedor" capta clínicas y NO agenda citas
          // de pacientes, así que se salta el interceptor.
          let sectorAgenda = true;
          try {
            const sk = await getTenantSector(tenantId);
            sectorAgenda = getSectorPrompt(sk).agendaCitas;
          } catch { /* por defecto intentamos agendar */ }

          if (sectorAgenda) try {
            // Los datos de la cita (nombre + servicio + día/hora) se reúnen a lo
            // largo de VARIOS turnos. Detectamos sobre el TRANSCRIPT completo de
            // la conversación + el mensaje actual, no solo el último mensaje
            // (eso es lo que hacía que Pablo "confirmara" sin registrar nada).
            const convForIntent = await getConversation("pablo", from);
            const histTurns = (convForIntent?.turns ?? []).slice(-8);
            const transcript = [
              ...histTurns.map((t) => `${t.role === "user" ? "Cliente" : "Pablo"}: ${t.text}`),
              `Cliente: ${text}`,
            ].join("\n");

            // Detección única sobre el transcript.
            const intent = await detectAppointmentIntent(transcript);
            if (!intent.fields.nombre && customerName) {
              intent.fields.nombre = customerName;
              intent.missing = intent.missing.filter((m) => m !== "nombre");
            }

            // Guard de idempotencia: si esta cita ya está registrada para este
            // teléfono y esa hora, no la volvemos a reservar — caemos al flujo
            // normal para que Pablo responda con naturalidad.
            const complete =
              intent.wantsAppointment && intent.missing.length === 0 && !!intent.fields.startIso;
            if (complete && (await alreadyBookedForPhone(tenantId, from, intent.fields.startIso!))) {
              // ya reservada → no re-reservar; sigue al flujo normal de Pablo.
              throw { __skip: true };
            }

            const agRes = await tryAgendarFromText({
              text: transcript,
              intentOverride: intent,
              agenteOrigen: "pablo",
              redirectUri: `https://aiteam.marketing/api/lucia/callback`,
              customerPhone: from,
              customerNameFallback: customerName,
            });
            if (agRes.kind === "agendada") {
              const when = formatStartHumanES(agRes.intent.fields.startIso!);
              const ack = `¡Listo${customerName ? `, ${customerName.split(" ")[0]}` : ""}! 📅\n\nTe he agendado *${agRes.intent.fields.motivo}* el ${when}.\n\nSi necesitas cambiarla, dímelo y la movemos.`;
              await sendWhatsAppText(from, ack);
              await appendTurn("pablo", from, "user", text, customerName);
              await appendTurn("pablo", from, "assistant", ack, customerName);
              await safeLogEvent(tenantId, {
                id: makeEventId("message_in", "pablo", msg.id),
                ts: rxTs,
                type: "message_in",
                channel: "pablo",
                senderId: from,
              });
              await safeLogEvent(tenantId, {
                id: makeEventId("message_out", "pablo", msg.id),
                type: "message_out",
                channel: "pablo",
                senderId: from,
                meta: { latencyMs: Date.now() - Date.parse(rxTs) },
              });
              continue;
            }
            if (agRes.kind === "slot_taken") {
              const suggested = agRes.suggested ? `\n\nEse hueco está ocupado. ¿Te encajaría el ${formatStartHumanES(agRes.suggested)}?` : `\n\nEse hueco está ocupado. ¿Te encajaría otra hora ese día?`;
              await sendWhatsAppText(from, `Vale, lo intento agendar.${suggested}`);
              await appendTurn("pablo", from, "user", text, customerName);
              await appendTurn("pablo", from, "assistant", `Slot ocupado, propuesta: ${agRes.suggested ?? "—"}`, customerName);
              continue;
            }
            if (agRes.kind === "incomplete") {
              const q = missingFieldsToQuestion(agRes.missing);
              if (q) {
                await sendWhatsAppText(from, `Perfecto, te agendo cita. ${q}`);
                await appendTurn("pablo", from, "user", text, customerName);
                await appendTurn("pablo", from, "assistant", q, customerName);
                continue;
              }
            }
            // kind === "no_intent" o "error" → caemos al flujo normal de Pablo
          } catch (err) {
            // `__skip` = cita ya registrada (idempotencia); no es un error.
            if (!(err && typeof err === "object" && "__skip" in err)) {
              console.error("[pablo/webhook] interceptor agenda falló:", err);
            }
          }

          // Memoria de conversación: si no hay turnos (o estaba stale → ya limpiado
          // on-read por getConversation), tratamos como primer mensaje.
          const conv = await getConversation("pablo", from);
          const isNew = !conv || conv.turns.length === 0;

          // Generar respuesta con Claude usando el prompt del SECTOR del tenant
          // (dental / estetica / vendedor) + el contexto de su ficha.
          let sectorSystem = PABLO_SYSTEM;
          try {
            const sector = await getTenantSector(tenantId);
            const ficha = await getFicha(tenantId);
            sectorSystem = buildSectorSystem(sector, ficha ? fichaToPromptContext(ficha) : undefined);
          } catch (err) {
            console.error("[pablo/webhook] no se pudo resolver prompt de sector, uso default:", err);
          }
          const reply = await generateReply(text, customerName, isNew, conv, sectorSystem);
          console.log(`[pablo/webhook] AI reply: "${reply}"`);

          // Enviar de vuelta vía Graph API
          const sendResult = await sendWhatsAppText(from, reply);

          // Persistir turno del usuario y de la IA (después de enviar OK, evita
          // guardar interacciones que nunca llegaron al usuario).
          await appendTurn("pablo", from, "user", text, customerName);
          await appendTurn("pablo", from, "assistant", reply, customerName);

          // Eventos del informe mensual (silenciosos ante fallos).
          await safeLogEvent(tenantId, {
            id: makeEventId("message_in", "pablo", msg.id), // dedup por message_id de Meta
            ts: rxTs,
            type: "message_in",
            channel: "pablo",
            senderId: from,
          });
          await safeLogEvent(tenantId, {
            id: makeEventId("message_out", "pablo", msg.id),
            type: "message_out",
            channel: "pablo",
            senderId: from,
            meta: { latencyMs: Date.now() - Date.parse(rxTs) },
          });
          console.log(
            `[pablo/webhook] TX result:`,
            JSON.stringify(sendResult).slice(0, 500),
          );
        }
      }
    }
  } catch (err) {
    console.error("[pablo/webhook] error procesando POST:", err);
    // Devolvemos 200 igualmente: si devolvemos error, Meta reintenta.
  }

  return NextResponse.json({ ok: true });
}

// -----------------------------------------------------------------------------
// Generar respuesta con Claude
// -----------------------------------------------------------------------------
async function generateReply(
  message: string,
  customerName: string | undefined,
  firstMessage: boolean,
  conv: Conversation | null,
  systemPrompt: string = PABLO_SYSTEM,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "Hola, hemos recibido tu mensaje. Te respondemos en breve.";
  }

  // Reconstruimos el historial previo (sin el mensaje actual) como turnos
  // alternados user/assistant. Si la API rechazara dos turnos seguidos del
  // mismo rol (caso poco probable con webhook real), el último user se
  // fusiona con el mensaje actual abajo.
  const history = (conv?.turns ?? []).map((t) => ({
    role: t.role,
    content: t.text,
  }));

  const currentUserContent =
    `${firstMessage ? "[PRIMER MENSAJE]" : "[CONVERSACIÓN YA INICIADA]"}\n` +
    (customerName
      ? `Mensaje de ${customerName}:\n"${message}"`
      : `Mensaje recibido:\n"${message}"`);

  try {
    const ai = await anthropic.messages.create({
      model: MODELS.fast, // Claude Haiku 4.5
      max_tokens: 400,
      system: systemPrompt,
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
    console.error("[pablo/webhook] error generando respuesta IA:", err);
    return "¡Hola! Hemos recibido tu mensaje, te respondemos en cuanto podamos.";
  }
}

// -----------------------------------------------------------------------------
// Enviar mensaje vía WhatsApp Cloud API
// -----------------------------------------------------------------------------
async function sendWhatsAppText(to: string, body: string): Promise<unknown> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    console.error("[pablo/webhook] faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN");
    return { error: "missing credentials" };
  }

  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body, preview_url: false },
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[pablo/webhook] Graph API ${res.status}:`, json);
    }
    return json;
  } catch (err) {
    console.error("[pablo/webhook] fetch Graph API falló:", err);
    return { error: err instanceof Error ? err.message : "fetch failed" };
  }
}
