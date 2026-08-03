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
// LO QUE ESTA RUTA NO HACE, a propósito: no suscribe, no des-suscribe, no manda
// DMs y no dispara llamadas de prueba de App Review. Todas las llamadas a Meta
// son GET de lectura de configuración. Cambiar la suscripción es una decisión
// del dueño de la app, no de un diagnóstico.
//
// En local devuelve `sin_token` (las credenciales de Meta viven en Vercel).

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import {
  getCommentRules,
  isCommentDmEnabled,
  commentDmTenantsPermitidos,
} from "@/lib/marta-comment-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v21.0";

function getToken(): string | null {
  return process.env.INSTAGRAM_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || null;
}

type Suscripcion =
  | { estado: "sin_token"; detalle: string }
  | { estado: "sin_page_id"; detalle: string }
  | { estado: "error"; detalle: string }
  | {
      estado: "leido";
      /** true solo si aparece `comments` entre los campos suscritos. */
      suscritoAComentarios: boolean;
      suscritoAMensajes: boolean;
      campos: string[];
    };

async function leerSuscripcion(): Promise<Suscripcion> {
  const token = getToken();
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!token) return { estado: "sin_token", detalle: "Falta INSTAGRAM_ACCESS_TOKEN (o WHATSAPP_ACCESS_TOKEN) en este entorno." };
  if (!pageId) return { estado: "sin_page_id", detalle: "Falta FACEBOOK_PAGE_ID en este entorno." };

  try {
    const url = `${GRAPH}/${pageId}/subscribed_apps?fields=subscribed_fields&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as {
      data?: Array<{ subscribed_fields?: string[] }>;
      error?: { message?: string; code?: number };
    };
    if (!res.ok || json.error) {
      return { estado: "error", detalle: json.error?.message || `HTTP ${res.status}` };
    }
    const campos = (json.data || []).flatMap((d) => d.subscribed_fields || []);
    return {
      estado: "leido",
      suscritoAComentarios: campos.includes("comments"),
      suscritoAMensajes: campos.includes("messages"),
      campos,
    };
  } catch (e) {
    return { estado: "error", detalle: e instanceof Error ? e.message : "network_error" };
  }
}

export async function GET() {
  const a = await requireFounder();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const ctx = await contextoPanelODefecto();
  const reglas = await getCommentRules(ctx.tenantId);
  const suscripcion = await leerSuscripcion();

  const activas = reglas.filter((r) => r.enabled);
  const envioEncendido = isCommentDmEnabled(ctx.tenantId);

  // Diagnóstico en una frase: el primer eslabón que falla, en orden de causa.
  let veredicto: string;
  if (suscripcion.estado === "leido" && !suscripcion.suscritoAComentarios) {
    veredicto =
      "La Página NO está suscrita al campo `comments`: el comentario no llega al webhook. " +
      "Es la causa más probable de que el DM directo funcione y el comentario no.";
  } else if (!activas.length) {
    veredicto = "No hay ninguna regla ACTIVA para este tenant: aunque llegue el comentario, no casa con nada.";
  } else if (!envioEncendido) {
    veredicto = `El envío está apagado para ${ctx.tenantId}: se detecta la palabra clave y se registra, pero no se manda nada.`;
  } else if (suscripcion.estado !== "leido") {
    veredicto = `Regla activa y envío encendido. No se ha podido leer la suscripción del webhook (${suscripcion.estado}), que es lo único que queda por confirmar.`;
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
    webhook: suscripcion,
  });
}
