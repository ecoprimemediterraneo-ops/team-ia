/**
 * Cron nocturno (02:30 UTC) — analiza últimos posts y genera recomendaciones.
 */
import { NextResponse } from "next/server";
import { runAnalyticsLearningCron } from "@/lib/marta-analytics";
import { checkCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const a = checkCronAuth(req);
  if (!a.ok) return NextResponse.json({ error: a.reason }, { status: 401 });

  const result = await runAnalyticsLearningCron();
  return NextResponse.json({ ok: true, ...result, ts: new Date().toISOString() });
}
