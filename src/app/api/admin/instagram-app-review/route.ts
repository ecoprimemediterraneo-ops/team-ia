// /api/admin/instagram-app-review — founder-only.
//
//   GET              inspecciona el token y dice qué permisos trae. No llama a nada.
//   GET ?llamar=1    hace las CUATRO llamadas de la familia instagram_business_*,
//                    publicando de verdad en la cuenta.
//
// PARA QUÉ: Meta no deja enviar el App Review hasta que cada permiso registre al
// menos una llamada real. Mientras la columna esté a cero, el botón de enviar no
// se activa.
//
// POR QUÉ AQUÍ Y NO EN UN SCRIPT: el token y el App Secret ya están en el
// entorno de producción. Pasarlos a mano por la terminal es como se acaba
// enseñando un secreto en una captura de pantalla — pasó. Aquí no se teclea
// nada: se abre una URL con la sesión de fundador y el servidor usa lo que ya
// tiene.
//
// EL FALLO DE JULIO, que esta ruta evita: se llamó a graph.facebook.com con un
// token de Página. Salieron tres 200 y el contador siguió a cero, porque esos
// endpoints registran la familia VIEJA (instagram_manage_*), la del producto
// "Instagram Graph API" con Facebook Login. Los instagram_business_* son de otro
// producto —"Instagram API con Instagram Login"— y sus llamadas van a
// graph.instagram.com. Por eso aquí se detecta qué host acepta el token y se
// dice cuál se ha usado, en vez de suponerlo.
//
// NUNCA se devuelve el token ni el App Secret. Ni siquiera dentro de un mensaje
// de error de Meta, que los devuelve enteros ("Malformed access token EAA…").

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VERSION = "v21.0";
const FB = `https://graph.facebook.com/${VERSION}`;
const IG = `https://graph.instagram.com/${VERSION}`;

const IG_USER_ID = process.env.INSTAGRAM_USER_ID || "17841410811816797";
const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "1110804952118807";

/** La portada de marca que genera la propia web, pasada a JPG 1080x1080. */
const IMAGEN =
  "https://wsrv.nl/?url=aiteam.marketing/api/og/post%3Ffrase%3DTu%2520equipo%2520de%2520IA%252C%2520trabajando%26rol%3DAI-TEAM&output=jpg&w=1080&h=1080";

// Sin emojis, como el resto de lo que escribe la casa.
const PIE = `En AI-Team montamos agentes de IA que trabajan por tu negocio: contestan el WhatsApp, cuadran las citas y llevan las redes.

Menos tareas repetidas, mas tiempo para lo que importa.

Mas en aiteam.marketing

#IA #Automatizacion #PYMES #InteligenciaArtificial`;

const PERMISOS = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
] as const;

function credenciales() {
  // El de Instagram manda; el de WhatsApp es el mismo System User y sirve de
  // respaldo, que es como lo resuelve el resto del sistema.
  const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || "";
  return {
    token,
    deDonde: process.env.INSTAGRAM_ACCESS_TOKEN ? "INSTAGRAM_ACCESS_TOKEN" : "WHATSAPP_ACCESS_TOKEN",
    secret: process.env.META_APP_SECRET || "",
    appId: process.env.META_APP_ID || "2156272571817837",
  };
}

/** Tapa el token y el App Secret en cualquier cosa que se vaya a devolver. */
function tapar(t: unknown): string {
  const { token, secret } = credenciales();
  let s = typeof t === "string" ? t : JSON.stringify(t);
  if (token) s = s.split(token).join("«token oculto»");
  if (secret) s = s.split(secret).join("«app secret oculto»");
  return s.replace(/(EAA|IGAA)[A-Za-z0-9_-]{15,}/g, "«token oculto»").slice(0, 400);
}

type Respuesta = { ok: boolean; status: number; json: Record<string, unknown> };

async function llamar(url: string, opciones: RequestInit = {}): Promise<Respuesta> {
  try {
    const res = await fetch(url, { ...opciones, signal: AbortSignal.timeout(15_000) });
    const txt = await res.text();
    let json: Record<string, unknown>;
    try { json = JSON.parse(txt); } catch { json = { raw: txt.slice(0, 300) }; }
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return { ok: false, status: 0, json: { error: { message: e instanceof Error ? e.message : String(e) } } };
  }
}

/** El error de Meta entero, que es lo que hace falta para arreglarlo. */
function errorDe(r: Respuesta): string | null {
  const e = r.json?.error as
    | { message?: string; type?: string; code?: number; error_subcode?: number; error_user_msg?: string; fbtrace_id?: string }
    | undefined;
  if (!e) return null;
  const partes = [
    tapar(e.message ?? "sin mensaje"),
    e.type ? `tipo ${e.type}` : "",
    e.code ? `código ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""}` : "",
    e.error_user_msg ? `· ${tapar(e.error_user_msg)}` : "",
    e.fbtrace_id ? `· fbtrace_id ${e.fbtrace_id}` : "",
  ].filter(Boolean);
  return partes.join(" · ");
}

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { token, deDonde, secret, appId } = credenciales();
  const llamarDeVerdad = new URL(req.url).searchParams.get("llamar") === "1";

  if (!token) {
    return NextResponse.json({
      veredicto: "NO HAY TOKEN en el entorno del servidor. Sin él no se puede llamar a nada.",
      revisa: "INSTAGRAM_ACCESS_TOKEN (o WHATSAPP_ACCESS_TOKEN) en Vercel.",
    });
  }

  const info: Record<string, unknown> = {
    tokenSacadoDe: deDonde,
    token: `${token.length} caracteres (no se muestra)`,
    appSecret: secret ? `${secret.length} caracteres (no se muestra)` : "NO PUESTO",
    cuentaInstagram: IG_USER_ID,
  };

  // --- 1. ¿Qué permisos trae el token? -------------------------------------
  // debug_token NO puede inspeccionarse a sí mismo: el `access_token` tiene que
  // ser un token de aplicación (APP_ID|APP_SECRET) y el token a mirar va en
  // `input_token`. Pasando el mismo token en los dos sitios, Meta contesta un
  // error y parece que el token está roto cuando lo que está mal es la pregunta.
  let permisos: string[] = [];
  if (!secret) {
    info.debugToken = "no se ha podido comprobar: falta META_APP_SECRET en el entorno";
  } else {
    const d = await llamar(
      `${FB}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(`${appId}|${secret}`)}`,
    );
    const data = (d.json?.data ?? {}) as {
      scopes?: string[]; is_valid?: boolean; app_id?: string; type?: string; expires_at?: number;
    };
    permisos = data.scopes ?? [];
    info.debugToken = d.ok
      ? {
          valido: data.is_valid ?? null,
          tipo: data.type ?? null,
          appDelToken: data.app_id ?? null,
          appEsperada: appId,
          mismaApp: data.app_id ? data.app_id === appId : null,
          caduca: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : "no caduca",
          permisos,
        }
      : { error: errorDe(d) ?? `HTTP ${d.status}`, respuestaCruda: tapar(d.json) };
  }

  const faltan = PERMISOS.filter((p) => !permisos.includes(p));
  info.permisosBusinessQueFaltan = permisos.length ? (faltan.length ? faltan : "ninguno, están los cuatro") : "no se han podido leer";

  // --- 2. ¿Qué host acepta este token? -------------------------------------
  const pruebaIg = await llamar(`${IG}/me?fields=id,username&access_token=${encodeURIComponent(token)}`);
  const enInstagram = pruebaIg.ok;
  const HOST = enInstagram ? IG : FB;
  const BASE = enInstagram ? "me" : IG_USER_ID;
  info.host = enInstagram ? "graph.instagram.com" : "graph.facebook.com";
  if (!enInstagram) {
    info.porQueNoInstagram = errorDe(pruebaIg) ?? `HTTP ${pruebaIg.status}`;
    info.aviso =
      "El token NO vale contra graph.instagram.com, que es el host de la familia instagram_business_*. " +
      "Las llamadas irán por graph.facebook.com y puede que registren la familia vieja (instagram_manage_*), " +
      "que es exactamente lo que pasó en julio.";
  }

  if (!llamarDeVerdad) {
    return NextResponse.json({
      veredicto: permisos.length
        ? faltan.length
          ? `Al token le faltan ${faltan.length} permiso(s) business_*: ${faltan.join(", ")}. Las llamadas registrarían el permiso equivocado.`
          : "El token trae los cuatro permisos. Abre esta misma dirección con ?llamar=1 para hacer las llamadas."
        : "No se han podido leer los permisos del token. Puedes intentar las llamadas igualmente con ?llamar=1: el resultado dirá si sirve.",
      ...info,
      paraLlamar: "Añade ?llamar=1 a esta dirección. Publicará de verdad en la cuenta.",
    });
  }

  // =========================================================================
  // Las cuatro llamadas
  // =========================================================================
  const detalle: Array<{ permiso: string; http: number; endpoint: string; resultado: string }> = [];
  const anota = (permiso: string, r: Respuesta, endpoint: string) => {
    detalle.push({ permiso, http: r.status, endpoint, resultado: r.ok ? "200 OK" : errorDe(r) ?? `HTTP ${r.status}` });
    return r.ok;
  };

  // 1) basic
  const basic = await llamar(`${HOST}/${BASE}?fields=id,username,account_type&access_token=${encodeURIComponent(token)}`);
  anota("instagram_business_basic", basic, `GET /${BASE}?fields=id,username`);
  if (basic.ok) info.cuenta = `@${(basic.json as { username?: string }).username ?? "?"}`;

  // 2) content_publish — publica de verdad
  let permalink: string | null = null;
  let mediaId = "";
  const cuerpo = new URLSearchParams({ image_url: IMAGEN, caption: PIE, access_token: token });
  const cont = await llamar(`${HOST}/${BASE}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: cuerpo.toString(),
  });
  const creationId = (cont.json as { id?: string }).id ?? "";

  if (!cont.ok || !creationId) {
    anota("instagram_business_content_publish", cont, `POST /${BASE}/media`);
  } else {
    // El contenedor tarda unos segundos en quedar listo; publicar antes falla.
    let estado = "";
    for (let i = 0; i < 6; i++) {
      const st = await llamar(`${HOST}/${creationId}?fields=status_code&access_token=${encodeURIComponent(token)}`);
      estado = ((st.json as { status_code?: string }).status_code ?? "").toUpperCase();
      if (estado === "FINISHED" || estado === "ERROR") break;
      await new Promise((r) => setTimeout(r, 2500));
    }
    if (estado !== "FINISHED") {
      detalle.push({
        permiso: "instagram_business_content_publish",
        http: cont.status,
        endpoint: `POST /${BASE}/media`,
        resultado: `el contenedor se quedó en "${estado || "sin estado"}" y no se pudo publicar`,
      });
    } else {
      const pub = await llamar(`${HOST}/${BASE}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ creation_id: creationId, access_token: token }).toString(),
      });
      anota("instagram_business_content_publish", pub, `POST /${BASE}/media + /media_publish`);
      mediaId = (pub.json as { id?: string }).id ?? "";
      if (mediaId) {
        const m = await llamar(`${HOST}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`);
        permalink = (m.json as { permalink?: string }).permalink ?? null;
      }
    }
  }

  // 3) manage_comments — sobre la publicación nueva, o la última que haya
  if (!mediaId) {
    const lista = await llamar(`${HOST}/${BASE}/media?fields=id&limit=1&access_token=${encodeURIComponent(token)}`);
    mediaId = ((lista.json as { data?: Array<{ id: string }> }).data ?? [])[0]?.id ?? "";
  }
  if (mediaId) {
    const c = await llamar(`${HOST}/${mediaId}/comments?fields=id,text,username&access_token=${encodeURIComponent(token)}`);
    anota("instagram_business_manage_comments", c, `GET /${mediaId}/comments`);
  } else {
    detalle.push({
      permiso: "instagram_business_manage_comments",
      http: 0,
      endpoint: "—",
      resultado: "no hay ninguna publicación en la cuenta contra la que llamar",
    });
  }

  // 4) manage_messages
  const conv = await llamar(`${HOST}/${BASE}/conversations?fields=id,updated_time&access_token=${encodeURIComponent(token)}`);
  if (!anota("instagram_business_manage_messages", conv, `GET /${BASE}/conversations`)) {
    // En el host de Facebook las conversaciones cuelgan de la PÁGINA.
    const conv2 = await llamar(
      `${FB}/${PAGE_ID}/conversations?platform=instagram&fields=id,updated_time&access_token=${encodeURIComponent(token)}`,
    );
    anota("instagram_business_manage_messages (2º intento)", conv2, `GET /${PAGE_ID}/conversations?platform=instagram`);
  }

  const okPorPermiso = new Map<string, boolean>();
  for (const d of detalle) {
    const base = d.permiso.replace(" (2º intento)", "");
    okPorPermiso.set(base, (okPorPermiso.get(base) ?? false) || d.http === 200);
  }
  const fallan = PERMISOS.filter((p) => !okPorPermiso.get(p));

  return NextResponse.json({
    veredicto: fallan.length
      ? `NO. Han fallado ${fallan.length} de 4: ${fallan.join(", ")}. Mira el detalle.`
      : "LISTO: las cuatro llamadas en 200. Meta tarda hasta 24 horas en reflejarlas en el formulario.",
    publicacion: permalink ?? "no se ha publicado",
    ...info,
    detalle,
    recuerda:
      "Meta tarda HASTA 24 HORAS en actualizar la columna de llamadas del App Review. " +
      "Si mañana sigue a cero, espera a que pase el plazo antes de tocar el token.",
  });
}
