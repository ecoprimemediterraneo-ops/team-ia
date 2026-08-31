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
//
// UN TOKEN POR CLIENTE (agosto 2026)
// ----------------------------------
// Esto NACIÓ como herramienta del fundador para desbloquear el App Review: una
// sola clave, `instagram_login_token`, con el token de @ai.team.marketing. Con
// una cuenta funcionaba; con clientes no, porque cada alta eran horas de pegar
// tokens a mano en variables de entorno.
//
// Ahora cada tenant tiene la suya: `instagram_login_token:<tenantId>`. La clave
// global vieja NO se borra y se sigue leyendo como respaldo (ver `leerToken`),
// para que lo que hoy funciona siga funcionando el día del cambio.
//
// OJO: esto es solo el ALMACÉN. El camino de producción de Marta —publicar,
// DMs, respuestas públicas— sigue usando `getSystemUserToken()` de
// `marta-graph.ts`, que lee INSTAGRAM_ACCESS_TOKEN y no se ha tocado. Enchufar
// el envío real al token del cliente es otra ronda.

import "server-only";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { kvGet, kvSet, kvDelete, kvListByPrefix, supabaseEnabled } from "./supabase";

const AUTORIZAR = "https://www.instagram.com/oauth/authorize";
const CANJE_CORTO = "https://api.instagram.com/oauth/access_token";
const GRAPH_IG = "https://graph.instagram.com";

/**
 * Los campos que se le piden a `GET /me`.
 *
 * `account_type` sirve para avisar de un caso que pasa: una cuenta PERSONAL no
 * puede publicar por API. Enterarse en la pantalla de conectar es un minuto;
 * enterarse cuando falla la primera publicación son dos días.
 */
export const CAMPOS_ME = "user_id,username,profile_picture_url,account_type";

type PerfilCrudo = {
  user_id?: string | number;
  username?: string;
  profile_picture_url?: string;
  account_type?: string;
};

/**
 * La clave de antes de que esto fuera multi-cliente: un único token para toda
 * la instalación. Se conserva como RESPALDO DE LECTURA y no se escribe nunca
 * más. Borrarla dejaría sin Instagram a la cuenta propia el mismo día del
 * despliegue, sin que nadie lo notase hasta la siguiente llamada.
 */
export const CLAVE_KV_GLOBAL = "instagram_login_token";

/** Prefijo de las claves por cliente. Sirve también para recorrerlas todas. */
export const PREFIJO_KV = "instagram_login_token:";

/**
 * LA LÁPIDA: "este cliente se desconectó a propósito".
 *
 * Hace falta porque `leerToken` cae al token global antiguo cuando el cliente no
 * tiene el suyo, y ese respaldo —que en su día evitó que se apagara nada al
 * desplegar— convertía el botón de Desconectar en un botón que no hacía nada:
 * se borraba el token del cliente, la lectura caía al global, y la pantalla
 * seguía diciendo CONECTADA. Sin error y sin cambio.
 *
 * Sin marcar la desconexión no hay forma de distinguir "todavía no ha conectado"
 * —donde el respaldo tiene sentido— de "ha desconectado" —donde resucitar el
 * token viejo es justo lo que no se quiere—.
 */
export const PREFIJO_DESCONECTADO = "instagram_login_desconectado:";

function claveDesconectado(tenantId: string): string {
  return `${PREFIJO_DESCONECTADO}${tenantId}`;
}

/** Dónde vive el token de un cliente concreto. */
export function claveDeTenant(tenantId: string): string {
  return `${PREFIJO_KV}${tenantId}`;
}

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
  /** De quién es esta conexión. Ausente en el token global antiguo. */
  tenantId?: string;
  /**
   * Cuándo conectó el cliente su cuenta POR PRIMERA VEZ. Distinto de
   * `obtenido_en`, que un refresco pisa: sin este campo, a los dos meses parece
   * que el cliente se dio de alta ayer.
   */
  conectado_en?: string;
  /** Foto de perfil y tipo de cuenta, tal y como los devuelve `GET /me`. */
  foto?: string;
  tipo_cuenta?: string;
  /**
   * EL OTRO IDENTIFICADOR. Instagram devuelve DOS números distintos para la
   * misma cuenta y no lo dice en ninguna parte:
   *
   *   - el canje del código devuelve el id de la cuenta DENTRO DE LA APP
   *     (28188911044032356 en la cuenta propia);
   *   - `GET /me` devuelve el id de la cuenta de EMPRESA de Instagram
   *     (17841410811816797), que es el que trae el webhook en `entry.id` y el
   *     que usa la Graph API para publicar y mandar DMs.
   *
   * `user_id` guarda SIEMPRE el de empresa, que es el que sirve para trabajar.
   * Este campo guarda el otro, porque es el que identifica la autorización y
   * porque hay tokens ya guardados que lo tienen puesto como `user_id`.
   */
  auth_user_id?: string;
  /**
   * CUÁNDO CONFIRMÓ EL CLIENTE QUE ESA ES SU CUENTA.
   *
   * Sin este campo la conexión está a medias: el token existe y funciona, pero
   * el cliente todavía no ha dicho "sí, esa es". No es una formalidad — Meta lo
   * exige por escrito para el App Review ("asset selection... a live send action
   * from your app"), y además evita el caso real de autorizar sin querer la
   * cuenta personal en vez de la del negocio, que en Instagram se cambia con dos
   * toques y no se nota hasta que se publica donde no tocaba.
   */
  confirmado_en?: string;
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

// -----------------------------------------------------------------------------
// EL `state`: ahora lleva el tenant dentro, firmado
// -----------------------------------------------------------------------------
// Antes era una cadena al azar y el único sitio donde vivía era una cookie. Con
// un solo cliente daba igual. Con muchos, no: a la vuelta hay que saber DE QUIÉN
// es la conexión, y la cookie sola no sirve para eso —Instagram manda la vuelta
// desde su dominio, el navegador puede haber cambiado de pestaña o de sesión, y
// una cookie perdida convertiría la conexión de un cliente en la de otro—.
//
// Así que el tenant viaja en el propio `state`, FIRMADO. La firma es lo que
// impide que alguien se invente un `state` con el tenantId de otro y le enchufe
// su cuenta de Instagram. La cookie se sigue comprobando además, como segundo
// candado, pero quien manda para saber el tenant es la firma.
//
// Formato: <tenantId-b64url>.<nonce-b64url>.<hmac-b64url>

function claveDeFirma(): string {
  // La misma jerarquía que el resto de la casa: el secreto de sesión primero.
  // El de Instagram vale como respaldo porque sin él no hay OAuth que firmar.
  return process.env.AUTH_SECRET || process.env.INSTAGRAM_APP_SECRET || "dev-instagram-state";
}

const b64u = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function firmar(payload: string): string {
  return b64u(createHmac("sha256", claveDeFirma()).update(payload).digest());
}

/** Construye el `state` de ida para un cliente concreto. */
export function crearState(tenantId: string): string {
  const partes = `${b64u(tenantId)}.${b64u(randomBytes(16))}`;
  return `${partes}.${firmar(partes)}`;
}

/**
 * Comprueba la firma y devuelve el tenant. `null` si el `state` está tocado,
 * mal formado o firmado con otra clave.
 */
export function leerState(state: string | null | undefined): { tenantId: string } | null {
  if (!state) return null;
  // Trampa 2 otra vez: Instagram puede pegar "#_" también aquí.
  const limpio = state.replace(/#_$/, "").trim();
  const trozos = limpio.split(".");
  if (trozos.length !== 3) return null;

  const [tid, nonce, firma] = trozos;
  const esperada = firmar(`${tid}.${nonce}`);
  // Comparación en tiempo constante: comparar firmas con === filtra información
  // sobre cuántos caracteres se acertaron.
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const tenantId = Buffer.from(tid.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return tenantId ? { tenantId } : null;
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
export async function canjearCodigo(
  tenantId: string,
  codigoCrudo: string,
): Promise<Resultado<TokenInstagram>> {
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
  // Si el cliente ya había conectado antes, la fecha de alta se conserva: es
  // reconexión, no alta nueva.
  const previo = await kvGet<TokenInstagram>(claveDeTenant(tenantId));
  const token: TokenInstagram = {
    access_token: l.access_token,
    user_id: String(bueno.user_id ?? ""),
    permisos,
    obtenido_en: new Date(ahora).toISOString(),
    caduca_en: new Date(ahora + (l.expires_in ?? 5_184_000) * 1000).toISOString(),
    auth_user_id: String(bueno.user_id ?? ""),
    tenantId,
    conectado_en: previo?.conectado_en || new Date(ahora).toISOString(),
    // OJO: `confirmado_en` NO se hereda del token anterior. Al volver a
    // autorizar, el cliente ha podido elegir OTRA cuenta en el selector de
    // Instagram; dar por confirmada la de antes dejaría el panel enseñando un
    // @usuario que ya no es el del token.
  };

  // Con el token ya bueno, se pregunta de quién es. Si falla no se aborta: el
  // token sirve igual, solo se queda el panel sin el nombre de la cuenta.
  const quien = await pedir(
    `${GRAPH_IG}/v21.0/me?${new URLSearchParams({
      fields: CAMPOS_ME,
      access_token: token.access_token,
    }).toString()}`,
  );
  if (quien.ok) {
    const u = quien.valor as PerfilCrudo;
    token.usuario = u.username;
    token.foto = u.profile_picture_url;
    token.tipo_cuenta = u.account_type;

    // EL DE `/me` GANA. Antes solo se usaba `if (!token.user_id)`, o sea nunca,
    // porque el canje siempre trae uno. Resultado: se guardaba el id de la app y
    // la pantalla enseñaba el de empresa —que es el que devuelve esta misma
    // llamada—, así que al confirmar los dos números no cuadraban y la
    // confirmación se rechazaba a sí misma.
    if (u.user_id) token.user_id = String(u.user_id);
  } else {
    console.error(`[instagram-login] no se ha podido leer /me tenant=${tenantId}: ${tapar(quien.error)}`);
  }

  const guardado = await guardar(tenantId, token);
  if (!guardado.ok) return guardado;
  return { ok: true, valor: token };
}

async function guardar(tenantId: string, token: TokenInstagram): Promise<Resultado<TokenInstagram>> {
  if (!supabaseEnabled()) {
    return {
      ok: false,
      error:
        "No hay Supabase configurado en este entorno, así que el token no se puede guardar. " +
        "Este flujo hay que hacerlo en producción.",
    };
  }
  const clave = claveDeTenant(tenantId);
  await kvSet(clave, token);
  // Vuelve a conectar: la lápida ya no pinta nada. Si se quedara, un cliente que
  // desconecta y vuelve seguiría sin poder heredar el global el día que hiciera
  // falta.
  await kvDelete(claveDesconectado(tenantId));
  // kvSet no lanza si falla —a propósito, para no tumbar un webhook—, así que
  // se vuelve a leer. Un token que se cree guardado y no lo esté es peor que no
  // tenerlo: el flujo entero parece haber salido bien.
  const vuelta = await kvGet<TokenInstagram>(clave);
  if (!vuelta || vuelta.access_token !== token.access_token) {
    return { ok: false, error: "el token NO se ha guardado en Supabase; mira los logs del servidor." };
  }
  return { ok: true, valor: token };
}

/**
 * El token de un cliente. Sin `tenantId` lee la clave global de siempre.
 *
 * EL RESPALDO IMPORTA: si el cliente aún no ha conectado lo suyo, se cae al
 * token global antiguo. Es lo que hace que el día del despliegue no se apague
 * nada — la cuenta propia sigue funcionando con el token que ya tenía, aunque
 * su tenant no haya pasado por el OAuth nuevo.
 */
export async function leerToken(tenantId?: string): Promise<TokenInstagram | null> {
  if (!supabaseEnabled()) return null;
  if (tenantId) {
    const propio = await kvGet<TokenInstagram>(claveDeTenant(tenantId));
    if (propio) return propio;

    // Se desconectó a propósito: NO se cae al token global. Si se cayera, el
    // botón de Desconectar no serviría para nada — es literalmente el fallo que
    // arregla esta línea.
    const lapida = await kvGet<{ ts: string }>(claveDesconectado(tenantId));
    if (lapida) return null;
  }
  return kvGet<TokenInstagram>(CLAVE_KV_GLOBAL);
}

export type ResultadoDesconectar = {
  ok: boolean;
  /** La clave que se ha borrado, para que se vea en el log. */
  clave: string;
  /** Qué ha fallado, si ha fallado. */
  error?: string;
};

/**
 * Desconecta a un cliente.
 *
 * Borra SOLO lo suyo. Nunca la clave global: si se equivoca de cuenta y le da a
 * empezar de cero, no puede llevarse por delante la conexión de la casa.
 *
 * Y DEJA LA LÁPIDA, que es lo que hace que la desconexión se note. Antes solo
 * borraba, y como `leerToken` cae al token global cuando no hay del cliente, la
 * pantalla seguía enseñando la cuenta conectada: parecía que el botón estaba
 * roto cuando el borrado había funcionado.
 *
 * Se comprueba releyendo: `kvDelete` no lanza si falla, y una desconexión que se
 * cree hecha y no lo esté es peor que un error, porque nadie se entera.
 */
export async function borrarToken(tenantId?: string): Promise<ResultadoDesconectar> {
  const clave = tenantId ? claveDeTenant(tenantId) : CLAVE_KV_GLOBAL;
  if (!supabaseEnabled()) {
    return { ok: false, clave, error: "sin Supabase no se puede borrar nada" };
  }

  await kvDelete(clave);
  if (tenantId) {
    await kvSet(claveDesconectado(tenantId), { ts: new Date().toISOString() });
  }

  const sigue = await kvGet<TokenInstagram>(clave);
  if (sigue) {
    return { ok: false, clave, error: "el token sigue guardado despues de borrarlo" };
  }
  return { ok: true, clave };
}

/** Todos los clientes que tienen token propio guardado. */
export async function listarTokens(): Promise<Array<{ tenantId: string; token: TokenInstagram }>> {
  if (!supabaseEnabled()) return [];
  const filas = await kvListByPrefix<TokenInstagram>(PREFIJO_KV);
  return filas.map((f) => ({
    tenantId: f.value?.tenantId || f.key.slice(PREFIJO_KV.length),
    token: f.value,
  }));
}

export type EstadoToken = {
  hay: boolean;
  /** "tenant" = lo autorizó este cliente. "global" = respaldo del token viejo. */
  origen?: "tenant" | "global";
  conectadoEn?: string;
  usuario?: string;
  cuenta?: string;
  caduca?: string;
  diasQueQuedan?: number;
  caducado?: boolean;
  permisos?: string[];
  faltanPermisos?: string[];
  resumen: string;
};

export async function estadoToken(tenantId?: string): Promise<EstadoToken> {
  const t = await leerToken(tenantId);
  if (!t) {
    return {
      hay: false,
      resumen: "No hay token de Instagram Login. Los permisos business_* no se pueden usar.",
    };
  }
  const quedan = Math.floor((new Date(t.caduca_en).getTime() - Date.now()) / 86_400_000);
  const faltan = SCOPES.filter((s) => !t.permisos.includes(s));
  // Que se vea de dónde sale: un token heredado del global no es lo mismo que
  // uno que este cliente ha autorizado, aunque los dos funcionen.
  const origen: EstadoToken["origen"] =
    tenantId && t.tenantId === tenantId ? "tenant" : "global";
  return {
    hay: true,
    origen,
    conectadoEn: t.conectado_en,
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
export async function refrescarToken(tenantId?: string): Promise<Resultado<TokenInstagram>> {
  // A propósito NO usa el respaldo global: refrescar el token de la casa
  // creyendo que se refresca el de un cliente y guardárselo al cliente sería
  // repartir la misma conexión entre varios.
  const t = tenantId
    ? await kvGet<TokenInstagram>(claveDeTenant(tenantId))
    : await kvGet<TokenInstagram>(CLAVE_KV_GLOBAL);
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
  // Sin tenant se está refrescando la clave global antigua: se escribe donde
  // estaba, no en una clave de cliente que no existe.
  if (!tenantId) {
    if (!supabaseEnabled()) return { ok: false, error: "sin Supabase no se puede guardar" };
    await kvSet(CLAVE_KV_GLOBAL, nuevo);
    return { ok: true, valor: nuevo };
  }
  return guardar(tenantId, nuevo);
}

/**
 * Refresca el token de TODOS los clientes que tengan uno propio.
 *
 * Para el cron. Cada cliente por separado y sin cortar: si el de uno falla —le
 * quedan menos de 24 h de vida, o ya caducó y hay que volver a autorizar— los
 * demás se refrescan igual. Un barrido que se para en el primer fallo deja sin
 * refrescar a todos los que van detrás por orden alfabético.
 */
export async function refrescarTodos(): Promise<{
  total: number;
  refrescados: number;
  fallidos: Array<{ tenantId: string; error: string }>;
}> {
  const todos = await listarTokens();
  const fallidos: Array<{ tenantId: string; error: string }> = [];
  let refrescados = 0;

  for (const { tenantId } of todos) {
    const r = await refrescarToken(tenantId);
    if (r.ok) {
      refrescados++;
      console.log(`[instagram-login] token refrescado tenant=${tenantId}`);
    } else {
      fallidos.push({ tenantId, error: r.error });
      console.error(`[instagram-login] refresco FALLIDO tenant=${tenantId}: ${r.error}`);
    }
  }
  return { total: todos.length, refrescados, fallidos };
}

/**
 * El token bueno para llamar a graph.instagram.com, si lo hay.
 *
 * Devuelve null en vez de caer al del System User a propósito: ese token NO vale
 * para este host, y hacerlo pasar por bueno es justo lo que hizo que en julio
 * salieran cuatro 200 con el contador a cero.
 */
export async function tokenParaInstagramLogin(tenantId?: string): Promise<string | null> {
  const t = await leerToken(tenantId);
  if (!t) return null;
  if (new Date(t.caduca_en).getTime() < Date.now()) return null;
  return t.access_token;
}

/** Lo que necesita una pantalla para pintar "conectado como @quien, caduca el X". */
export type ConexionInstagram = {
  token: string;
  usuario?: string;
  userId: string;
  foto?: string;
  tipoCuenta?: string;
  caducaEn: string;
  diasQueQuedan: number;
  conectadoEn?: string;
  /** Cuándo pulsó "Usar esta cuenta". Sin esto, la conexión está a medias. */
  confirmadoEn?: string;
  permisos: string[];
  /** "tenant" = suyo. "global" = heredado del token único antiguo. */
  origen: "tenant" | "global";
};

/**
 * LA PUERTA DE ENTRADA: la cuenta CONFIRMADA de un cliente.
 *
 * Devuelve `null` si no hay conexión, si el token caducó, o si el cliente
 * todavía NO ha confirmado que esa es su cuenta (ver `confirmado_en`). Un token
 * sin confirmar existe y funciona, pero para el producto la cuenta aún no está
 * conectada: quien pregunte por aquí quiere saber si puede publicar en nombre
 * del cliente, y la respuesta hasta que confirme es que no.
 *
 * Un token caducado tampoco se devuelve como bueno: quien lo reciba haría la
 * llamada, se comería el error de Meta y no sabría por qué.
 *
 * EL TOKEN GLOBAL ANTIGUO SE DA POR CONFIRMADO. Es de antes de que existiera
 * este paso; exigirle una confirmación que nadie pudo dar apagaría la cuenta de
 * la casa el día del despliegue.
 */
export async function tokenInstagramDeTenant(tenantId: string): Promise<ConexionInstagram | null> {
  const t = await leerToken(tenantId);
  if (!t) return null;
  if (new Date(t.caduca_en).getTime() < Date.now()) return null;

  const heredado = t.tenantId !== tenantId;
  if (!t.confirmado_en && !heredado) return null;

  return {
    token: t.access_token,
    usuario: t.usuario,
    userId: t.user_id,
    foto: t.foto,
    tipoCuenta: t.tipo_cuenta,
    caducaEn: t.caduca_en,
    diasQueQuedan: Math.floor((new Date(t.caduca_en).getTime() - Date.now()) / 86_400_000),
    conectadoEn: t.conectado_en,
    confirmadoEn: t.confirmado_en,
    permisos: t.permisos ?? [],
    origen: heredado ? "global" : "tenant",
  };
}

// -----------------------------------------------------------------------------
// EL PASO DE ELEGIR CUENTA
// -----------------------------------------------------------------------------
// Meta lo pide por escrito para el App Review: "asset selection (Page, account,
// or number visible)". El revisor quiere ver al usuario ELIGIENDO, no una cuenta
// que aparece ya puesta.
//
// CUÁNTAS CUENTAS PUEDEN VENIR: **UNA**. Con Instagram Business Login el
// selector de cuenta lo pinta INSTAGRAM, dentro de su propio flujo de
// autorización, y el token que vuelve pertenece ya a esa cuenta. `GET /me`
// contra graph.instagram.com describe al dueño del token, y no existe ningún
// `/me/accounts` en ese host — eso es de graph.facebook.com y de Facebook Login
// for Business, que es el otro flujo, el que NO estamos construyendo.
//
// Así que la lista es de un elemento. Se modela como array igualmente para no
// tener que rehacer la pantalla el día que se añada Facebook Login, y sobre todo
// para no mentir: se enseña lo que Meta devuelve, ni una fila más.

export type CuentaCandidata = {
  userId: string;
  usuario?: string;
  foto?: string;
  tipoCuenta?: string;
};

export type CuentasDisponibles = {
  cuentas: CuentaCandidata[];
  /** Qué contestó Meta, si contestó mal. Para enseñarlo sin adivinar. */
  error?: string;
  /** true si los datos salen de lo guardado porque la llamada a Meta falló. */
  deCache: boolean;
};

/**
 * Le pregunta a Meta qué cuenta hay detrás del token de este cliente.
 *
 * Si la llamada falla se cae a lo que se guardó en el canje en vez de dejar la
 * pantalla vacía: el cliente ya autorizó, y quedarse sin poder confirmar por un
 * corte de red sería perder el alta entera.
 */
export async function cuentasDisponibles(tenantId: string): Promise<CuentasDisponibles> {
  const t = await leerToken(tenantId);
  if (!t) return { cuentas: [], deCache: false };

  const r = await pedir(
    `${GRAPH_IG}/v21.0/me?${new URLSearchParams({
      fields: CAMPOS_ME,
      access_token: t.access_token,
    }).toString()}`,
  );

  if (r.ok) {
    const u = r.valor as PerfilCrudo;
    return {
      cuentas: [
        {
          userId: String(u.user_id ?? t.user_id ?? ""),
          usuario: u.username ?? t.usuario,
          foto: u.profile_picture_url ?? t.foto,
          tipoCuenta: u.account_type ?? t.tipo_cuenta,
        },
      ],
      deCache: false,
    };
  }

  console.error(`[instagram-login] no se ha podido leer /me tenant=${tenantId}: ${tapar(r.error)}`);
  return {
    cuentas: t.user_id || t.usuario
      ? [{ userId: t.user_id, usuario: t.usuario, foto: t.foto, tipoCuenta: t.tipo_cuenta }]
      : [],
    error: r.error,
    deCache: true,
  };
}

/**
 * La conexión que existe pero AÚN NO se ha confirmado.
 *
 * Es lo que hace que el paso de elegir reaparezca si el cliente se va a medias
 * en vez de dejarle un estado raro que no se entiende.
 */
export async function conexionPendienteDeTenant(tenantId: string): Promise<ConexionInstagram | null> {
  if (!supabaseEnabled()) return null;
  const t = await kvGet<TokenInstagram>(claveDeTenant(tenantId));
  if (!t || t.confirmado_en) return null;
  if (new Date(t.caduca_en).getTime() < Date.now()) return null;

  return {
    token: t.access_token,
    usuario: t.usuario,
    userId: t.user_id,
    foto: t.foto,
    tipoCuenta: t.tipo_cuenta,
    caducaEn: t.caduca_en,
    diasQueQuedan: Math.floor((new Date(t.caduca_en).getTime() - Date.now()) / 86_400_000),
    conectadoEn: t.conectado_en,
    permisos: t.permisos ?? [],
    origen: "tenant",
  };
}

/**
 * El cliente ha pulsado "Usar esta cuenta". A partir de aquí está conectada.
 *
 * Se comprueba que el id confirmado es el del token: si el cliente dejó la
 * pantalla abierta, volvió a autorizar en otra pestaña con otra cuenta y luego
 * confirmó la vieja, se estaría dando por buena una cuenta que ya no es la del
 * token guardado.
 */
/** Por qué no se ha podido confirmar. La pantalla lo traduce a una frase. */
export type FalloConfirmar = "sin_almacen" | "sin_token" | "otra_cuenta" | "no_guarda";

export async function confirmarCuenta(
  tenantId: string,
  userId: string,
): Promise<{ ok: true; valor: TokenInstagram } | { ok: false; fallo: FalloConfirmar; error: string }> {
  if (!supabaseEnabled()) {
    console.error(`[instagram-confirmar] sin Supabase tenant=${tenantId}`);
    return { ok: false, fallo: "sin_almacen", error: "sin Supabase no se puede guardar la confirmación" };
  }

  const t = await kvGet<TokenInstagram>(claveDeTenant(tenantId));
  if (!t) {
    console.error(`[instagram-confirmar] NO HAY TOKEN tenant=${tenantId} pedido=${userId}`);
    return { ok: false, fallo: "sin_token", error: "no hay ninguna conexión pendiente que confirmar" };
  }

  // SE LE PREGUNTA A META DE QUIÉN ES EL TOKEN. NO se comparan los ids guardados.
  //
  // Comparar cadenas guardadas no puede funcionar y esto ya costó un intento:
  // Instagram da DOS números para la misma cuenta —el del canje del código y el
  // de la cuenta de empresa que devuelve `/me`— y los tokens guardados por la
  // versión anterior traen el del canje metido en `user_id`, sin rastro del
  // otro. Para uno de esos no existe ninguna cadena guardada igual al id que
  // enseña la pantalla, así que "acepta cualquiera de los dos" seguía diciendo
  // que no.
  //
  // Lo único que sabe de verdad a quién pertenece un token es Meta, y el token
  // es la prueba: la misma llamada que usó la pantalla para pintar la cuenta
  // sirve para comprobarla. Y de paso se ARREGLA el registro viejo, poniendo el
  // id bueno donde toca. Así la conexión que ya existe se cura sola en vez de
  // obligar a volver a autorizar.
  const quien = await pedir(
    `${GRAPH_IG}/v21.0/me?${new URLSearchParams({
      fields: CAMPOS_ME,
      access_token: t.access_token,
    }).toString()}`,
  );

  let deMeta: string | undefined;
  if (quien.ok) {
    deMeta = String((quien.valor as PerfilCrudo).user_id ?? "");
  } else {
    console.error(`[instagram-confirmar] /me no responde tenant=${tenantId}: ${tapar(quien.error)}`);
  }

  // Si Meta contesta, manda Meta. Si no contesta —un corte de red no puede
  // dejar a un cliente sin poder terminar el alta—, se cae a los ids guardados.
  const guardados = [t.user_id, t.auth_user_id].filter(Boolean) as string[];
  const validos = deMeta ? [deMeta, ...guardados] : guardados;
  const cuadra = !userId || validos.length === 0 || validos.includes(userId);

  console.log(
    `[instagram-confirmar] tenant=${tenantId} pedido=${userId || "?"} ` +
      `meta=${deMeta || "no responde"} token.user_id=${t.user_id || "?"} ` +
      `token.auth_user_id=${t.auth_user_id || "?"} cuenta=@${t.usuario ?? "?"} cuadra=${cuadra}`,
  );

  if (!cuadra) {
    return {
      ok: false,
      fallo: "otra_cuenta",
      error:
        `el permiso guardado es de la cuenta ${deMeta || guardados.join(" / ")}, ` +
        `y se está confirmando la ${userId}`,
    };
  }

  // Se cura el registro: el id de empresa pasa a `user_id` y el del canje, que
  // en los tokens viejos ocupaba su sitio, se queda en `auth_user_id`.
  const arreglado: TokenInstagram = { ...t, confirmado_en: new Date().toISOString() };
  if (deMeta && t.user_id !== deMeta) {
    console.log(
      `[instagram-confirmar] ARREGLANDO el id guardado tenant=${tenantId}: ` +
        `user_id ${t.user_id || "?"} -> ${deMeta} (el viejo pasa a auth_user_id)`,
    );
    arreglado.auth_user_id = t.auth_user_id || t.user_id;
    arreglado.user_id = deMeta;
  }

  const r = await guardar(tenantId, arreglado);
  console.log(
    `[instagram-confirmar] tenant=${tenantId} resultado=${r.ok ? "CONFIRMADA" : `FALLIDA: ${r.error}`}`,
  );
  return r.ok ? r : { ok: false, fallo: "no_guarda", error: r.error };
}
