/**
 * Generación del MES entero de Marta (Nivel 3). Lo llama n8n UNA VEZ AL MES.
 *
 * NO está en vercel.json a propósito: el plan Hobby solo admite 2 crons y ya
 * están usados (eval + marta-publicar). Este endpoint se dispara desde fuera,
 * igual que /api/cron/informe-mensual.
 *
 *   GET /api/cron/marta-mes
 *   Authorization: Bearer <CRON_SECRET>        (exigido en Vercel; en dev local no)
 *
 * Parámetros (todos opcionales):
 *   ?tenant=tenant_aiteam    tenant a generar (default: el de por defecto)
 *   ?preview=1               genera y DEVUELVE sin guardar nada (para probar)
 *   ?mes=2026-08             mes a generar (default: el mes en curso)
 *   ?dias=1,3,5              días de la semana (0=Dom … 6=Sáb). Default L-X-V
 *   ?hora=10                 hora local Europe/Madrid
 *   ?max=20                  tope de posts
 *
 * Interruptor: sin MARTA_AUTO_ENABLED=true NO persiste nada (responde
 * skipped:"auto_disabled"). El modo preview sí funciona con el flag apagado,
 * porque no escribe en el store ni publica nada.
 *
 * Este endpoint NO publica: solo deja los posts como "scheduled" en el
 * calendario de Marta para que los recoja el flujo de publicación existente.
 */

import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import { generarMes, martaAutoEnabled } from "@/lib/marta-mes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Un mes son ~13 captions + 13 imágenes. 120 s es el techo que este repo ya
// usa en producción (sergio-report). Si algún mes se quedase corto, se parte en
// dos llamadas con ?max=.
export const maxDuration = 120;

export async function GET(req: Request) {
  const authErr = cronAuthError(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant") || DEFAULT_TENANT_ID;
  const preview = url.searchParams.get("preview") === "1";

  // baseUrl absoluta: la necesitan tanto la plantilla de imagen como las URLs
  // durables del image-store (mismo patrón que /api/cron/marta-publicar).
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const mesParam = url.searchParams.get("mes"); // "YYYY-MM"
  const m = mesParam?.match(/^(\d{4})-(\d{2})$/);
  const diasParam = url.searchParams.get("dias");
  const dias = diasParam
    ? diasParam.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n >= 0 && n <= 6)
    : undefined;
  const horaParam = url.searchParams.get("hora");
  const maxParam = url.searchParams.get("max");

  const res = await generarMes({
    tenantId,
    baseUrl,
    preview,
    year: m ? Number(m[1]) : undefined,
    month1: m ? Number(m[2]) : undefined,
    diasSemana: dias?.length ? dias : undefined,
    hora: horaParam ? Number(horaParam) : undefined,
    max: maxParam ? Number(maxParam) : undefined,
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, reason: res.reason, detail: res.detail, autoEnabled: martaAutoEnabled() },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    autoEnabled: martaAutoEnabled(),
    preview,
    persistido: res.persistido,
    skipped: "skipped" in res ? res.skipped : undefined,
    mes: res.mes,
    generados: res.posts.length,
    errores: res.errores,
    posts: res.posts.map((p) => ({
      scheduledAt: p.scheduledAt,
      tema: p.temaLabel,
      hashtags: p.hashtags,
      imageUrl: p.imageUrl,
      preview: p.texto.slice(0, 120),
    })),
  });
}
