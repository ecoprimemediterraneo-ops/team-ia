/**
 * Cron semanal — genera informe ejecutivo y lo envía por email.
 * Registrar en cron-job.org: GET https://aiteam.marketing/api/cron/sergio-report
 * Schedule: cada lunes a las 09:00 UTC
 */
import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { listChanges, listSources, createInsight } from "@/lib/sergio-db";
import { generateWeeklyReport } from "@/lib/sergio-analysis";
import { sendWeeklyReport } from "@/lib/sergio-alerts";

export const runtime = "nodejs";
export const maxDuration = 120;


/**
 * ¿Está Sergio listo para trabajar? Necesita el almacén de fuentes (Supabase) y
 * la clave de lectura de webs. Sin eso el cron no puede hacer nada.
 *
 * Se comprueba ANTES de tocar nada para que el cron salga con 200 y un motivo,
 * en vez de lanzar un 500 cada día. Un cron que falla a diario es ruido que
 * acaba tapando los fallos de verdad.
 */
function sergioNoDisponible(): string | null {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return "sin_almacen: faltan SUPABASE_URL / SUPABASE_SERVICE_KEY";
  }
  return null;
}

export async function GET(req: Request) {
  const authErr = cronAuthError(req);
  if (authErr) return authErr;

  const noDisp = sergioNoDisponible();
  if (noDisp) {
    console.log(`[cron/sergio] saltado: ${noDisp}`);
    return NextResponse.json({ ok: true, skipped: noDisp });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const allChanges = await listChanges({ limit: 100 });
  const weekChanges = allChanges.filter((c) => new Date(c.detected_at) > weekAgo);

  const sources = await listSources();
  const nameMap: Record<string, string> = {};
  for (const s of sources) nameMap[s.id] = s.competitor_name;

  const { content, highlights, recommendations } = await generateWeeklyReport(weekChanges, nameMap);

  // Save insight
  await createInsight({
    period_start: weekAgo.toISOString().split("T")[0],
    period_end: now.toISOString().split("T")[0],
    content,
    highlights,
    recommendations,
    generated_at: now.toISOString(),
  });

  // Send email
  await sendWeeklyReport(content, highlights);

  return NextResponse.json({
    ok: true,
    changesAnalyzed: weekChanges.length,
    ts: now.toISOString(),
  });
}
