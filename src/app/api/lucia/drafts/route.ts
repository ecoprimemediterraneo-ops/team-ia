/**
 * GET /api/lucia/drafts — lista de borradores generados + métricas
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listLuciaDrafts, getLuciaMetrics } from "@/lib/lucia-db";
import { getLuciaProfile } from "@/lib/lucia-profile";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [drafts, metrics, profile] = await Promise.all([
    listLuciaDrafts(s.email, 50),
    getLuciaMetrics(s.email),
    getLuciaProfile(s.email),
  ]);

  const total = profile.aprobaciones_count + profile.rechazos_count;
  const pct = total > 0 ? Math.round((profile.aprobaciones_count / total) * 100) : 0;

  return NextResponse.json({
    drafts,
    metrics,
    modo: profile.modo_activacion,
    aprobaciones: profile.aprobaciones_count,
    rechazos: profile.rechazos_count,
    porcentaje_aprobacion: pct,
  });
}
