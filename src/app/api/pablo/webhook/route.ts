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

          console.log(
            `[pablo/webhook] RX from=${from} name=${customerName ?? "?"} text="${text}"`,
          );

          // Generar respuesta con Claude (no llamamos a /api/pablo/respond porque
          // ese endpoint requiere sesión de usuario, no aplicable a un webhook).
          const reply = await generateReply(text, customerName);
          console.log(`[pablo/webhook] AI reply: "${reply}"`);

          // Enviar de vuelta vía Graph API
          const sendResult = await sendWhatsAppText(from, reply);
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
async function generateReply(message: string, customerName?: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "Hola, hemos recibido tu mensaje. Te respondemos en breve.";
  }

  try {
    const ai = await anthropic.messages.create({
      model: MODELS.fast, // Claude Haiku 4.5
      max_tokens: 400,
      system: PABLO_SYSTEM,
      messages: [
        {
          role: "user",
          content: customerName
            ? `Mensaje de ${customerName}:\n"${message}"`
            : `Mensaje recibido:\n"${message}"`,
        },
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
