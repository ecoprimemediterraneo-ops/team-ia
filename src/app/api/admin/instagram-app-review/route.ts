// /api/admin/instagram-app-review — founder-only.
//
//   GET              mira qué token hay y qué permisos trae. No llama a nada.
//   GET ?llamar=1    hace las CUATRO llamadas de la familia instagram_business_*,
//                    publicando de verdad en la cuenta.
//
// PARA QUÉ: Meta no deja enviar el App Review hasta que cada permiso registre al
// menos una llamada real. Mientras la columna esté a cero, el botón de enviar no
// se activa.
//
// QUÉ TOKEN USA, y por qué importa tanto
// --------------------------------------
// Primero el de **Instagram Business Login** (el que guarda /api/instagram/login
// en Supabase). Si no lo hay, cae al del System User (INSTAGRAM_ACCESS_TOKEN) y
// LO DICE, porque con ese token estas llamadas no cuentan:
//
// - El System User es válido, es de la app correcta y trae 17 permisos, pero
//   ninguno de los cuatro instagram_business_*, y no vale contra
//   graph.instagram.com. Comprobado el 17/08/2026 con esta misma ruta.
// - Los instagram_business_* pertenecen al producto "Instagram API con Instagram
//   Login". Sus llamadas van a graph.instagram.com. Los parecidos
//   instagram_manage_* son del producto viejo, con Facebook Login, y van a
//   graph.facebook.com.
//
// EL FALLO DE JULIO fue justo ese: se llamó a graph.facebook.com, salieron tres
// 200 y el contador siguió a cero, porque sumaron en la familia equivocada. Por
// eso aquí el host no se supone: se elige por el origen del token y se dice cuál
// se ha usado.
//
// NUNCA se devuelve el token ni ningún secreto. Ni siquiera dentro de un mensaje
// de error de Meta, que los devuelve enteros ("Malformed access token EAA…").

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { estadoToken, tokenParaInstagramLogin, SCOPES } from "@/lib/instagram-login";

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

/** Devuelve una función que tapa este token y todos los secretos del entorno. */
function taparCon(token: string) {
  const secretos = [token, process.env.META_APP_SECRET, process.env.INSTAGRAM_APP_SECRET, process.env.INSTAGRAM_ACCESS_TOKEN];
  return (t: unknown): string => {
    let s = typeof t === "string" ? t : JSON.stringify(t);
    for (const v of secretos) if (v && v.length > 6) s = s.split(v).join("«oculto»");
    return s.replace(/(EAA|IGAA|IGQ)[A-Za-z0-9_.-]{20,}/g, "«token oculto»").slice(0, 400);
  };
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

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const llamarDeVerdad = new URL(req.url).searchParams.get("llamar") === "1";

  // --- Qué token se usa -----------------------------------------------------
  const deLogin = await tokenParaInstagramLogin();
  const deSystemUser = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || "";
  const token = deLogin || deSystemUser;
  const esDeLogin = Boolean(deLogin);

  if (!token) {
    return NextResponse.json({
      veredicto: "NO HAY NINGÚN TOKEN. Autoriza primero en /api/instagram/login.",
      siguiente: "/api/instagram/login",
    });
  }

  const tapar = taparCon(token);

  /** El error de Meta entero, que es lo que hace falta para arreglarlo. */
  const errorDe = (r: Respuesta): string | null => {
    const e = r.json?.error as
      | { message?: string; type?: string; code?: number; error_subcode?: number; error_user_msg?: string; fbtrace_id?: string }
      | undefined;
    const plano = r.json as { error_message?: string; error_type?: string };
    if (!e && !plano?.error_message) return null;
    return [
      tapar(e?.message ?? plano?.error_message ?? "sin mensaje"),
      (e?.type ?? plano?.error_type) ? `tipo ${e?.type ?? plano?.error_type}` : "",
      e?.code ? `código ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""}` : "",
      e?.error_user_msg ? `· ${tapar(e.error_user_msg)}` : "",
      e?.fbtrace_id ? `· fbtrace_id ${e.fbtrace_id}` : "",
    ].filter(Boolean).join(" · ");
  };

  const estado = await estadoToken();
  const info: Record<string, unknown> = {
    tokenQueSeUsa: esDeLogin
      ? "Instagram Business Login (el bueno para los permisos business_*)"
      : "System User (INSTAGRAM_ACCESS_TOKEN) — NO sirve para los business_*",
    tokenInstagramLogin: estado.resumen,
    ...(esDeLogin
      ? { cuentaAutorizada: estado.usuario ? `@${estado.usuario}` : estado.cuenta, caduca: estado.caduca }
      : {}),
  };

  // El System User no vale para este host; el de Instagram Login sí. Se
  // comprueba en vez de darlo por hecho.
  const pruebaIg = await llamar(`${IG}/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`);
  const enInstagram = pruebaIg.ok;
  const HOST = enInstagram ? IG : FB;
  const BASE = enInstagram ? "me" : IG_USER_ID;
  info.host = enInstagram ? "graph.instagram.com (el correcto)" : "graph.facebook.com";

  if (!enInstagram) {
    info.porQueNoInstagram = errorDe(pruebaIg) ?? `HTTP ${pruebaIg.status}`;
    info.aviso =
      "Este token NO vale contra graph.instagram.com, que es donde cuentan los instagram_business_*. " +
      "Las llamadas irían por graph.facebook.com y sumarían en la familia vieja (instagram_manage_*), " +
      "que es exactamente lo que pasó en julio. Autoriza en /api/instagram/login antes de seguir.";
  }

  const faltan = estado.hay ? (estado.faltanPermisos ?? []) : [...SCOPES];

  if (!llamarDeVerdad) {
    return NextResponse.json({
      veredicto: !esDeLogin
        ? "PARA. No hay token de Instagram Login, así que estas llamadas no contarían. Empieza en /api/instagram/login."
        : faltan.length
          ? `Al token de Instagram Login le faltan permisos: ${faltan.join(", ")}. Vuelve a autorizar aceptándolos todos.`
          : "Todo listo. Abre esta misma dirección con ?llamar=1 para hacer las cuatro llamadas.",
      ...info,
      siguiente: esDeLogin && !faltan.length ? "añade ?llamar=1 · publicará de verdad en la cuenta" : "/api/instagram/login",
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
  const basic = await llamar(
    `${HOST}/${BASE}?fields=${enInstagram ? "user_id,username,account_type" : "id,username"}&access_token=${encodeURIComponent(token)}`,
  );
  anota("instagram_business_basic", basic, `GET /${BASE}?fields=user_id,username`);
  if (basic.ok) info.cuenta = `@${(basic.json as { username?: string }).username ?? "?"}`;

  // 2) content_publish — publica de verdad
  let permalink: string | null = null;
  let mediaId = "";
  const cont = await llamar(`${HOST}/${BASE}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ image_url: IMAGEN, caption: PIE, access_token: token }).toString(),
  });
  const creationId = (cont.json as { id?: string }).id ?? "";

  if (!cont.ok || !creationId) {
    anota("instagram_business_content_publish", cont, `POST /${BASE}/media`);
  } else {
    // El contenedor tarda unos segundos en quedar listo; publicar antes falla.
    let estadoCont = "";
    for (let i = 0; i < 6; i++) {
      const st = await llamar(`${HOST}/${creationId}?fields=status_code&access_token=${encodeURIComponent(token)}`);
      estadoCont = ((st.json as { status_code?: string }).status_code ?? "").toUpperCase();
      if (estadoCont === "FINISHED" || estadoCont === "ERROR") break;
      await new Promise((r) => setTimeout(r, 2500));
    }
    if (estadoCont !== "FINISHED") {
      detalle.push({
        permiso: "instagram_business_content_publish",
        http: cont.status,
        endpoint: `POST /${BASE}/media`,
        resultado: `el contenedor se quedó en "${estadoCont || "sin estado"}" y no se pudo publicar`,
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
  if (!anota("instagram_business_manage_messages", conv, `GET /${BASE}/conversations`) && !enInstagram) {
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
  const fallan = SCOPES.filter((p) => !okPorPermiso.get(p));

  return NextResponse.json({
    veredicto: fallan.length
      ? `NO. Han fallado ${fallan.length} de 4: ${fallan.join(", ")}. Mira el detalle.`
      : esDeLogin
        ? "LISTO: las cuatro llamadas en 200 con el token de Instagram Login. Meta tarda hasta 24 horas en reflejarlas."
        : "Las cuatro han dado 200, PERO con el token del System User: no cuentan para los business_*. Autoriza en /api/instagram/login y repite.",
    publicacion: permalink ?? "no se ha publicado",
    ...info,
    detalle,
    recuerda:
      "Meta tarda HASTA 24 HORAS en actualizar la columna de llamadas del App Review. " +
      "Si mañana sigue a cero, espera a que pase el plazo antes de tocar el token.",
  });
}
