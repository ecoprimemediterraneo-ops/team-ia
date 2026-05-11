/**
 * Cron diario — analiza cambios pendientes con Claude y envía alertas.
 * Registrar en cron-job.org: GET https://aiteam.marketing/api/cron/sergio-analyze
 * Schedule: cada día a las 04:00 UTC (después del scraper a las 03:00)
 */
import { NextResponse } from "next/server";
import { listChanges, listSources, acknowledgeChange, updateSource } from "@/lib/sergio-db";
import type { Change } from "@/lib/sergio-db";
import { analyzeChange } from "@/lib/sergio-analysis";
import { sendCriticalAlert, sendDailyDigest } from "@/lib/sergio-alerts";
import { kvGet, kvSet } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (secret && !auth.includes(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get unacknowledged changes
  const pending = await listChanges({ acknowledged: false, limit: 20 });
  if (pending.length === 0) return NextResponse.json({ ok: true, analyzed: 0 });

  // Get source names for alerts
  const sources = await listSources();
  const nameMap: Record<string, string> = {};
  for (const s of sources) nameMap[s.id] = s.competitor_name;

  const analyzed: Change[] = [];
  const criticals: Change[] = [];
  const highs: Change[] = [];

  for (const change of pending) {
    const source = sources.find((s) => s.id === change.source_id);
    if (!source) continue;

    const diff = change.diff as { added?: string[]; removed?: string[] };

    try {
      const result = await analyzeChange(source.competitor_name, source.url, {
        added: diff.added ?? [],
        removed: diff.removed ?? [],
      });

      // Update change with Claude analysis (via supabase direct)
      const db = await import("@/lib/sergio-db");
      // Re-use createChange pattern — update via raw supabase
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
      await client.from("sergio_changes").update({
        relevance: result.relevance,
        change_type: result.change_type,
        summary: result.summary,
      }).eq("id", change.id);

      const updated = { ...change, ...result };
      analyzed.push(updated);

      if (result.relevance === "critical") criticals.push(updated);
      else if (result.relevance === "high") highs.push(updated);
    } catch {
      // Skip on error, will retry tomorrow
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Send critical alerts immediately
  for (const c of criticals) {
    try {
      await sendCriticalAlert(c, nameMap[c.source_id] ?? "Competidor");
    } catch { /* continue */ }
  }

  // Send daily digest for high+medium changes
  const digestChanges = analyzed.filter((c) => c.relevance === "high" || c.relevance === "medium");
  if (digestChanges.length > 0) {
    try {
      await sendDailyDigest(digestChanges, nameMap);
    } catch { /* continue */ }
  }

  return NextResponse.json({
    ok: true,
    analyzed: analyzed.length,
    criticals: criticals.length,
    digest: digestChanges.length,
    ts: new Date().toISOString(),
  });
}
