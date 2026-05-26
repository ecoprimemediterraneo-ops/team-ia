/**
 * GET /api/marta/pending — lista de respuestas pendientes de aprobación + contadores
 *                         + estado del modo (ruedines/auto) + sugerencia upgrade
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listPending, countByStatus } from "@/lib/marta-pending";
import { getMartaProfile } from "@/lib/marta-profile";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pending, counts, profile] = await Promise.all([
    listPending(s.email, "pending", 50),
    countByStatus(s.email),
    getMartaProfile(s.email),
  ]);

  const total = profile.aprobaciones_count + profile.rechazos_count;
  const pctAprob = total > 0 ? Math.round((profile.aprobaciones_count / total) * 100) : 0;

  // Sugerir upgrade a auto si: ≥30 respuestas + ≥85% aprobación + sigue en ruedines
  const shouldSuggestAuto =
    profile.modo_activacion === "ruedines" && total >= 30 && pctAprob >= 85;

  return NextResponse.json({
    pending,
    counts,
    modo: profile.modo_activacion,
    aprobaciones: profile.aprobaciones_count,
    rechazos: profile.rechazos_count,
    porcentaje_aprobacion: pctAprob,
    sugerencia_auto: shouldSuggestAuto,
  });
}
