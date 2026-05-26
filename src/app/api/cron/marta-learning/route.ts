/**
 * Cron nocturno (02:00 UTC) — analiza ediciones recientes de cada cliente
 * y genera sugerencias de reglas custom con Claude.
 */
import { NextResponse } from "next/server";
import { runLearningCronForAllOwners } from "@/lib/marta-learning";
import { checkCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const a = checkCronAuth(req);
  if (!a.ok) return NextResponse.json({ error: a.reason }, { status: 401 });

  const result = await runLearningCronForAllOwners();
  return NextResponse.json({ ok: true, ...result, ts: new Date().toISOString() });
}
