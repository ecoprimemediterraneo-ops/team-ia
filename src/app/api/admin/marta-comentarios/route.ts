// GET /api/admin/marta-comentarios — founder-only. SOLO LEE.
//
// Responde a la pregunta que no se puede contestar mirando el código: ¿por qué
// un comentario con la palabra clave no dispara nada?
//
// Hay tres cosas que tienen que estar bien a la vez, y fallan por separado:
//   1. La REGLA existe y está activa para ese tenant  → se lee del almacén.
//   2. El ENVÍO está encendido para ese tenant        → `isCommentDmEnabled`.
//   3. La Página está SUSCRITA al campo `comments`    → se pregunta a Meta.
//
// La tercera es la que no se ve desde dentro: si la Página solo está suscrita a
// `messages`, el DM directo funciona y el comentario no llega nunca al webhook.
// Los DMs entran por `entry[].messaging` y los comentarios por `entry[].changes`
// con `field: "comments"`; son dos suscripciones distintas del mismo webhook.
//
// -----------------------------------------------------------------------------
// POR QUÉ ESTO SE HACE EN CUATRO PASOS Y NO EN UNO
// -----------------------------------------------------------------------------
// La primera versión preguntaba directamente por `/{page-id}/subscribed_apps`
// con el token de System User y devolvía siempre "Invalid OAuth 2.0 Access
// Token" (error 190), aunque el token fuese recién generado y válido. Dos
// motivos, y los dos había que arreglarlos:
//
//   a) `subscribed_apps` de una Página exige un PAGE access token. El token de
//      System User no vale ahí, aunque valga para todo lo demás. El Page token
//      se DERIVA del de System User pidiendo `/{page-id}?fields=access_token`,
//      que es exactamente lo que ya hacía el webhook de Marta para mandar DMs.
//   b) El token viajaba en la query string (`?access_token=…`). Además de ser
//      mala idea meter un secreto en una URL (acaba en logs y en cachés), basta
//      un espacio o un salto de línea pegado al valor para que Graph lo lea como
//      otro token y conteste 190. Ahora va siempre en la cabecera Authorization.
//
// Por eso cada paso se reporta por separado: así el error señala el eslabón que
// falla en vez de dar un 190 genérico que no dice nada.
//
// LO QUE ESTA RUTA NO HACE, a propósito: no suscribe, no des-suscribe, no manda
// DMs y no dispara llamadas de prueba de App Review. Todas las llamadas a Meta
// son GET de lectura. Cambiar la suscripción es una decisión del dueño de la
// app, no de un diagnóstico.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireFounder } from "@/lib/admin-auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import {
  getCommentRules,
  isCommentDmEnabled,
  commentDmTenantsPermitidos,
} from "@/lib/marta-comment-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const GRAPH = "https://graph.facebook.com/v21.0";

// -----------------------------------------------------------------------------
// Token: de dónde sale y qué forma tiene
// -----------------------------------------------------------------------------

/** Misma resolución que usa el webhook de Marta, para diagnosticar lo mismo que corre. */
function resolverToken(): { valor: string; variable: string } | null {
  const ig = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (ig && ig.length > 0) return { valor: ig, variable: "INSTAGRAM_ACCESS_TOKEN" };
  const wa = process.env.WHATSAPP_ACCESS_TOKEN;
  if (wa && wa.length > 0) return { valor: wa, variable: "WHATSAPP_ACCESS_TOKEN (fallback)" };
  return null;
}

/**
 * Radiografía del token SIN enseñarlo: longitud, prefijo y si trae basura
 * alrededor. Con esto se distingue "token mal pegado" de "token correcto pero
 * insuficiente" sin que el secreto salga por ninguna parte.
 */
function formaDelToken(t: string) {
  return {
    longitud: t.length,
    // Los tokens de Graph empiezan por "EAA". Si aquí sale otra cosa, el valor
    // pegado no es un token de la Graph API de Facebook.
    empiezaPor: t.slice(0, 3),
    pareceGraph: t.startsWith("EAA"),
    tieneEspaciosOSaltos: /\s/.test(t),
    tieneComillas: /["']/.test(t),
    // Un valor pegado desde un editor a veces se lleva un "\n" literal de dos
    // caracteres, que no es un salto de línea real y no lo caza /\s/.
    tieneBarraNLiteral: t.includes("\\n"),
  };
}

type GraphRes = { ok: boolean; status: number; code?: number; message?: string; json: unknown };

/** GET a Graph con el token en la CABECERA, nunca en la URL. */
async function graphGet(path: string, token: string): Promise<GraphRes> {
  try {
    const res = await fetch(`${GRAPH}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
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

// -----------------------------------------------------------------------------
// El diagnóstico, paso a paso
// -----------------------------------------------------------------------------

type Paso = { paso: string; ok: boolean; detalle: string; datos?: unknown };

async function diagnosticarWebhook(): Promise<{ pasos: Paso[]; suscritoAComentarios: boolean | null; campos: string[] }> {
  const pasos: Paso[] = [];
  const pageId = process.env.FACEBOOK_PAGE_ID || "";

  const tok = resolverToken();
  if (!tok) {
    pasos.push({
      paso: "0· token",
      ok: false,
      detalle: "No hay INSTAGRAM_ACCESS_TOKEN ni WHATSAPP_ACCESS_TOKEN en este entorno.",
    });
    return { pasos, suscritoAComentarios: null, campos: [] };
  }
  const forma = formaDelToken(tok.valor);
  pasos.push({
    paso: "0· token",
    ok: !forma.tieneEspaciosOSaltos && !forma.tieneComillas && !forma.tieneBarraNLiteral && forma.pareceGraph,
    detalle: `Leído de ${tok.variable}.` +
      (forma.tieneEspaciosOSaltos ? " ⚠️ TRAE ESPACIOS O SALTOS DE LÍNEA." : "") +
      (forma.tieneComillas ? " ⚠️ TRAE COMILLAS." : "") +
      (forma.tieneBarraNLiteral ? " ⚠️ TRAE UN \\n LITERAL." : "") +
      (forma.pareceGraph ? "" : " ⚠️ NO empieza por EAA: no parece un token de la Graph API de Facebook."),
    datos: forma,
  });

  if (!pageId) {
    pasos.push({ paso: "1· FACEBOOK_PAGE_ID", ok: false, detalle: "No está definida en este entorno." });
    return { pasos, suscritoAComentarios: null, campos: [] };
  }

  // Paso 1 — ¿el token vale para algo? Si aquí sale 190, el token está mal
  // pegado o caducado, y no hay que buscar más lejos.
  const me = await graphGet("/me?fields=id,name", tok.valor);
  pasos.push({
    paso: "1· ¿el token es válido?",
    ok: me.ok,
    detalle: me.ok
      ? `Sí. Identidad del token: ${JSON.stringify(me.json)}`
      : `NO (código ${me.code ?? me.status}): ${me.message}`,
  });
  if (!me.ok) return { pasos, suscritoAComentarios: null, campos: [] };

  // Paso 2 — ¿el System User tiene ESA Página asignada? Sin esto no se puede
  // derivar el Page token, por muy válido que sea el token.
  const cuentas = await graphGet("/me/accounts?fields=id,name&limit=50", tok.valor);
  const paginas = ((cuentas.json as { data?: Array<{ id?: string; name?: string }> })?.data || []);
  const laNuestra = paginas.find((p) => p.id === pageId);
  pasos.push({
    paso: "2· ¿la Página está asignada?",
    ok: !!laNuestra,
    detalle: !cuentas.ok
      ? `No se ha podido listar (código ${cuentas.code ?? cuentas.status}): ${cuentas.message}`
      : laNuestra
        ? `Sí: "${laNuestra.name}" (${pageId}).`
        : `NO. FACEBOOK_PAGE_ID=${pageId} no está entre las Páginas de este token.`,
    datos: { paginasVisibles: paginas.map((p) => ({ id: p.id, nombre: p.name })) },
  });

  // Paso 3 — derivar el PAGE access token. Es el mismo camino que ya usa el
  // webhook de Marta para poder mandar DMs, así que si esto falla, los DMs
  // tampoco saldrían.
  const pageTokenRes = await graphGet(`/${pageId}?fields=access_token`, tok.valor);
  const pageToken = (pageTokenRes.json as { access_token?: string })?.access_token;
  pasos.push({
    paso: "3· derivar Page access token",
    ok: !!pageToken,
    detalle: pageToken
      ? "Derivado correctamente desde el token de System User."
      : `NO se ha podido derivar (código ${pageTokenRes.code ?? pageTokenRes.status}): ${pageTokenRes.message}`,
  });
  if (!pageToken) return { pasos, suscritoAComentarios: null, campos: [] };

  // Paso 4 — AHORA sí: subscribed_apps con el Page token.
  const subs = await graphGet(`/${pageId}/subscribed_apps?fields=subscribed_fields`, pageToken);
  if (!subs.ok) {
    // Caso concreto y muy frecuente: el token de System User se generó sin el
    // permiso `pages_manage_metadata`. Es el permiso que gobierna las
    // suscripciones del webhook de una Página: sin él no se pueden ni LEER ni
    // cambiar. "Todos los permisos" en el generador de tokens de Meta no lo
    // incluye salvo que se marque explícitamente.
    const faltaPermiso = (subs.message || "").includes("pages_manage_metadata");
    pasos.push({
      paso: "4· campos suscritos",
      ok: false,
      detalle: faltaPermiso
        ? "El token NO tiene el permiso `pages_manage_metadata`, que es el que deja leer y cambiar " +
          "las suscripciones del webhook de la Página. Hay que regenerar el token del System User " +
          "marcando ese permiso (Business Manager → Usuarios del sistema → Generar token → marcar " +
          "pages_manage_metadata, ademas de los de Instagram) y volver a pegarlo en " +
          "INSTAGRAM_ACCESS_TOKEN. Es el mismo permiso que hara falta despues para suscribir la " +
          "Pagina al campo `comments`."
        : `No se han podido leer (código ${subs.code ?? subs.status}): ${subs.message}`,
      datos: { graphCode: subs.code, graphMessage: subs.message },
    });
    return { pasos, suscritoAComentarios: null, campos: [] };
  }
  const campos = (((subs.json as { data?: Array<{ subscribed_fields?: string[] }> })?.data) || [])
    .flatMap((d) => d.subscribed_fields || []);
  const suscritoAComentarios = campos.includes("comments");
  pasos.push({
    paso: "4· campos suscritos",
    ok: suscritoAComentarios,
    detalle: suscritoAComentarios
      ? "La Página SÍ está suscrita a `comments`."
      : "La Página NO está suscrita a `comments` (por eso el comentario no llega nunca al webhook).",
    datos: { campos, suscritoAMensajes: campos.includes("messages") },
  });

  return { pasos, suscritoAComentarios, campos };
}

/**
 * Segunda vía de entrada, SOLO para este diagnóstico de lectura: cabecera
 * `x-diag-secret` con el valor de `DIAG_SECRET`.
 *
 * Existe porque este endpoint hay que poder consultarlo sin sesión de navegador
 * (desde un script, un monitor o durante un despliegue). Es el mismo patrón que
 * ya usan las rutas de cron con CRON_SECRET.
 *
 * Fail-CLOSED: si `DIAG_SECRET` no está definida, esta vía NO existe y la única
 * forma de entrar sigue siendo la sesión del fundador. Borrar la variable en
 * Vercel deja el código inerte, sin necesidad de tocar nada más. Y solo abre una
 * LECTURA: esta ruta no cambia ni un byte en ninguna parte.
 */
async function autorizadoPorSecreto(): Promise<boolean> {
  const esperado = process.env.DIAG_SECRET;
  if (!esperado) return false;
  const h = await headers();
  return h.get("x-diag-secret") === esperado;
}

export async function GET() {
  if (!(await autorizadoPorSecreto())) {
    const a = await requireFounder();
    if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  }

  const ctx = await contextoPanelODefecto();
  const reglas = await getCommentRules(ctx.tenantId);
  const activas = reglas.filter((r) => r.enabled);
  const envioEncendido = isCommentDmEnabled(ctx.tenantId);

  const { pasos, suscritoAComentarios, campos } = await diagnosticarWebhook();
  const pasoRoto = pasos.find((p) => !p.ok);

  // Diagnóstico en una frase: el primer eslabón que falla, en orden de causa.
  let veredicto: string;
  if (suscritoAComentarios === false) {
    veredicto =
      "La Página NO está suscrita al campo `comments`: el comentario no llega al webhook. " +
      "Es la causa de que el DM directo funcione y el comentario no.";
  } else if (pasoRoto) {
    veredicto = `Falla el paso "${pasoRoto.paso}": ${pasoRoto.detalle}`;
  } else if (!activas.length) {
    veredicto = "No hay ninguna regla ACTIVA para este tenant: aunque llegue el comentario, no casa con nada.";
  } else if (!envioEncendido) {
    veredicto = `El envío está apagado para ${ctx.tenantId}: se detecta la palabra clave y se registra, pero no se manda nada.`;
  } else {
    veredicto = "Todo en verde: regla activa, envío encendido y Página suscrita a `comments`.";
  }

  return NextResponse.json({
    ok: true,
    veredicto,
    tenant: ctx.tenantId,
    envio: {
      encendidoParaEsteTenant: envioEncendido,
      interruptorGlobal: (process.env.MARTA_COMMENT_DM_ENABLED || "").toLowerCase() === "true",
      tenantsPermitidos: commentDmTenantsPermitidos(),
    },
    reglas: {
      total: reglas.length,
      activas: activas.length,
      detalle: activas.map((r) => ({
        id: r.id,
        keywords: r.keywords,
        modo: r.matchMode,
        scope: r.scope,
        respondeEnPublico: r.replyPublic,
      })),
    },
    webhook: {
      suscritoAComentarios,
      suscritoAMensajes: campos.length ? campos.includes("messages") : null,
      campos,
      pasos,
    },
  });
}
