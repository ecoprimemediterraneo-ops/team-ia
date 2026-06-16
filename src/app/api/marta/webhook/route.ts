// Webhook receiver de Instagram Messaging (Meta Graph API) para Marta.
//
// FLUJO:
//   1. Meta llama GET /api/marta/webhook con hub.verify_token → respondemos challenge si coincide.
//   2. Meta llama POST /api/marta/webhook cuando llega un DM o comentario a la cuenta IG conectada.
//   3. Para DMs: extraemos texto + sender.id, generamos respuesta con Claude Haiku
//      y la enviamos vía Graph API /{ig-user-id}/messages.
//   4. Comentarios: TODO (ver stub abajo).
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
import { anthropic, MODELS } from "@/lib/claude";
import { martaPrompt } from "@/lib/marta-prompt";
import {
  appendTurn,
  getConversation,
  type Conversation,
} from "@/lib/conversation-store";
import { logEvent, makeEventId } from "@/lib/event-log";
import { resolveTenantFromMeta } from "@/lib/tenants";
import {
  getCommentRules,
  findMatchingRule,
  renderDmTemplate,
  markCommentProcessed,
  isCommentDmEnabled,
} from "@/lib/marta-comment-rules";

async function safeLogEvent(...args: Parameters<typeof logEvent>): Promise<void> {
  try {
    await logEvent(...args);
  } catch (err) {
    console.error("[marta/webhook] event log error:", err);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH_VERSION = "v21.0";

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
  let body: WebhookPayload;
  try {
    body = (await req.json()) as WebhookPayload;
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
        await handleCommentChange(tenantId, entry.id, change);
      }
    }
  } catch (err) {
    console.error("[marta/webhook] error procesando POST:", err);
    // 200 igualmente para que Meta no reintente.
  }

  return NextResponse.json({ ok: true });
}

// -----------------------------------------------------------------------------
// Comentario → DM (la función estrella de ManyChat)
// -----------------------------------------------------------------------------
//
// Cuando alguien comenta una palabra clave en un post de Marta:
//   1. Ignoramos comentarios propios de la cuenta y duplicados (dedup por id).
//   2. Buscamos la primera regla habilitada que casa (keyword + scope).
//   3. Enviamos el PRIMER DM = plantilla fija de la regla, vía PRIVATE REPLY
//      (recipient.comment_id → exento de la ventana de 24h, mecanismo ManyChat).
//   4. Sembramos la conversación con ese DM como turno "assistant", para que si
//      el usuario responde por privado, el motor de IA de DMs siga el hilo.
//   5. Opcional: respuesta PÚBLICA al comentario.
//
// El envío real está gated por MARTA_COMMENT_DM_ENABLED (App Review pendiente:
// instagram_manage_comments + instagram_business_manage_messages). Mientras esté
// apagado, detectamos y registramos la coincidencia pero NO llamamos a Meta.
async function handleCommentChange(
  tenantId: string,
  entryId: string | undefined,
  change: IGCommentChange,
): Promise<void> {
  const v = change.value ?? {};
  const commentId = v.id;
  const text = v.text ?? "";
  const fromId = v.from?.id;
  const username = v.from?.username;
  const mediaId = v.media?.id;

  if (!commentId || !text.trim()) {
    console.log("[marta/webhook] comentario sin id/texto ignorado");
    return;
  }

  // 1a. Ignorar comentarios de la propia cuenta (no autorresponderse).
  const ownId = entryId || process.env.INSTAGRAM_USER_ID;
  if (fromId && ownId && fromId === ownId) {
    console.log("[marta/webhook] comentario propio ignorado");
    return;
  }

  // 1b. Dedup por comment.id (anti doble-DM si Meta reentrega el webhook).
  const isNew = await markCommentProcessed(tenantId, commentId);
  if (!isNew) {
    console.log(`[marta/webhook] comentario duplicado ignorado id=${commentId}`);
    return;
  }

  // 2. ¿Hay regla que case?
  const rules = await getCommentRules(tenantId);
  const rule = findMatchingRule(rules, text, mediaId);
  if (!rule) {
    console.log(
      `[marta/webhook] comentario sin regla que case: "${text.slice(0, 80)}" (media=${mediaId ?? "?"})`,
    );
    return;
  }

  const dm = renderDmTemplate(rule.dmMessage, { usuario: username });
  const rxTs = new Date().toISOString();
  console.log(
    `[marta/webhook] COMMENT match rule=${rule.id} from=${fromId ?? "?"} "${text.slice(0, 80)}"`,
  );

  // Registrar el comentario entrante (idempotente por commentId).
  await safeLogEvent(tenantId, {
    id: makeEventId("comment_in", "marta", commentId),
    ts: rxTs,
    type: "message_in",
    channel: "marta",
    senderId: fromId,
    meta: { kind: "comment", commentId, mediaId, ruleId: rule.id },
  });

  // 3. Envío del DM (gated hasta App Review).
  if (!isCommentDmEnabled()) {
    console.log(
      "[marta/webhook] comment-to-DM GATED (MARTA_COMMENT_DM_ENABLED != true). " +
        `Habría enviado este DM a comment ${commentId}: "${dm.slice(0, 200)}"`,
    );
    return;
  }

  const sendResult = await sendInstagramPrivateReply(commentId, dm);
  console.log(`[marta/webhook] private reply TX:`, JSON.stringify(sendResult).slice(0, 300));

  // 4. Sembrar la conversación para que la IA continúe el hilo por DM.
  if (fromId) {
    try {
      await appendTurn("marta", fromId, "assistant", dm, username);
    } catch (err) {
      console.error("[marta/webhook] no se pudo sembrar la conversación:", err);
    }
  }

  await safeLogEvent(tenantId, {
    id: makeEventId("comment_dm_out", "marta", commentId),
    type: "message_out",
    channel: "marta",
    senderId: fromId,
    meta: { kind: "comment_dm", commentId, ruleId: rule.id },
  });

  // 5. Respuesta pública opcional al comentario.
  if (rule.replyPublic) {
    const publicText =
      (rule.publicReplyText || "").trim() || "¡Te acabo de escribir por privado! 📩";
    const pubRes = await replyToComment(commentId, publicText);
    console.log(`[marta/webhook] public reply TX:`, JSON.stringify(pubRes).slice(0, 200));
  }
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

// -----------------------------------------------------------------------------
// Page Access Token cache (módulo)
// -----------------------------------------------------------------------------
// El System User EAA token NO sirve para POST /{page_id}/messages
// (Graph responde "(#190) This method must be called with a Page Access Token").
// Lo intercambiamos por el page access token vía GET /{page_id}?fields=access_token
// y lo cacheamos 1h en memoria del módulo.
let cachedPageToken: { token: string; expiresAt: number } | null = null;

async function getPageAccessToken(userToken: string, pageId: string): Promise<string> {
  const now = Date.now();
  if (cachedPageToken && cachedPageToken.expiresAt > now) return cachedPageToken.token;
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}?fields=access_token`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${userToken}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[marta/webhook] failed to fetch page token: status=${res.status} body=${body}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error(`[marta/webhook] no access_token in page response`);
  }
  cachedPageToken = { token: data.access_token, expiresAt: now + 60 * 60 * 1000 }; // 1h
  return data.access_token;
}

// -----------------------------------------------------------------------------
// Enviar mensajes vía Instagram Graph API (DM normal o private reply a comentario)
// -----------------------------------------------------------------------------

// El destinatario puede ser un usuario por IGSID (DM normal) o un comentario
// por comment_id (PRIVATE REPLY — exento de la ventana de 24h, mecanismo ManyChat).
type IGRecipient = { id: string } | { comment_id: string };

function getSystemUserToken(): string | undefined {
  return process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCESS_TOKEN.length > 0
    ? process.env.INSTAGRAM_ACCESS_TOKEN
    : process.env.WHATSAPP_ACCESS_TOKEN;
}

/** Envía un mensaje (DM o private reply) vía POST /{PAGE_ID}/messages. */
async function sendInstagramMessage(recipient: IGRecipient, text: string): Promise<unknown> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const systemUserToken = getSystemUserToken();

  if (!pageId) {
    console.warn(
      "[marta/webhook] FACEBOOK_PAGE_ID no configurado — no se envía respuesta. " +
        "Los DMs de Instagram con System User EAA token requieren postear a /{PAGE_ID}/messages.",
    );
    return { skipped: "missing FACEBOOK_PAGE_ID" };
  }
  if (!systemUserToken) {
    console.error("[marta/webhook] falta token (INSTAGRAM_ACCESS_TOKEN / WHATSAPP_ACCESS_TOKEN)");
    return { error: "missing token" };
  }

  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/messages`;
  const payload = {
    recipient,
    message: { text },
    messaging_product: "instagram",
  };

  const doPost = async (pageToken: string) =>
    fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pageToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

  let pageToken: string;
  try {
    pageToken = await getPageAccessToken(systemUserToken, pageId);
  } catch (err) {
    console.error(
      "[marta/webhook] page token error:",
      err instanceof Error ? err.message : err,
    );
    return { error: "page_token_error" };
  }

  try {
    let res = await doPost(pageToken);
    if (!res.ok && (res.status === 401 || res.status === 400)) {
      const bodyText = await res.clone().text();
      // Reintenta una vez si parece token inválido / expirado (error 190).
      if (bodyText.includes('"code":190') || res.status === 401) {
        console.warn(
          "[marta/webhook] page token aparenta inválido, invalido caché y reintento UNA vez",
        );
        cachedPageToken = null;
        try {
          pageToken = await getPageAccessToken(systemUserToken, pageId);
        } catch (err) {
          console.error(
            "[marta/webhook] page token error en reintento:",
            err instanceof Error ? err.message : err,
          );
          return { error: "page_token_error_retry" };
        }
        res = await doPost(pageToken);
      }
    }
    if (!res.ok) {
      const bodyText = await res.text();
      console.error(
        `[marta/webhook] graph error status=${res.status} body=${bodyText}`,
      );
      return { error: "graph_error", status: res.status, body: bodyText };
    }
    const json = await res.json().catch(() => ({}));
    return json;
  } catch (err) {
    console.error("[marta/webhook] fetch Graph API falló:", err);
    return { error: err instanceof Error ? err.message : "fetch failed" };
  }
}

/** DM normal a un usuario por IGSID. */
async function sendInstagramDM(recipientId: string, text: string): Promise<unknown> {
  return sendInstagramMessage({ id: recipientId }, text);
}

/**
 * PRIVATE REPLY a un comentario (DM disparado por un comentario). Exento de la
 * ventana de 24h de Meta — es el mecanismo que usa ManyChat para Comment-to-DM.
 */
async function sendInstagramPrivateReply(commentId: string, text: string): Promise<unknown> {
  return sendInstagramMessage({ comment_id: commentId }, text);
}

/** Respuesta PÚBLICA a un comentario (POST /{comment-id}/replies). */
async function replyToComment(commentId: string, text: string): Promise<unknown> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const systemUserToken = getSystemUserToken();
  if (!pageId || !systemUserToken) {
    return { skipped: "missing page id or token" };
  }
  let pageToken: string;
  try {
    pageToken = await getPageAccessToken(systemUserToken, pageId);
  } catch (err) {
    console.error("[marta/webhook] reply page token error:", err instanceof Error ? err.message : err);
    return { error: "page_token_error" };
  }
  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${commentId}/replies`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pageToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ message: text }).toString(),
    });
    if (!res.ok) {
      const bodyText = await res.text();
      console.error(`[marta/webhook] reply graph error status=${res.status} body=${bodyText}`);
      return { error: "graph_error", status: res.status, body: bodyText };
    }
    return await res.json().catch(() => ({}));
  } catch (err) {
    console.error("[marta/webhook] reply fetch falló:", err);
    return { error: err instanceof Error ? err.message : "fetch failed" };
  }
}
