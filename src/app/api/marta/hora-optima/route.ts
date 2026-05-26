/**
 * GET /api/marta/hora-optima
 * Analiza el histórico de posts del cliente y calcula:
 *  - Mejor día semana (por engagement medio)
 *  - Mejor franja horaria (por engagement medio)
 *  - Recomendación accionable
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listAnalytics } from "@/lib/marta-analytics";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const FRANJAS = [
  { v: "madrugada", l: "Madrugada (0-6h)", check: (h: number) => h >= 0 && h < 6 },
  { v: "manana", l: "Mañana (6-12h)", check: (h: number) => h >= 6 && h < 12 },
  { v: "mediodia", l: "Mediodía (12-15h)", check: (h: number) => h >= 12 && h < 15 },
  { v: "tarde", l: "Tarde (15-19h)", check: (h: number) => h >= 15 && h < 19 },
  { v: "primetime", l: "Primetime (19-22h)", check: (h: number) => h >= 19 && h < 22 },
  { v: "noche", l: "Noche (22-24h)", check: (h: number) => h >= 22 },
];

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = await listAnalytics(s.email, 100);
  const withDate = all.filter((a) => a.publicado_at);

  if (withDate.length < 3) {
    return NextResponse.json({
      ok: true,
      mensaje: "Necesitas al menos 3 posts registrados con fecha y hora para calcular tu hora óptima.",
      muestra: withDate.length,
      por_dia: [],
      por_franja: [],
      recomendacion: null,
    });
  }

  // Por día semana
  const porDia = new Map<string, { count: number; sum: number; reach_sum: number }>();
  for (const a of withDate) {
    const d = DAYS[new Date(a.publicado_at!).getDay()];
    const e = porDia.get(d) || { count: 0, sum: 0, reach_sum: 0 };
    e.count++;
    e.sum += a.engagement_rate || 0;
    e.reach_sum += a.reach || 0;
    porDia.set(d, e);
  }
  const por_dia = Array.from(porDia.entries())
    .map(([dia, v]) => ({
      dia,
      posts: v.count,
      engagement_medio: Math.round((v.sum / v.count) * 100) / 100,
      reach_medio: Math.round(v.reach_sum / v.count),
    }))
    .sort((a, b) => b.engagement_medio - a.engagement_medio);

  // Por franja
  const porFranja = new Map<string, { label: string; count: number; sum: number }>();
  for (const f of FRANJAS) porFranja.set(f.v, { label: f.l, count: 0, sum: 0 });
  for (const a of withDate) {
    const h = new Date(a.publicado_at!).getHours();
    const f = FRANJAS.find((x) => x.check(h));
    if (!f) continue;
    const e = porFranja.get(f.v)!;
    e.count++;
    e.sum += a.engagement_rate || 0;
  }
  const por_franja = Array.from(porFranja.entries())
    .filter(([, v]) => v.count > 0)
    .map(([k, v]) => ({
      franja: v.label,
      key: k,
      posts: v.count,
      engagement_medio: Math.round((v.sum / v.count) * 100) / 100,
    }))
    .sort((a, b) => b.engagement_medio - a.engagement_medio);

  const mejorDia = por_dia[0];
  const mejorFranja = por_franja[0];

  let recomendacion: string | null = null;
  if (mejorDia && mejorFranja && mejorDia.posts >= 2 && mejorFranja.posts >= 2) {
    recomendacion = `Tu audiencia está más activa los ${mejorDia.dia.toLowerCase()}s en ${mejorFranja.franja.toLowerCase()} (engagement medio ${mejorDia.engagement_medio}% vs media general). Programa tu próximo post para ese momento.`;
  } else {
    recomendacion = "Sigue publicando para acumular datos. Marta calculará tu hora óptima con más precisión cuando tengas 10+ posts.";
  }

  return NextResponse.json({
    ok: true,
    muestra: withDate.length,
    por_dia,
    por_franja,
    recomendacion,
  });
}
