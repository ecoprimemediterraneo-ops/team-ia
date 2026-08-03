// Suscripciones del webhook de Meta para Marta.
//
// Nada llega al webhook por el hecho de tener la cuenta conectada: hay que
// suscribirse a CADA campo. Marta necesita dos, y —esto es lo que no es obvio—
// NO viven en el mismo sitio:
//
//   - `messages` → los DMs, que entran en `entry[].messaging`.
//   - `comments` → los comentarios de los posts, que entran en `entry[].changes`
//                  con `field: "comments"`.
//
// TRAMPA GORDA: `comments` NO es un campo de la PÁGINA. Meta lo rechaza con
// error 100 ("must be one of {feed, mention, name, ... messages, ...}"): la
// Página tiene `feed`, no `comments`. Los comentarios de Instagram se suscriben
// en el nodo del USUARIO DE INSTAGRAM, que tiene su propio `subscribed_apps`:
//
//   POST /{page-id}/subscribed_apps        → campos de Página (messages, feed…)
//   POST /{instagram-user-id}/subscribed_apps → campos de Instagram (comments…)
//
// Por eso el diagnóstico que solo miraba la Página nunca iba a ver `comments`,
// estuviera suscrito o no: estaba preguntando al objeto equivocado.
//
// -----------------------------------------------------------------------------
// DOS TRAMPAS DE LA GRAPH API, LAS DOS APRENDIDAS A GOLPES
// -----------------------------------------------------------------------------
//
//  1. `subscribed_apps` de una Página exige un PAGE access token. El token de
//     System User NO vale ahí, aunque valga para casi todo lo demás. Se deriva
//     pidiendo `/{page-id}?fields=access_token` con el de System User.
//
//  2. El POST **reemplaza** la lista entera de campos suscritos, no añade. Si se
//     manda solo `comments`, se pierde `messages` y Marta deja de contestar los
//     DMs. Por eso `suscribirCampos` lee primero lo que hay y manda la UNIÓN.
//
// Además hace falta el permiso `pages_manage_metadata` en el token: es el que
// gobierna estas suscripciones. Sin él no se pueden ni leer.
//
// El token nunca viaja en la URL, siempre en la cabecera Authorization: un
// secreto en una query string acaba en logs y en cachés.

import "server-only";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Campos de PÁGINA que necesita Marta (los DMs entran por aquí). */
export const CAMPOS_PAGINA = ["messages"] as const;

/** Campos del nodo de INSTAGRAM. `comments` solo existe aquí. */
export const CAMPOS_INSTAGRAM = ["comments", "messages"] as const;

export type GraphRes = {
  ok: boolean;
  status: number;
  code?: number;
  message?: string;
  json: unknown;
};

/**
 * Token de System User, igual que lo resuelve el webhook de Marta: para
 * diagnosticar lo mismo que corre de verdad.
 */
export function resolverTokenSystemUser(): { valor: string; variable: string } | null {
  const ig = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (ig && ig.length > 0) return { valor: ig, variable: "INSTAGRAM_ACCESS_TOKEN" };
  const wa = process.env.WHATSAPP_ACCESS_TOKEN;
  if (wa && wa.length > 0) return { valor: wa, variable: "WHATSAPP_ACCESS_TOKEN (fallback)" };
  return null;
}

/**
 * Radiografía del token SIN enseñarlo: con esto se distingue "mal pegado" de
 * "correcto pero sin permisos" sin que el secreto salga por ninguna parte.
 */
export function formaDelToken(t: string) {
  return {
    longitud: t.length,
    empiezaPor: t.slice(0, 3),
    pareceGraph: t.startsWith("EAA"),
    tieneEspaciosOSaltos: /\s/.test(t),
    tieneComillas: /["']/.test(t),
    tieneBarraNLiteral: t.includes("\\n"),
  };
}

async function graphFetch(path: string, token: string, init?: RequestInit): Promise<GraphRes> {
  try {
    const res = await fetch(`${GRAPH}${path}`, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: { code?: number; message?: string };
    };
    return {
      ok: res.ok && !json.error,
      status: res.status,
      code: json.error?.code,
      message: json.error?.message,
      json,
    };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : "network_error", json: null };
  }
}

export function graphGet(path: string, token: string): Promise<GraphRes> {
  return graphFetch(path, token);
}

export function graphPost(path: string, token: string, body: Record<string, string>): Promise<GraphRes> {
  return graphFetch(path, token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
}

/**
 * Deriva el PAGE access token a partir del de System User. Es el mismo camino
 * que ya usaba el webhook de Marta para poder mandar DMs, así que si esto falla,
 * los DMs tampoco saldrían.
 */
export async function derivarPageToken(
  pageId: string,
  systemToken: string,
): Promise<{ ok: true; token: string } | { ok: false; code?: number; message: string }> {
  const r = await graphGet(`/${pageId}?fields=access_token`, systemToken);
  const t = (r.json as { access_token?: string })?.access_token;
  if (!t) return { ok: false, code: r.code, message: r.message || `HTTP ${r.status}` };
  return { ok: true, token: t };
}

/**
 * Campos a los que un NODO está suscrito ahora mismo.
 * `nodeId` puede ser el id de la Página o el del usuario de Instagram: cada uno
 * tiene su propia lista y no se solapan.
 */
export async function leerCamposSuscritos(
  nodeId: string,
  pageToken: string,
): Promise<{ ok: true; campos: string[] } | { ok: false; code?: number; message: string }> {
  const r = await graphGet(`/${nodeId}/subscribed_apps?fields=subscribed_fields`, pageToken);
  if (!r.ok) return { ok: false, code: r.code, message: r.message || `HTTP ${r.status}` };
  const campos = (((r.json as { data?: Array<{ subscribed_fields?: string[] }> })?.data) || [])
    .flatMap((d) => d.subscribed_fields || []);
  return { ok: true, campos };
}

export type ResultadoSuscripcion = {
  ok: boolean;
  /** Nodo tocado: la Página o el usuario de Instagram. */
  nodo: string;
  nodeId: string;
  /** Campos que había ANTES de tocar nada. */
  antes: string[];
  /** Campos pedidos por quien llama. */
  pedidos: string[];
  /** Lo que se mandó de verdad: la unión de los dos, para no borrar nada. */
  enviados: string[];
  /** Campos leídos DESPUÉS, releyendo de Meta. La prueba de que funcionó. */
  despues: string[];
  /** true si todos los pedidos están en `despues`. */
  verificado: boolean;
  /** Si no se tocó nada porque ya estaban todos. */
  sinCambios: boolean;
  error?: string;
};

/**
 * Suscribe UN nodo a los campos pedidos y RELEE de Meta para comprobarlo.
 *
 * `nodeId` es la Página o el usuario de Instagram — cada uno tiene su propia
 * lista de campos y no se solapan (ver la cabecera). El token es el PAGE access
 * token ya derivado: sirve para los dos nodos.
 *
 * Sirve tal cual para la cuenta propia y para la de cualquier cliente que se
 * conecte después: lo único que cambia son los ids.
 *
 * No borra suscripciones existentes: manda la unión de lo que ya había con lo
 * que se pide, porque el POST de Graph reemplaza la lista entera.
 */
export async function suscribirNodo(
  nodo: string,
  nodeId: string,
  campos: string[],
  pageToken: string,
): Promise<ResultadoSuscripcion> {
  const base: ResultadoSuscripcion = {
    ok: false, nodo, nodeId, antes: [], pedidos: campos, enviados: [],
    despues: [], verificado: false, sinCambios: false,
  };

  const actual = await leerCamposSuscritos(nodeId, pageToken);
  if (!actual.ok) {
    const falta = (actual.message || "").includes("pages_manage_metadata");
    return {
      ...base,
      error: falta
        ? "Al token le falta el permiso `pages_manage_metadata`, que es el que gobierna estas suscripciones."
        : `No se han podido leer los campos actuales (código ${actual.code ?? "?"}): ${actual.message}`,
    };
  }
  const antes = actual.campos;

  // Si ya estaban todos, no se toca nada: una escritura que no hace falta solo
  // puede romper algo a cambio de nada.
  if (campos.every((c) => antes.includes(c))) {
    return { ...base, ok: true, antes, despues: antes, verificado: true, sinCambios: true };
  }

  // Unión, ordenada para que el resultado sea comparable entre ejecuciones.
  const union = Array.from(new Set([...antes, ...campos])).sort();
  const post = await graphPost(`/${nodeId}/subscribed_apps`, pageToken, {
    subscribed_fields: union.join(","),
  });
  if (!post.ok) {
    return { ...base, antes, enviados: union, error: `POST rechazado (código ${post.code ?? "?"}): ${post.message}` };
  }

  // Releer de Meta. Que el POST devuelva success no basta como prueba.
  const tras = await leerCamposSuscritos(nodeId, pageToken);
  if (!tras.ok) {
    return { ...base, antes, enviados: union, error: `Suscrito, pero no se ha podido releer para comprobarlo: ${tras.message}` };
  }

  return {
    ok: true, nodo, nodeId, antes, pedidos: campos, enviados: union,
    despues: tras.campos,
    verificado: campos.every((c) => tras.campos.includes(c)),
    sinCambios: false,
  };
}
