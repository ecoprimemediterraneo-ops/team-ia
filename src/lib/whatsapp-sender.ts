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
  | { ok: true; messageId?: string; raw: unknown; simulado?: true }
  | { ok: false; reason: "missing_credentials" | "graph_error" | "network_error"; detail: string };

/**
 * Doble candado, igual que en `gestoria-adjuntos.ts` y `auth.ts`: en local
 * NODE_ENV no es production Y no existe VERCEL. Las dos cosas juntas no pueden
 * darse en producción.
 */
function esLocal(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

/**
 * POR QUÉ ESTO EXISTE: antes este fichero llamaba SIEMPRE a graph.facebook.com.
 * En cuanto hubiera un token de verdad en el `.env.local` del portátil, darle al
 * botón de "enviar documento" mandaba un WhatsApp REAL a un cliente real desde
 * una máquina de desarrollo. Ahora en local es IMPOSIBLE salir a Meta:
 *   - si hay `META_GRAPH_URL`, se va al Graph de mentira (127.0.0.1:4545);
 *   - si no lo hay, no se llama a nadie: se escribe en consola y se devuelve
 *     éxito simulado.
 * `META_GRAPH_URL` se ignora en Vercel a propósito: una variable capaz de
 * redirigir llamadas que llevan el token dentro sería un agujero en producción.
 */
function destinoGraph(phoneNumberId: string): { url: string; simulado: boolean } {
  const falso = process.env.META_GRAPH_URL;
  if (esLocal()) {
    if (falso) {
      return { url: `${falso.replace(/\/+$/, "")}/${phoneNumberId}/messages`, simulado: false };
    }
    return { url: "", simulado: true };
  }
  return {
    url: `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    simulado: false,
  };
}

async function postGraph(payload: unknown): Promise<WhatsAppSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    return {
      ok: false,
      reason: "missing_credentials",
      detail: "Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN.",
    };
  }
  const destino = destinoGraph(phoneNumberId);
  if (destino.simulado) {
    console.warn(
      "[whatsapp-sender] LOCAL sin META_GRAPH_URL: no se envía nada a Meta. Mensaje simulado:",
      JSON.stringify(payload),
    );
    return { ok: true, messageId: `simulado-local-${Date.now()}`, raw: payload, simulado: true };
  }
  try {
    const res = await fetch(destino.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
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

/**
 * Envía un mensaje de PLANTILLA (template) ya aprobada en Meta. Es la única forma
 * de escribir al usuario FUERA de la ventana de 24 h (avisos proactivos, p.ej. al
 * dueño). `bodyParams` son las variables {{1}}, {{2}}… del cuerpo, EN ORDEN.
 * Reutiliza el mismo cliente/credenciales (WHATSAPP_PHONE_NUMBER_ID/ACCESS_TOKEN).
 */
/**
 * Envía un documento (PDF, imagen, hoja) por URL, con nombre de fichero.
 *
 * La URL tiene que ser alcanzable por Meta: Meta se la descarga desde sus
 * servidores, no desde el navegador del gestor. Por eso una URL firmada de
 * Supabase vale y una ruta de `localhost` no.
 */
export async function sendWhatsAppDocument(
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string,
): Promise<WhatsAppSendResult> {
  return postGraph({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "document",
    document: {
      link: documentUrl,
      filename: filename.slice(0, 240),
      ...(caption ? { caption: caption.slice(0, 1024) } : {}),
    },
  });
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[] = [],
): Promise<WhatsAppSendResult> {
  return postGraph({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(bodyParams.length
        ? {
            components: [
              {
                type: "body",
                parameters: bodyParams.map((text) => ({ type: "text", text: text || "—" })),
              },
            ],
          }
        : {}),
    },
  });
}
