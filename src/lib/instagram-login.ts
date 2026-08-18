// Instagram Business Login: el OAuth nativo de Instagram.
//
// ¿POR QUÉ EXISTE ESTO SI YA TENÍAMOS UN TOKEN?
// ---------------------------------------------
// El token del System User (INSTAGRAM_ACCESS_TOKEN) es válido, es de la app
// correcta y trae 17 permisos. Pero NINGUNO de los cuatro instagram_business_*,
// y no vale contra graph.instagram.com. Comprobado el 17/08/2026 con
// /api/admin/instagram-app-review.
//
// Esos cuatro permisos NO se pueden conceder desde el Business Manager. Solo
// salen de este flujo: el usuario entra por instagram.com, autoriza, y el código
// que vuelve se canjea por un token de Instagram. Sin eso, los cuatro permisos
// se quedan a cero llamadas y el App Review no se puede ni enviar.
//
// LAS TRES TRAMPAS DE ESTE FLUJO (las tres nos han costado tiempo ya)
// -------------------------------------------------------------------
// 1. El client_id NO es el App ID de Meta (2156272571817837). Es el "Instagram
//    App ID", otro número distinto que aparece en Instagram > API setup with
//    Instagram login. Y el client_secret es el "Instagram App Secret", tampoco
//    el META_APP_SECRET. Mezclarlos da un error de credenciales que parece un
//    problema de permisos.
// 2. Instagram añade "#_" al final de la URL de vuelta. No es parte del código.
//    Si no se quita, el canje falla diciendo que el código no vale.
// 3. El redirect_uri tiene que coincidir CARÁCTER A CARÁCTER con el que está
//    dado de alta en el panel, también en el canje. Por eso aquí es una
//    constante y no se deduce del host de la petición: deducirlo significa que
//    en preview vale una cosa y en producción otra, y el fallo aparece en el
//    canje, no en el login, que es donde nadie lo busca.
//
// Los tokens de este flujo CADUCAN A LOS 60 DÍAS. Se pueden refrescar mientras
// estén vivos y tengan más de 24 horas. Si caduca, hay que volver a autorizar a
// mano. Por eso el panel enseña la fecha.

import "server-only";
import { kvGet, kvSet, kvDelete, supabaseEnabled } from "./supabase";

const AUTORIZAR = "https://www.instagram.com/oauth/authorize";
const CANJE_CORTO = "https://api.instagram.com/oauth/access_token";
const GRAPH_IG = "https://graph.instagram.com";

export const CLAVE_KV = "instagram_login_token";

/** Cookie donde viaja el `state` entre la salida y la vuelta del OAuth. */
export const COOKIE_STATE = "ig_login_state";

/** Los cuatro que bloquean el App Review, en el orden en que Meta los lista. */
export const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_content_publish",
] as const;

/**
 * Fija, no deducida del host. Tiene que estar dada de alta tal cual en
 * Instagram > API setup with Instagram login > Business login settings.
 */
export const REDIRECT_URI =
  process.env.INSTAGRAM_REDIRECT_URI || "https://aiteam.marketing/api/instagram/callback";

export type TokenInstagram = {
  access_token: string;
  user_id: string;
  /** Los permisos que Instagram dice que trae el token. */
  permisos: string[];
  obtenido_en: string;
  caduca_en: string;
  refrescado_en?: string;
  /** Cuenta que autorizó, para que en el panel se vea que es la que toca. */
  usuario?: string;
};

export function credenciales() {
  return {
    appId: process.env.INSTAGRAM_APP_ID || "",
    secret: process.env.INSTAGRAM_APP_SECRET || "",
  };
}

export function configurado(): boolean {
  const { appId, secret } = credenciales();
  return appId.length > 0 && secret.length > 0;
}

/** Tapa el token, el secreto de Instagram y el de Meta en cualquier texto. */
export function tapar(t: unknown, extra?: string): string {
  const { secret } = credenciales();
  let s = typeof t === "string" ? t : JSON.stringify(t);
  for (const v of [extra, secret, process.env.META_APP_SECRET, process.env.INSTAGRAM_ACCESS_TOKEN]) {
    if (v && v.length > 6) s = s.split(v).join("«oculto»");
  }
  return s.replace(/(EAA|IGAA|IGQ)[A-Za-z0-9_.-]{20,}/g, "«token oculto»").slice(0, 500);
}

export function urlDeAutorizacion(state: string): string {
  const { appId } = credenciales();
  const q = new URLSearchParams({
    client_id: appId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(","),
    state,
  });
  return `${AUTORIZAR}?${q.toString()}`;
}

type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

async function pedir(url: string, opciones: RequestInit = {}): Promise<Resultado<Record<string, unknown>>> {
  let res: Response;
  try {
    res = await fetch(url, { ...opciones, signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    return { ok: false, error: `no se pudo conectar: ${e instanceof Error ? e.message : String(e)}` };
  }
  const txt = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(txt) as Record<string, unknown>;
  } catch {
    return { ok: false, error: `HTTP ${res.status}, respuesta que no es JSON: ${tapar(txt)}` };
  }
  if (!res.ok) {
    // Instagram devuelve dos formatos distintos según el endpoint, y en los dos
    // puede venir el token dentro del mensaje. Se tapa siempre.
    const e = json as {
      error_message?: string; error_type?: string; code?: number;
      error?: { message?: string; type?: string; code?: number; fbtrace_id?: string };
    };
    const msg =
      e.error_message ??
      e.error?.message ??
      JSON.stringify(json);
    const tipo = e.error_type ?? e.error?.type ?? "";
    const traza = e.error?.fbtrace_id ? ` · fbtrace_id ${e.error.fbtrace_id}` : "";
    return { ok: false, error: `HTTP ${res.status} · ${tapar(msg)}${tipo ? ` (${tipo})` : ""}${traza}` };
  }
  return { ok: true, valor: json };
}

/**
 * El código que vuelve en la URL → token de larga duración, guardado.
 *
 * Son DOS canjes: primero uno corto (1 hora) contra api.instagram.com, y ese se
 * cambia por el de 60 días contra graph.instagram.com. Saltarse el segundo deja
 * un token que muere esa misma tarde.
 */
export async function canjearCodigo(codigoCrudo: string): Promise<Resultado<TokenInstagram>> {
  const { appId, secret } = credenciales();
  if (!appId || !secret) {
    return { ok: false, error: "Faltan INSTAGRAM_APP_ID y/o INSTAGRAM_APP_SECRET en el entorno." };
  }

  // Trampa 2: Instagram pega "#_" al final. Y algunos navegadores lo dejan
  // dentro del parámetro.
  const codigo = codigoCrudo.replace(/#_$/, "").trim();

  const corto = await pedir(CANJE_CORTO, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: secret,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code: codigo,
    }).toString(),
  });
  if (!corto.ok) return { ok: false, error: `canje del código: ${corto.error}` };

  // Dos formas posibles de respuesta: plana, o envuelta en `data: [...]`.
  const plano = corto.valor as { access_token?: string; user_id?: string | number; permissions?: string[] | string };
  const dentro = Array.isArray(corto.valor.data)
    ? ((corto.valor.data as unknown[])[0] as typeof plano | undefined)
    : undefined;
  const bueno = plano.access_token ? plano : dentro;

  if (!bueno?.access_token) {
    return { ok: false, error: `el canje no ha devuelto token: ${tapar(corto.valor)}` };
  }

  const permisos = Array.isArray(bueno.permissions)
    ? bueno.permissions
    : typeof bueno.permissions === "string"
      ? bueno.permissions.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

  const largo = await pedir(
    `${GRAPH_IG}/access_token?${new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: secret,
      access_token: bueno.access_token,
    }).toString()}`,
  );
  if (!largo.ok) return { ok: false, error: `paso a token de 60 días: ${largo.error}` };

  const l = largo.valor as { access_token?: string; expires_in?: number };
  if (!l.access_token) {
    return { ok: false, error: `no ha llegado el token largo: ${tapar(largo.valor)}` };
  }

  const ahora = Date.now();
  const token: TokenInstagram = {
    access_token: l.access_token,
    user_id: String(bueno.user_id ?? ""),
    permisos,
    obtenido_en: new Date(ahora).toISOString(),
    caduca_en: new Date(ahora + (l.expires_in ?? 5_184_000) * 1000).toISOString(),
  };

  // Con el token ya bueno, se pregunta de quién es. Si falla no se aborta: el
  // token sirve igual, solo se queda el panel sin el nombre de la cuenta.
  const quien = await pedir(
    `${GRAPH_IG}/v21.0/me?fields=user_id,username&access_token=${encodeURIComponent(token.access_token)}`,
  );
  if (quien.ok) {
    const u = quien.valor as { username?: string; user_id?: string | number };
    token.usuario = u.username;
    if (!token.user_id && u.user_id) token.user_id = String(u.user_id);
  }

  const guardado = await guardar(token);
  if (!guardado.ok) return guardado;
  return { ok: true, valor: token };
}

async function guardar(token: TokenInstagram): Promise<Resultado<TokenInstagram>> {
  if (!supabaseEnabled()) {
    return {
      ok: false,
      error:
        "No hay Supabase configurado en este entorno, así que el token no se puede guardar. " +
        "Este flujo hay que hacerlo en producción.",
    };
  }
  await kvSet(CLAVE_KV, token);
  // kvSet no lanza si falla —a propósito, para no tumbar un webhook—, así que
  // se vuelve a leer. Un token que se cree guardado y no lo esté es peor que no
  // tenerlo: el flujo entero parece haber salido bien.
  const vuelta = await kvGet<TokenInstagram>(CLAVE_KV);
  if (!vuelta || vuelta.access_token !== token.access_token) {
    return { ok: false, error: "el token NO se ha guardado en Supabase; mira los logs del servidor." };
  }
  return { ok: true, valor: token };
}

export async function leerToken(): Promise<TokenInstagram | null> {
  if (!supabaseEnabled()) return null;
  return kvGet<TokenInstagram>(CLAVE_KV);
}

export async function borrarToken(): Promise<void> {
  if (supabaseEnabled()) await kvDelete(CLAVE_KV);
}

export type EstadoToken = {
  hay: boolean;
  usuario?: string;
  cuenta?: string;
  caduca?: string;
  diasQueQuedan?: number;
  caducado?: boolean;
  permisos?: string[];
  faltanPermisos?: string[];
  resumen: string;
};

export async function estadoToken(): Promise<EstadoToken> {
  const t = await leerToken();
  if (!t) {
    return {
      hay: false,
      resumen: "No hay token de Instagram Login. Los permisos business_* no se pueden usar.",
    };
  }
  const quedan = Math.floor((new Date(t.caduca_en).getTime() - Date.now()) / 86_400_000);
  const faltan = SCOPES.filter((s) => !t.permisos.includes(s));
  return {
    hay: true,
    usuario: t.usuario,
    cuenta: t.user_id,
    caduca: t.caduca_en,
    diasQueQuedan: quedan,
    caducado: quedan < 0,
    permisos: t.permisos,
    faltanPermisos: faltan,
    resumen:
      quedan < 0
        ? `CADUCADO hace ${-quedan} días. Hay que volver a autorizar a mano.`
        : quedan <= 7
          ? `Caduca en ${quedan} días. Refréscalo ya.`
          : `Vivo, caduca en ${quedan} días${faltan.length ? `, pero le faltan permisos: ${faltan.join(", ")}` : ""}.`,
  };
}

/**
 * Estira el token otros 60 días. Meta solo lo permite si está vivo y tiene más
 * de 24 horas; con un token recién sacado responde que no, y eso no es un fallo.
 */
export async function refrescarToken(): Promise<Resultado<TokenInstagram>> {
  const t = await leerToken();
  if (!t) return { ok: false, error: "no hay token guardado que refrescar" };

  const r = await pedir(
    `${GRAPH_IG}/refresh_access_token?${new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: t.access_token,
    }).toString()}`,
  );
  if (!r.ok) return { ok: false, error: r.error };

  const v = r.valor as { access_token?: string; expires_in?: number };
  if (!v.access_token) return { ok: false, error: `respuesta sin token: ${tapar(r.valor)}` };

  const nuevo: TokenInstagram = {
    ...t,
    access_token: v.access_token,
    caduca_en: new Date(Date.now() + (v.expires_in ?? 5_184_000) * 1000).toISOString(),
    refrescado_en: new Date().toISOString(),
  };
  return guardar(nuevo);
}

/**
 * El token bueno para llamar a graph.instagram.com, si lo hay.
 *
 * Devuelve null en vez de caer al del System User a propósito: ese token NO vale
 * para este host, y hacerlo pasar por bueno es justo lo que hizo que en julio
 * salieran cuatro 200 con el contador a cero.
 */
export async function tokenParaInstagramLogin(): Promise<string | null> {
  const t = await leerToken();
  if (!t) return null;
  if (new Date(t.caduca_en).getTime() < Date.now()) return null;
  return t.access_token;
}
