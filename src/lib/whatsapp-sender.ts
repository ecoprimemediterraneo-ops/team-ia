// Envío de mensajes por WhatsApp Business Cloud API (Graph API).
//
// Reutilizable por cualquier agente que necesite enviar al cliente:
//   - Pablo (texto, ya lo usaba inline en su webhook).
//   - Marta (propuesta = imagen + caption antes de publicar en Instagram).
//
// Vars de entorno necesarias (las mismas que ya usa Pablo):
//   - WHATSAPP_PHONE_NUMBER_ID
//   - WHATSAPP_ACCESS_TOKEN

const GRAPH_VERSION = "v21.0";

export type WhatsAppSendResult =
  | { ok: true; messageId?: string; raw: unknown }
  | { ok: false; reason: "missing_credentials" | "graph_error" | "network_error"; detail: string };

function endpoint(): { url: string; token: string } | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) return null;
  return {
    url: `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    token,
  };
}

async function postGraph(payload: unknown): Promise<WhatsAppSendResult> {
  const e = endpoint();
  if (!e) {
    return {
      ok: false,
      reason: "missing_credentials",
      detail: "Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN.",
    };
  }
  try {
    const res = await fetch(e.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${e.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string; code?: number };
    };
    if (!res.ok) {
      const msg = json.error?.message || `HTTP ${res.status}`;
      return { ok: false, reason: "graph_error", detail: msg };
    }
    return { ok: true, messageId: json.messages?.[0]?.id, raw: json };
  } catch (err) {
    return {
      ok: false,
      reason: "network_error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Envía un mensaje de texto plano. */
export async function sendWhatsAppText(
  to: string,
  body: string,
): Promise<WhatsAppSendResult> {
  return postGraph({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body, preview_url: false },
  });
}

/**
 * Envía un vídeo por URL con caption opcional. Debe ser pública (MP4 H.264,
 * AAC, ≤ 16 MB). Caption máx 1024 chars.
 */
export async function sendWhatsAppVideo(
  to: string,
  videoUrl: string,
  caption?: string,
): Promise<WhatsAppSendResult> {
  return postGraph({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "video",
    video: {
      link: videoUrl,
      ...(caption ? { caption: caption.slice(0, 1024) } : {}),
    },
  });
}

/**
 * Envía una imagen por URL con caption opcional.
 * La imagen debe ser pública y accesible por Meta (JPG/PNG, ≤ 5 MB).
 * El caption es opcional; máximo 1024 caracteres (límite de WhatsApp).
 */
export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption?: string,
): Promise<WhatsAppSendResult> {
  return postGraph({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "image",
    image: {
      link: imageUrl,
      ...(caption ? { caption: caption.slice(0, 1024) } : {}),
    },
  });
}
