// Llamadas a Graph que hace Marta en Instagram: DMs, private replies y la
// RESPUESTA PÚBLICA a un comentario.
//
// Vivían dentro de `api/marta/webhook/route.ts`. Se sacan aquí porque el camino
// del comentario tenía que poder probarse sin ir a Instagram a comentar a mano
// (ver /api/admin/marta-probar-comentario). Un camino que solo se puede ejecutar
// desde fuera no se puede diagnosticar.
//
// -----------------------------------------------------------------------------
// LO QUE ROMPÍA LA RESPUESTA PÚBLICA (y por qué no se veía)
// -----------------------------------------------------------------------------
// `replyToComment` devolvía `{ error: "graph_error", status, body }` cuando Meta
// rechazaba la llamada, y quien la llamaba solo hacía:
//
//     const pubRes = await replyToComment(...)
//     console.log("public reply TX:", JSON.stringify(pubRes))
//
// Nadie miraba el `ok`. Un rechazo de Meta y un envío correcto acababan los dos
// en la misma línea de log, sin evento en el event-log y sin nada en el panel.
// Desde fuera el síntoma era exactamente el que se vio: el DM sale y la
// respuesta pública "no aparece", sin ningún error a la vista.
//
// Ahora la función devuelve un resultado tipado con el status HTTP, el código de
// error de Meta y el `fbtrace_id`, y registra CADA intento. Si vuelve a fallar,
// el motivo estará escrito.
//
// -----------------------------------------------------------------------------
// POR QUÉ SE INTENTA CON MÁS DE UNA CREDENCIAL
// -----------------------------------------------------------------------------
// Los DMs salen por `POST /{PAGE_ID}/messages` con un PAGE token derivado, y eso
// funciona. Pero la entrega de webhooks de esta cuenta NO viene de la Página:
// `/{page-id}/subscribed_apps` está vacío y aun así los eventos llegan, porque
// quien está suscrita es la APP al objeto `instagram` (ver meta-webhook-subs.ts).
// O sea: la cuenta usa piezas de los dos sabores de la API de Instagram, y cuál
// de ellos acepta `POST /{ig-comment-id}/replies` no se puede saber leyendo el
// código — solo preguntándoselo a Meta.
//
// Por eso la respuesta pública prueba, EN ESTE ORDEN, y para en el primer OK:
//   1. graph.facebook.com con PAGE token      → Instagram API con Facebook Login
//   2. graph.facebook.com con SYSTEM USER     → por si el nodo no acepta el de Página
//   3. graph.instagram.com con SYSTEM USER    → Instagram API con Instagram Login
//
// Los tres intentos quedan en el resultado con su status y su error, así que la
// primera ejecución real deja escrito cuál es el bueno para esta cuenta.

import "server-only";
import { baseGraph, baseGraphInstagram, simulado } from "./meta-graph-local";

const GRAPH_VERSION = "v21.0";

// EL CANDADO (ver src/lib/meta-graph-local.ts). Antes eran dos constantes fijas
// apuntando a Meta: en local, con un token de verdad puesto, Marta contestaba
// comentarios y mandaba DMs REALES desde el portátil, en la cuenta del cliente.
// Ahora son funciones y devuelven `null` cuando no hay a quién llamar.
const hostFacebook = () => baseGraph(GRAPH_VERSION);
const hostInstagram = () => baseGraphInstagram(GRAPH_VERSION);

export function getSystemUserToken(): string | undefined {
  return process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCESS_TOKEN.length > 0
    ? process.env.INSTAGRAM_ACCESS_TOKEN
    : process.env.WHATSAPP_ACCESS_TOKEN;
}

// -----------------------------------------------------------------------------
// Page Access Token cache (módulo)
// -----------------------------------------------------------------------------
// El System User EAA token NO sirve para POST /{page_id}/messages
// (Graph responde "(#190) This method must be called with a Page Access Token").
// Lo intercambiamos por el page access token vía GET /{page_id}?fields=access_token
// y lo cacheamos 1h en memoria del módulo.
let cachedPageToken: { token: string; expiresAt: number } | null = null;

/** Tira la caché del page token. La usa el reintento ante un 190. */
export function invalidatePageTokenCache(): void {
  cachedPageToken = null;
}

export async function getPageAccessToken(userToken: string, pageId: string): Promise<string> {
  const now = Date.now();
  if (cachedPageToken && cachedPageToken.expiresAt > now) return cachedPageToken.token;
  const base = hostFacebook();
  if (!base) {
    simulado("marta/graph", { pide: "page access token", pageId });
    throw new Error("[marta/graph] LOCAL sin META_GRAPH_URL: no se pide el token de Página a Meta.");
  }
  const url = `${base}/${pageId}?fields=access_token`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${userToken}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[marta/graph] failed to fetch page token: status=${res.status} body=${body}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error(`[marta/graph] no access_token in page response`);
  }
  cachedPageToken = { token: data.access_token, expiresAt: now + 60 * 60 * 1000 }; // 1h
  return data.access_token;
}

// -----------------------------------------------------------------------------
// Enviar mensajes vía Instagram Graph API (DM normal o private reply a comentario)
// -----------------------------------------------------------------------------

// El destinatario puede ser un usuario por IGSID (DM normal) o un comentario
// por comment_id (PRIVATE REPLY — exento de la ventana de 24h, mecanismo ManyChat).
export type IGRecipient = { id: string } | { comment_id: string };

/** Envía un mensaje (DM o private reply) vía POST /{PAGE_ID}/messages. */
export async function sendInstagramMessage(recipient: IGRecipient, text: string): Promise<unknown> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const systemUserToken = getSystemUserToken();

  if (!pageId) {
    console.warn(
      "[marta/graph] FACEBOOK_PAGE_ID no configurado — no se envía respuesta. " +
        "Los DMs de Instagram con System User EAA token requieren postear a /{PAGE_ID}/messages.",
    );
    return { skipped: "missing FACEBOOK_PAGE_ID" };
  }
  if (!systemUserToken) {
    console.error("[marta/graph] falta token (INSTAGRAM_ACCESS_TOKEN / WHATSAPP_ACCESS_TOKEN)");
    return { error: "missing token" };
  }

  const baseDm = hostFacebook();
  if (!baseDm) {
    simulado("marta/graph", { manda: "DM", pageId, recipient, text });
    return { simulado: true };
  }
  const endpoint = `${baseDm}/${pageId}/messages`;
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
    console.error("[marta/graph] page token error:", err instanceof Error ? err.message : err);
    return { error: "page_token_error" };
  }

  try {
    let res = await doPost(pageToken);
    if (!res.ok && (res.status === 401 || res.status === 400)) {
      const bodyText = await res.clone().text();
      // Reintenta una vez si parece token inválido / expirado (error 190).
      if (bodyText.includes('"code":190') || res.status === 401) {
        console.warn("[marta/graph] page token aparenta inválido, invalido caché y reintento UNA vez");
        invalidatePageTokenCache();
        try {
          pageToken = await getPageAccessToken(systemUserToken, pageId);
        } catch (err) {
          console.error(
            "[marta/graph] page token error en reintento:",
            err instanceof Error ? err.message : err,
          );
          return { error: "page_token_error_retry" };
        }
        res = await doPost(pageToken);
      }
    }
    if (!res.ok) {
      const bodyText = await res.text();
      console.error(`[marta/graph] graph error status=${res.status} body=${bodyText}`);
      return { error: "graph_error", status: res.status, body: bodyText };
    }
    const json = await res.json().catch(() => ({}));
    return json;
  } catch (err) {
    console.error("[marta/graph] fetch Graph API falló:", err);
    return { error: err instanceof Error ? err.message : "fetch failed" };
  }
}

/** DM normal a un usuario por IGSID. */
export async function sendInstagramDM(recipientId: string, text: string): Promise<unknown> {
  return sendInstagramMessage({ id: recipientId }, text);
}

/**
 * PRIVATE REPLY a un comentario (DM disparado por un comentario). Exento de la
 * ventana de 24h de Meta — es el mecanismo que usa ManyChat para Comment-to-DM.
 */
export async function sendInstagramPrivateReply(commentId: string, text: string): Promise<unknown> {
  return sendInstagramMessage({ comment_id: commentId }, text);
}

// -----------------------------------------------------------------------------
// Respuesta PÚBLICA a un comentario (POST /{comment-id}/replies)
// -----------------------------------------------------------------------------

export type IntentoGraph = {
  credencial: "page_token" | "system_user_token";
  host: "graph.facebook.com" | "graph.instagram.com";
  status: number;
  ok: boolean;
  /** Código de error de Meta (100 = nodo/campo inexistente, 190 = token, 200 = permiso). */
  code?: number;
  subcode?: number;
  message?: string;
  fbtraceId?: string;
  /** Cuerpo crudo recortado, por si el error no viene en el formato de siempre. */
  body?: string;
};

export type ResultadoRespuestaPublica = {
  ok: boolean;
  /** id de la respuesta creada, cuando Meta la acepta. */
  replyId?: string;
  /** Qué intento funcionó, para dejarlo escrito de una vez. */
  gano?: string;
  intentos: IntentoGraph[];
  /** Resumen legible del fallo (el que se enseña en el panel y en el log). */
  error?: string;
};

type Credencial = { tipo: IntentoGraph["credencial"]; token: string; host: IntentoGraph["host"] };

async function intentarReply(
  commentId: string,
  text: string,
  cred: Credencial,
): Promise<IntentoGraph> {
  const base = cred.host === "graph.facebook.com" ? hostFacebook() : hostInstagram();
  if (!base) {
    simulado("marta/graph", { responde: "comentario público", commentId, text });
    return {
      credencial: cred.tipo,
      host: cred.host,
      status: 0,
      ok: false,
      message: "LOCAL sin META_GRAPH_URL: no se ha llamado a Meta.",
    };
  }
  const endpoint = `${base}/${commentId}/replies`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ message: text }).toString(),
    });
    const bodyText = await res.text();
    let parsed: { id?: string; error?: { code?: number; error_subcode?: number; message?: string; fbtrace_id?: string } } = {};
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      /* Meta contestó algo que no es JSON: se queda el cuerpo crudo abajo. */
    }
    const ok = res.ok && !parsed.error;
    return {
      credencial: cred.tipo,
      host: cred.host,
      status: res.status,
      ok,
      code: parsed.error?.code,
      subcode: parsed.error?.error_subcode,
      message: parsed.error?.message,
      fbtraceId: parsed.error?.fbtrace_id,
      body: ok ? bodyText.slice(0, 200) : bodyText.slice(0, 500),
    };
  } catch (err) {
    return {
      credencial: cred.tipo,
      host: cred.host,
      status: 0,
      ok: false,
      message: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

/**
 * Respuesta PÚBLICA en el hilo del post. Prueba las credenciales en orden y para
 * en la primera que Meta acepte. Devuelve SIEMPRE la traza de intentos: es lo
 * único que distingue "Meta lo rechazó" de "ni se intentó".
 */
export async function replyToComment(
  commentId: string,
  text: string,
): Promise<ResultadoRespuestaPublica> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const systemUserToken = getSystemUserToken();

  if (!systemUserToken) {
    const error = "No hay token (INSTAGRAM_ACCESS_TOKEN / WHATSAPP_ACCESS_TOKEN).";
    console.error(`[marta/graph] respuesta pública NO enviada: ${error}`);
    return { ok: false, intentos: [], error };
  }

  const credenciales: Credencial[] = [];

  // 1. PAGE token — el mismo camino que ya funciona para los DMs.
  if (pageId) {
    try {
      const pageToken = await getPageAccessToken(systemUserToken, pageId);
      credenciales.push({ tipo: "page_token", token: pageToken, host: "graph.facebook.com" });
    } catch (err) {
      console.error(
        "[marta/graph] no se ha podido derivar el page token para la respuesta pública:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  // 2. y 3. System User token, en los dos hosts.
  credenciales.push({ tipo: "system_user_token", token: systemUserToken, host: "graph.facebook.com" });
  credenciales.push({ tipo: "system_user_token", token: systemUserToken, host: "graph.instagram.com" });

  const intentos: IntentoGraph[] = [];
  for (const cred of credenciales) {
    const intento = await intentarReply(commentId, text, cred);
    intentos.push(intento);

    if (intento.ok) {
      const gano = `${intento.host} + ${intento.credencial}`;
      console.log(
        `[marta/graph] respuesta pública OK comment=${commentId} vía ${gano} status=${intento.status}`,
      );
      let replyId: string | undefined;
      try {
        replyId = (JSON.parse(intento.body || "{}") as { id?: string }).id;
      } catch {
        /* da igual: lo importante es el ok */
      }
      return { ok: true, replyId, gano, intentos };
    }

    // Cada fallo se escribe entero: status, código de Meta y fbtrace_id. Con el
    // fbtrace_id, el soporte de Meta puede mirar la llamada concreta.
    console.error(
      `[marta/graph] respuesta pública RECHAZADA comment=${commentId} ` +
        `vía ${intento.host} + ${intento.credencial} status=${intento.status} ` +
        `code=${intento.code ?? "?"} subcode=${intento.subcode ?? "?"} ` +
        `fbtrace=${intento.fbtraceId ?? "?"} msg=${intento.message ?? intento.body ?? "?"}`,
    );

    // Un 190 con el page token puede ser caché caducada: se tira y el siguiente
    // intento la vuelve a derivar.
    if (intento.code === 190 && cred.tipo === "page_token") invalidatePageTokenCache();
  }

  const ultimo = intentos[intentos.length - 1];
  const error =
    `Meta rechazó los ${intentos.length} intentos. Último: ` +
    `${ultimo?.host} + ${ultimo?.credencial} → HTTP ${ultimo?.status}` +
    (ultimo?.code ? ` (código ${ultimo.code}${ultimo.subcode ? `/${ultimo.subcode}` : ""})` : "") +
    `: ${ultimo?.message ?? ultimo?.body ?? "sin mensaje"}`;
  return { ok: false, intentos, error };
}
