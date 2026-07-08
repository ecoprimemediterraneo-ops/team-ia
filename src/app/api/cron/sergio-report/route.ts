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

export async function GET(req: Request) {
  const authErr = cronAuthError(req);
  if (authErr) return authErr;

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
