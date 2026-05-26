/**
 * GET /api/rocio/pending — lista respuestas pendientes + reseñas asociadas + métricas
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listRocioPending, listReviews, getRocioMetrics } from "@/lib/rocio-db";
import { getRocioProfile } from "@/lib/rocio-profile";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pending, reviews, profile, metrics] = await Promise.all([
    listRocioPending(s.email, "pending"),
    listReviews(s.email, { limit: 100 }),
    getRocioProfile(s.email),
    getRocioMetrics(s.email),
  ]);

  // Enriquecer pending con review asociada
  const reviewMap = new Map(reviews.map((r) => [r.id, r]));
  const enriched = pending.map((p) => ({
    ...p,
    review: reviewMap.get(p.review_id) ?? null,
  }));

  const total = profile.aprobaciones_count + profile.rechazos_count;
  const pctAprob = total > 0 ? Math.round((profile.aprobaciones_count / total) * 100) : 0;
  const shouldSuggestAuto = profile.modo_activacion === "ruedines" && total >= 20 && pctAprob >= 85;

  return NextResponse.json({
    pending: enriched,
    metrics,
    modo: profile.modo_activacion,
    aprobaciones: profile.aprobaciones_count,
    rechazos: profile.rechazos_count,
    porcentaje_aprobacion: pctAprob,
    sugerencia_auto: shouldSuggestAuto,
  });
}
