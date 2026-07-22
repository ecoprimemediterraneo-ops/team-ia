/**
 * Publicación AUTOMÁTICA de las entradas vencidas del calendario de Marta.
 * Lo llama n8n cada hora (o cada 15 min): publica en Instagram lo que ya tocaba.
 *
 * ¡OJO CON EL NOMBRE! NO es /api/cron/marta-publicar: esa ruta YA EXISTE, está
 * en vercel.json (cron diario 0 8 * * *) y hace algo DISTINTO — ejecuta las
 * reglas de recurrencia de marta-schedule y crea PROPUESTAS pendientes. Si se
 * hubiese sobrescrito, el cron diario de Vercel habría empezado a publicar solo
 * en Instagram. Por eso esta ruta es "marta-calendar-publicar".
 *
 *   GET /api/cron/marta-calendar-publicar
 *   Authorization: Bearer <CRON_SECRET>     (exigido en Vercel; en dev local no)
 *
 * Parámetros (opcionales):
 *   ?tenant=tenant_aiteam   tenant (default: el propio)
 *   ?dry=1                  fuerza dry-run aunque los flags estén activos
 *   ?entry=cal_xxx          publica SOLO esa entrada (uso manual/controlado)
 *
 * NO se añade a vercel.json a propósito: plan Hobby permite 2 crons y ya están
 * usados (eval + marta-publicar). Se dispara desde n8n, como informe-mensual.
 *
 * DOBLE INTERRUPTOR: publica de verdad solo con
 * MARTA_AUTO_PUBLISH_ENABLED=true Y MARTA_PUBLISH_ENABLED=true.
 * Con cualquiera apagado responde en dry-run: dice qué publicaría y no toca nada.
 */

import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import { publicarVencidos } from "@/lib/marta-auto-publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // subir media a Meta puede tardar

export async function GET(req: Request) {
  const authErr = cronAuthError(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant") || DEFAULT_TENANT_ID;
  const forzarDry = url.searchParams.get("dry") === "1";
  const entryId = url.searchParams.get("entry") || undefined;

  const res = await publicarVencidos({
    tenantId,
    entryId,
    dryRun: forzarDry ? true : undefined, // undefined = decide por los flags
  });

  return NextResponse.json({
    ok: true,
    tenantId,
    dryRun: res.dryRun,
    flags: {
      MARTA_AUTO_PUBLISH_ENABLED: res.autoPublishEnabled,
      MARTA_PUBLISH_ENABLED: res.publishEnabled,
    },
    vencidas: res.vencidas,
    publicadas: res.publicadas,
    fallidas: res.fallidas,
    omitidas: res.omitidas,
    entradas: res.entradas.map((e) => ({
      entryId: e.entryId,
      scheduledAt: e.scheduledAt,
      accion: e.accion,
      motivo: e.motivo,
      igMediaId: e.igMediaId,
      tema: e.tema,
      caption: e.caption.slice(0, 100),
    })),
  });
}
