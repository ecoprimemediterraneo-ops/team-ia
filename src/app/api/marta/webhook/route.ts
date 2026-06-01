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
import { hasGreeted, markGreeted } from "@/lib/greeting-store";

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

        console.log(`[marta/webhook] DM RX from=${senderId} text="${text}"`);

        // ¿Primer DM de este usuario? Si ya fue saludado, no se presenta.
        const alreadyGreeted = await hasGreeted("marta", senderId);

        const reply = await generateReply(text, !alreadyGreeted);
        console.log(`[marta/webhook] AI reply: "${reply}"`);

        const sendResult = await sendInstagramDM(senderId, reply);
        if (!alreadyGreeted) await markGreeted("marta", senderId);
        console.log(
          `[marta/webhook] TX result:`,
          JSON.stringify(sendResult).slice(0, 500),
        );
      }

      // --- Comentarios ---
      const changes = entry.changes ?? [];
      for (const change of changes) {
        if (change.field === "comments") {
          // TODO: comments
          // Respuesta a comentario público de Instagram. Cuando lo activemos:
          //   const commentId = change.value?.id;
          //   const text = change.value?.text;
          //   const reply = await generateReply(text);
          //   await fetch(
          //     `https://graph.facebook.com/${GRAPH_VERSION}/${commentId}/replies`,
          //     {
          //       method: "POST",
          //       headers: {
          //         Authorization: `Bearer ${token}`,
          //         "Content-Type": "application/json",
          //       },
          //       body: JSON.stringify({ message: reply }),
          //     },
          //   );
          // De momento solo loggeamos para no responder por accidente en público.
          console.log(
            `[marta/webhook] comentario recibido (stub, no respondemos):`,
            JSON.stringify(change.value).slice(0, 300),
          );
          continue;
        }
        console.log(`[marta/webhook] change field no soportado: ${change.field}`);
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
async function generateReply(message: string, firstMessage = false): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "¡Hola! Hemos recibido tu mensaje, te respondemos en breve.";
  }

  try {
    const ai = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 400,
      system: martaPrompt,
      messages: [
        {
          role: "user",
          content: `${firstMessage ? "[PRIMER MENSAJE]" : "[CONVERSACIÓN YA INICIADA]"}\nMensaje recibido:\n"${message}"`,
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
// Enviar DM vía Instagram Graph API
// -----------------------------------------------------------------------------
async function sendInstagramDM(recipientId: string, text: string): Promise<unknown> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const systemUserToken =
    process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCESS_TOKEN.length > 0
      ? process.env.INSTAGRAM_ACCESS_TOKEN
      : process.env.WHATSAPP_ACCESS_TOKEN;

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
    recipient: { id: recipientId },
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
