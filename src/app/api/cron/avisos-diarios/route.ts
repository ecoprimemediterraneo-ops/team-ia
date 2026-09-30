// Avisos diarios (desde n8n, con CRON_SECRET):
//   ?que=resumen    → resumen de la dueña (programar 8:30 hora de España)
//   ?que=cumpleanos → felicitaciones (programar entre 10:00 y 20:00)
// Los dos APAGADOS salvo DAILY_SUMMARY_ENABLED / BIRTHDAY_ENABLED = true.
import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { pasadaResumenDiario, pasadaCumpleanos } from "@/lib/avisos-diarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(req: Request) {
  const err = cronAuthError(req);
  if (err) return err;
  const q = new URL(req.url).searchParams;
  const que = q.get("que");
  if (que === "resumen") return NextResponse.json({ ok: true, ...(await pasadaResumenDiario(new Date(), q.get("tenant") || undefined)) });
  if (que === "cumpleanos") return NextResponse.json({ ok: true, ...(await pasadaCumpleanos()) });
  return NextResponse.json({ ok: false, error: "que=resumen|cumpleanos" }, { status: 400 });
}
export const GET = run;
export const POST = run;
