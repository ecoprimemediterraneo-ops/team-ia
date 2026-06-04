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
import { logEvent, makeEventId } from "@/lib/event-log";
import { resolveTenantFromMeta } from "@/lib/tenants";
import {
  findPendingProposalByWhatsapp,
  markProposalPublished,
  markProposalRejected,
  recordClientReply,
} from "@/lib/marta-proposals";
import { publishToInstagram } from "@/lib/marta-publish";
import { classifyClientReply } from "@/lib/marta-intent";
import {
  findEntryByProposalId,
  markCalendarEntryPublished,
  markCalendarEntryRejected,
} from "@/lib/marta-calendar";

// Logging de eventos del informe mensual. Silencioso ante fallos para no
// romper el flujo principal del webhook.
async function safeLogEvent(...args: Parameters<typeof logEvent>): Promise<void> {
  try {
    await logEvent(...args);
  } catch (err) {
    console.error("[pablo/webhook] event log error:", err);
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

          const from = msg.from; // número del cliente (sin '+')
          const text = msg.text.body;
          const customerName = contacts.find((c) => c.wa_id === from)?.profile?.name;

          // Ts de recepción para medir latencia de respuesta del agente.
          const rxTs = new Date().toISOString();

          console.log(
            `[pablo/webhook] RX from=${from} name=${customerName ?? "?"} text="${text}"`,
          );

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
            if (proposal) {
              const cls = await classifyClientReply(text);
              await recordClientReply(proposal, text, cls.intent);
              console.log(
                `[pablo/webhook] Marta proposal id=${proposal.id} intent=${cls.intent} (conf=${cls.confidence.toFixed(2)}, src=${cls.source})`,
              );

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
              } else if (cls.intent === "cambiar_foto") {
                await sendWhatsAppText(
                  from,
                  "Vale, cambio la foto 📸 Cuéntame qué quieres distinto: otra escena, otro estilo, otra luz… y te paso una nueva.",
                );
              } else if (cls.intent === "cambiar_caption") {
                await sendWhatsAppText(
                  from,
                  "Hecho, reescribo el texto ✍️ Dime qué cambias: más corto, más informal, sin hashtags, más directo… y te lo mando.",
                );
              } else if (cls.intent === "rechazar") {
                await markProposalRejected(proposal);
                // Propaga al calendario si la propuesta venía de allí.
                try {
                  const calEntry = await findEntryByProposalId(proposal.tenantId, proposal.id);
                  if (calEntry) await markCalendarEntryRejected(proposal.tenantId, calEntry.id);
                } catch { /* noop */ }
                await sendWhatsAppText(
                  from,
                  "Sin problema, descartado 👌 Cuando quieras otra propuesta me dices.",
                );
              } else {
                // feedback_general
                await sendWhatsAppText(
                  from,
                  "Vale, lo ajusto 👍 Cuéntame qué quieres cambiar y preparo otra propuesta.",
                );
              }
              // Saltamos el flujo normal de Pablo para este mensaje.
              continue;
            }
          } catch (err) {
            console.error("[pablo/webhook] error en interceptor de Marta:", err);
            // Caemos al flujo normal de Pablo si algo falla en el interceptor.
          }

          // Memoria de conversación: si no hay turnos (o estaba stale → ya limpiado
          // on-read por getConversation), tratamos como primer mensaje.
          const conv = await getConversation("pablo", from);
          const isNew = !conv || conv.turns.length === 0;

          // Generar respuesta con Claude (no llamamos a /api/pablo/respond porque
          // ese endpoint requiere sesión de usuario, no aplicable a un webhook).
          const reply = await generateReply(text, customerName, isNew, conv);
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
      system: PABLO_SYSTEM,
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
