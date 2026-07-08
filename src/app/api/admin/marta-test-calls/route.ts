// GET /api/admin/marta-test-calls — founder-only.
// Dispara UNA llamada real a la Graph API por cada permiso de Instagram que Meta
// pide "ejercitar" para el App Review. Aunque devuelvan error de permiso (#10/#200),
// Meta las registra como "API test calls" y marca el permiso como usado.
//
// Requiere el token de la app (INSTAGRAM_ACCESS_TOKEN) + FACEBOOK_PAGE_ID en el
// entorno donde corra → SOLO tiene sentido ejecutarlo en PROD (Vercel), donde vive
// el token. En local devuelve "sin token".
//
// Permisos cubiertos y endpoint por cada uno:
//   instagram_business_content_publish → POST /{ig-user-id}/media  (crear contenedor)
//   instagram_business_manage_comments → GET  /{ig-media-id}/comments
//   instagram_manage_insights          → GET  /{ig-user-id}/insights
//   instagram_manage_messages          → GET  /{page-id}/conversations?platform=instagram
import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const GRAPH = "https://graph.facebook.com/v21.0";

type CallResult = {
  permiso: string;
  endpoint: string;
  metodo: "GET" | "POST";
  httpStatus: number | null;
  graphCode?: number;
  mensaje: string;
};

async function callGraph(url: string, method: "GET" | "POST"): Promise<{ status: number | null; code?: number; message: string; json: unknown }> {
  try {
    const res = await fetch(url, { method });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { json = text; }
    const err = (json as { error?: { code?: number; message?: string } })?.error;
    return { status: res.status, code: err?.code, message: err?.message || (res.ok ? "OK" : text.slice(0, 200)), json };
  } catch (e) {
    return { status: null, message: e instanceof Error ? e.message : "network_error", json: null };
  }
}

export async function GET() {
  const a = await requireFounder();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || "";
  const pageId = process.env.FACEBOOK_PAGE_ID || "";
  if (!token || !pageId) {
    return NextResponse.json({
      ok: false,
      error: "sin_token_o_page",
      detalle: "Faltan INSTAGRAM_ACCESS_TOKEN y/o FACEBOOK_PAGE_ID. Ejecuta esto en PROD (Vercel), donde viven.",
    });
  }
  const t = `access_token=${encodeURIComponent(token)}`;

  // Resolver ig-user-id desde la Page.
  const igRes = await callGraph(`${GRAPH}/${pageId}?fields=instagram_business_account&${t}`, "GET");
  const igUserId = (igRes.json as { instagram_business_account?: { id?: string } })?.instagram_business_account?.id;

  // Un media id para el test de comentarios (si hay).
  let mediaId: string | undefined;
  if (igUserId) {
    const m = await callGraph(`${GRAPH}/${igUserId}/media?limit=1&fields=id&${t}`, "GET");
    mediaId = (m.json as { data?: { id?: string }[] })?.data?.[0]?.id;
  }

  const results: CallResult[] = [];
  const push = (permiso: string, endpoint: string, metodo: "GET" | "POST", r: Awaited<ReturnType<typeof callGraph>>) =>
    results.push({ permiso, endpoint, metodo, httpStatus: r.status, graphCode: r.code, mensaje: r.message });

  // 1) content_publish — crear contenedor (image_url dummy → error, pero registra la call)
  if (igUserId) {
    const ep = `${GRAPH}/${igUserId}/media?image_url=https://example.com/apptest.jpg&caption=apptest&${t}`;
    push("instagram_business_content_publish", `POST /${igUserId}/media`, "POST", await callGraph(ep, "POST"));
  }
  // 2) manage_comments — leer comentarios de un media
  if (mediaId) {
    push("instagram_business_manage_comments", `GET /${mediaId}/comments`, "GET", await callGraph(`${GRAPH}/${mediaId}/comments?${t}`, "GET"));
  } else if (igUserId) {
    push("instagram_business_manage_comments", `GET /${igUserId}/media?fields=comments_count`, "GET", await callGraph(`${GRAPH}/${igUserId}/media?fields=comments_count&limit=1&${t}`, "GET"));
  }
  // 3) manage_insights — insights de la cuenta
  if (igUserId) {
    push("instagram_manage_insights", `GET /${igUserId}/insights`, "GET", await callGraph(`${GRAPH}/${igUserId}/insights?metric=reach&period=day&${t}`, "GET"));
  }
  // 4) manage_messages — conversaciones de Instagram (Messenger Platform)
  push("instagram_manage_messages", `GET /${pageId}/conversations?platform=instagram`, "GET", await callGraph(`${GRAPH}/${pageId}/conversations?platform=instagram&${t}`, "GET"));

  return NextResponse.json({
    ok: true,
    igUserId: igUserId || null,
    mediaId: mediaId || null,
    nota: "Cada llamada de abajo queda registrada en Meta como API test call, aunque devuelva error de permiso.",
    llamadas: results,
  });
}
