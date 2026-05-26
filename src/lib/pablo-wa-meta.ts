/**
 * Pablo · Cliente Meta WhatsApp Cloud API.
 * Si no hay tokens (pendiente App Review) → devuelve { ok: false, reason: "no_token" }
 */

import crypto from "node:crypto";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function verifyWaSignature(rawBody: string, sig: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    if (process.env.VERCEL_ENV === "production") return false;
    return true;
  }
  if (!sig) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function handleWaChallenge(params: URLSearchParams): { ok: boolean; challenge?: string } {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = process.env.WA_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && token === expected && challenge) {
    return { ok: true, challenge };
  }
  return { ok: false };
}

/**
 * Envía un mensaje de texto WhatsApp via Cloud API.
 */
export async function sendWaText(toPhoneE164: string, text: string): Promise<{ ok: boolean; messageId?: string; reason?: string }> {
  const token = process.env.WA_PHONE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, reason: "no_token" };

  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhoneE164,
        type: "text",
        text: { body: text, preview_url: false },
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, reason: data?.error?.message || "graph_error" };
    return { ok: true, messageId: data.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "unknown" };
  }
}
