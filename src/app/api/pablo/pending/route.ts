import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listPabloPending, countPabloByStatus } from "@/lib/pablo-pending";
import { getPabloProfile } from "@/lib/pablo-profile";
import { listWaLeadsByOwner } from "@/lib/pablo-wa-db";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pending, counts, profile, leads] = await Promise.all([
    listPabloPending(s.email, "pending", 50),
    countPabloByStatus(s.email),
    getPabloProfile(s.email),
    listWaLeadsByOwner(s.email, 20),
  ]);

  const total = profile.aprobaciones_count + profile.rechazos_count;
  const pct = total > 0 ? Math.round((profile.aprobaciones_count / total) * 100) : 0;
  const shouldSuggestAuto = profile.modo_activacion === "ruedines" && total >= 30 && pct >= 85;

  return NextResponse.json({
    pending,
    leads,
    counts,
    modo: profile.modo_activacion,
    aprobaciones: profile.aprobaciones_count,
    rechazos: profile.rechazos_count,
    porcentaje_aprobacion: pct,
    sugerencia_auto: shouldSuggestAuto,
  });
}
