/**
 * Marta · Cliente Meta Graph API para Instagram + verificación de firma.
 *
 * Si los tokens no están configurados (Meta App Review pendiente), las funciones
 * de envío devuelven { ok: false, reason: "no_token" } sin romper el flow.
 */

import crypto from "node:crypto";

const GRAPH_VERSION = process.env.IG_GRAPH_API_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Verifica la firma X-Hub-Signature-256 que Meta añade a cada webhook.
 * Si META_APP_SECRET no está, en producción rechazamos (failsafe).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    if (process.env.VERCEL_ENV === "production") return false;
    return true; // dev local: permitido
  }
  if (!signatureHeader) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

/**
 * Responde al challenge GET que Meta hace al registrar el webhook.
 */
export function handleVerifyChallenge(params: URLSearchParams): { ok: boolean; challenge?: string } {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = process.env.IG_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === expected && challenge) {
    return { ok: true, challenge };
  }
  return { ok: false };
}

/**
 * Envía un DM por la Send API.
 * @returns { ok, messageId? , reason? }
 */
export async function sendIgDm(
  recipientId: string,
  text: string,
): Promise<{ ok: boolean; messageId?: string; reason?: string }> {
  const token = process.env.IG_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  if (!token) return { ok: false, reason: "no_token" };

  try {
    const res = await fetch(`${GRAPH}/me/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, reason: data?.error?.message || "graph_error" };
    }
    return { ok: true, messageId: data.message_id };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "unknown" };
  }
}

/**
 * Responde a un comentario público con un texto corto.
 */
export async function replyToComment(
  commentId: string,
  text: string,
): Promise<{ ok: boolean; reason?: string }> {
  const token = process.env.IG_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  if (!token) return { ok: false, reason: "no_token" };

  try {
    const res = await fetch(`${GRAPH}/${commentId}/replies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, reason: data?.error?.message || "graph_error" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "unknown" };
  }
}

/**
 * Manda un Private Reply al autor de un comentario (DM con más info).
 * Solo válido los 7 días siguientes al comentario y 1 vez por comentario.
 */
export async function sendPrivateReply(
  commentId: string,
  text: string,
): Promise<{ ok: boolean; reason?: string }> {
  const token = process.env.IG_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  const igBusinessId = process.env.IG_BUSINESS_ACCOUNT_ID || process.env.META_INSTAGRAM_USER_ID;
  if (!token || !igBusinessId) return { ok: false, reason: "no_token" };

  try {
    const res = await fetch(`${GRAPH}/${igBusinessId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text },
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, reason: data?.error?.message || "graph_error" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "unknown" };
  }
}

/**
 * Lee el perfil público de un usuario IG (username, foto).
 * Opcional — útil para personalizar respuestas.
 */
export async function fetchIgUserProfile(igUserId: string): Promise<{ username?: string } | null> {
  const token = process.env.IG_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${GRAPH}/${igUserId}?fields=username&access_token=${token}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
