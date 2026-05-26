import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCampaigns, getEvaMetrics } from "@/lib/eva-campaigns";
import { getEvaProfile } from "@/lib/eva-profile";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [campaigns, metrics, profile] = await Promise.all([
    listCampaigns(s.email, 50),
    getEvaMetrics(s.email),
    getEvaProfile(s.email),
  ]);
  const total = profile.aprobaciones_count + profile.rechazos_count;
  const pct = total > 0 ? Math.round((profile.aprobaciones_count / total) * 100) : 0;
  return NextResponse.json({
    campaigns,
    metrics,
    aprobaciones: profile.aprobaciones_count,
    rechazos: profile.rechazos_count,
    porcentaje_aprobacion: pct,
  });
}
