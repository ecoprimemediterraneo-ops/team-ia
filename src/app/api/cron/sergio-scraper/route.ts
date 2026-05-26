/**
 * Cron diario — lanza el scraping de todas las fuentes activas de Sergio.
 * Registrar en cron-job.org: GET https://aiteam.marketing/api/cron/sergio-scraper
 * Schedule: cada día a las 03:00 UTC
 */
import { NextResponse } from "next/server";
import { scrapeAllActiveSources } from "@/lib/sergio-scraping";
import { checkCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const a = checkCronAuth(req);
  if (!a.ok) return NextResponse.json({ error: a.reason }, { status: 401 });

  try {
    const result = await scrapeAllActiveSources();
    return NextResponse.json({ ok: true, ...result, ts: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
