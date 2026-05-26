/**
 * Cron semanal — genera informe ejecutivo y lo envía por email.
 * Registrar en cron-job.org: GET https://aiteam.marketing/api/cron/sergio-report
 * Schedule: cada lunes a las 09:00 UTC
 */
import { NextResponse } from "next/server";
import { listChanges, listSources, createInsight } from "@/lib/sergio-db";
import { generateWeeklyReport } from "@/lib/sergio-analysis";
import { sendWeeklyReport } from "@/lib/sergio-alerts";
import { checkCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const a = checkCronAuth(req);
  if (!a.ok) return NextResponse.json({ error: a.reason }, { status: 401 });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const allChanges = await listChanges({ limit: 100 });
  const weekChanges = allChanges.filter((c) => new Date(c.detected_at) > weekAgo);

  const sources = await listSources();
  const nameMap: Record<string, string> = {};
  const ownerMap: Record<string, string | null> = {};
  for (const s of sources) {
    nameMap[s.id] = s.competitor_name;
    ownerMap[s.id] = s.owner_email;
  }

  // Agrupar cambios por owner — un informe semanal por cliente
  const byOwner = new Map<string | null, typeof weekChanges>();
  for (const c of weekChanges) {
    const owner = ownerMap[c.source_id] ?? null;
    const arr = byOwner.get(owner) ?? [];
    arr.push(c);
    byOwner.set(owner, arr);
  }

  let sent = 0;
  for (const [owner, ownerChanges] of byOwner.entries()) {
    if (ownerChanges.length === 0) continue;
    const { content, highlights, recommendations } = await generateWeeklyReport(ownerChanges, nameMap);

    await createInsight({
      period_start: weekAgo.toISOString().split("T")[0],
      period_end: now.toISOString().split("T")[0],
      content,
      highlights,
      recommendations,
      generated_at: now.toISOString(),
    });

    try {
      await sendWeeklyReport(content, highlights, owner);
      sent++;
    } catch { /* continue with next owner */ }
  }

  return NextResponse.json({
    ok: true,
    changesAnalyzed: weekChanges.length,
    reportsSent: sent,
    ts: now.toISOString(),
  });
}
