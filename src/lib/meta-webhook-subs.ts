// Suscripciones del webhook de una Página de Meta.
//
// Una Página no recibe nada del webhook por el hecho de estar conectada: hay que
// suscribirla a CADA campo que se quiera recibir, y cada campo es una cosa
// distinta. Marta necesita dos:
//
//   - `messages` → los DMs de Instagram, que entran en `entry[].messaging`.
//   - `comments` → los comentarios en los posts, que entran en `entry[].changes`
//                  con `field: "comments"`.
//
// Estar suscrito a uno no implica estar suscrito al otro. Ese fue exactamente el
// síntoma que costó encontrar: Marta contestaba los DMs y no reaccionaba a los
// comentarios, porque el comentario no llegaba nunca.
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

/** Los dos campos que necesita Marta. El orden no importa. */
export const CAMPOS_MARTA = ["messages", "comments"] as const;

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

/** Campos a los que la Página está suscrita ahora mismo. */
export async function leerCamposSuscritos(
  pageId: string,
  pageToken: string,
): Promise<{ ok: true; campos: string[] } | { ok: false; code?: number; message: string }> {
  const r = await graphGet(`/${pageId}/subscribed_apps?fields=subscribed_fields`, pageToken);
  if (!r.ok) return { ok: false, code: r.code, message: r.message || `HTTP ${r.status}` };
  const campos = (((r.json as { data?: Array<{ subscribed_fields?: string[] }> })?.data) || [])
    .flatMap((d) => d.subscribed_fields || []);
  return { ok: true, campos };
}

export type ResultadoSuscripcion = {
  ok: boolean;
  pageId: string;
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
 * Suscribe una Página a los campos pedidos y RELEE para comprobarlo.
 *
 * Sirve tal cual para la cuenta propia y para la de cualquier cliente que se
 * conecte después: lo único que cambia es el `pageId`.
 *
 * No borra suscripciones existentes: manda la unión de lo que ya había con lo
 * que se pide (ver la trampa 2 de la cabecera).
 */
export async function suscribirCampos(
  pageId: string,
  campos: string[],
  systemToken: string,
): Promise<ResultadoSuscripcion> {
  const base: ResultadoSuscripcion = {
    ok: false, pageId, antes: [], pedidos: campos, enviados: [], despues: [],
    verificado: false, sinCambios: false,
  };

  const page = await derivarPageToken(pageId, systemToken);
  if (!page.ok) {
    return { ...base, error: `No se ha podido derivar el Page token (código ${page.code ?? "?"}): ${page.message}` };
  }

  const actual = await leerCamposSuscritos(pageId, page.token);
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

  // Unión, y estable en el orden para que el resultado sea comparable.
  const union = Array.from(new Set([...antes, ...campos])).sort();

  // Si ya estaban todos, no se toca nada: una llamada de escritura que no hace
  // falta es una oportunidad de romper algo a cambio de nada.
  if (campos.every((c) => antes.includes(c))) {
    return { ...base, ok: true, antes, enviados: [], despues: antes, verificado: true, sinCambios: true };
  }

  const post = await graphPost(`/${pageId}/subscribed_apps`, page.token, {
    subscribed_fields: union.join(","),
  });
  if (!post.ok) {
    return { ...base, antes, enviados: union, error: `POST rechazado (código ${post.code ?? "?"}): ${post.message}` };
  }

  // Releer de Meta. Que el POST devuelva success no basta como prueba.
  const tras = await leerCamposSuscritos(pageId, page.token);
  if (!tras.ok) {
    return { ...base, antes, enviados: union, error: `Suscrito, pero no se ha podido releer para comprobarlo: ${tras.message}` };
  }

  return {
    ok: true,
    pageId,
    antes,
    pedidos: campos,
    enviados: union,
    despues: tras.campos,
    verificado: campos.every((c) => tras.campos.includes(c)),
    sinCambios: false,
  };
}
