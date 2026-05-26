/**
 * Marta · Analytics post-publicación + auto-mejora.
 *
 * Hoy: el cliente puede registrar métricas a mano de sus posts.
 * Cuando Meta apruebe Insights API: el cron las trae automáticamente.
 *
 * Análisis nocturno con Claude que mira últimos 30 días, detecta patrones
 * y genera recomendaciones accionables.
 */

import { anthropic, MODELS } from "@/lib/claude";
import type { MartaProfile } from "./marta-profile";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key);
}

export type PostType = "post" | "reel" | "carrusel" | "story";
export type Tier = "top" | "above_avg" | "avg" | "below_avg";

export type PostAnalytic = {
  id: string;
  owner_email: string;
  ig_media_id: string | null;
  tipo_post: PostType;
  titulo: string | null;
  hashtags: string | null;
  publicado_at: string | null;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  engagement_rate: number | null;
  performance_tier: Tier | null;
  created_at: string;
};

export type Recomendacion = {
  id: string;
  owner_email: string;
  titulo: string;
  insight: string;
  accion_sugerida: string;
  prioridad: "alta" | "media" | "baja";
  status: "nueva" | "aceptada" | "descartada";
  created_at: string;
};

export function calcEngagement(p: { likes: number; comments: number; saves: number; reach: number }): number {
  if (p.reach <= 0) return 0;
  return Math.round(((p.likes + p.comments + p.saves) / p.reach) * 100 * 100) / 100;
}

export function tierFromEngagement(rate: number): Tier {
  if (rate >= 8) return "top";
  if (rate >= 4) return "above_avg";
  if (rate >= 2) return "avg";
  return "below_avg";
}

// ─── CRUD analytics ─────────────────────────────────────────────────────────

export async function upsertAnalytic(input: {
  owner_email: string;
  ig_media_id?: string;
  tipo_post: PostType;
  titulo?: string;
  hashtags?: string;
  publicado_at?: string;
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
}): Promise<PostAnalytic | null> {
  const db = getClient();
  if (!db) return null;
  const reach = input.reach ?? 0;
  const likes = input.likes ?? 0;
  const comments = input.comments ?? 0;
  const saves = input.saves ?? 0;
  const engagement_rate = calcEngagement({ likes, comments, saves, reach });
  const performance_tier = tierFromEngagement(engagement_rate);

  const { data, error } = await (db as Row)
    .from("marta_post_analytics")
    .upsert(
      {
        owner_email: input.owner_email,
        ig_media_id: input.ig_media_id ?? null,
        tipo_post: input.tipo_post,
        titulo: input.titulo ?? null,
        hashtags: input.hashtags ?? null,
        publicado_at: input.publicado_at ?? null,
        impressions: input.impressions ?? 0,
        reach,
        likes,
        comments,
        saves,
        shares: input.shares ?? 0,
        engagement_rate,
        performance_tier,
      },
      { onConflict: "owner_email,ig_media_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listAnalytics(owner_email: string, limit = 50): Promise<PostAnalytic[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("marta_post_analytics")
    .select("*")
    .eq("owner_email", owner_email)
    .order("publicado_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return data ?? [];
}

export async function getAnalyticsSummary(owner_email: string): Promise<{
  total: number;
  top_count: number;
  avg_engagement: number;
  best_tipo: PostType | null;
  best_day: string | null;
}> {
  const all = await listAnalytics(owner_email, 100);
  if (all.length === 0) {
    return { total: 0, top_count: 0, avg_engagement: 0, best_tipo: null, best_day: null };
  }
  const top = all.filter((a) => a.performance_tier === "top");
  const avg = all.reduce((s, a) => s + (a.engagement_rate || 0), 0) / all.length;

  // Mejor tipo
  const byTipo = new Map<PostType, { count: number; sum: number }>();
  for (const a of all) {
    const e = byTipo.get(a.tipo_post) || { count: 0, sum: 0 };
    e.count++;
    e.sum += a.engagement_rate || 0;
    byTipo.set(a.tipo_post, e);
  }
  let best_tipo: PostType | null = null;
  let bestRate = -1;
  for (const [t, v] of byTipo.entries()) {
    const r = v.count > 0 ? v.sum / v.count : 0;
    if (r > bestRate) { bestRate = r; best_tipo = t; }
  }

  // Mejor día de la semana
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const byDay = new Map<string, { count: number; sum: number }>();
  for (const a of all) {
    if (!a.publicado_at) continue;
    const d = days[new Date(a.publicado_at).getDay()];
    const e = byDay.get(d) || { count: 0, sum: 0 };
    e.count++;
    e.sum += a.engagement_rate || 0;
    byDay.set(d, e);
  }
  let best_day: string | null = null;
  let bestDayRate = -1;
  for (const [d, v] of byDay.entries()) {
    const r = v.count > 0 ? v.sum / v.count : 0;
    if (r > bestDayRate) { bestDayRate = r; best_day = d; }
  }

  return {
    total: all.length,
    top_count: top.length,
    avg_engagement: Math.round(avg * 100) / 100,
    best_tipo,
    best_day,
  };
}

// ─── Recomendaciones (con Claude) ──────────────────────────────────────────

export async function generateRecomendaciones(
  owner_email: string,
  profile: MartaProfile,
): Promise<number> {
  const analytics = await listAnalytics(owner_email, 50);
  if (analytics.length < 3) return 0; // necesitamos datos

  const summary = await getAnalyticsSummary(owner_email);

  const userPrompt = `Datos del negocio: ${profile.nombre_negocio} (${profile.sector || "negocio local"})

RESUMEN ÚLTIMOS POSTS (${analytics.length} publicaciones):
- Engagement medio: ${summary.avg_engagement}%
- Posts top (engagement >8%): ${summary.top_count}
- Mejor tipo de contenido: ${summary.best_tipo}
- Mejor día publicar: ${summary.best_day}

DETALLE TOP 10 POSTS POR ENGAGEMENT:
${analytics
  .slice()
  .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0))
  .slice(0, 10)
  .map(
    (a, i) =>
      `${i + 1}. [${a.tipo_post}] "${(a.titulo || "").slice(0, 60)}" — engagement ${a.engagement_rate}%, reach ${a.reach}, likes ${a.likes}, comments ${a.comments}, saves ${a.saves}${a.publicado_at ? `, publicado ${new Date(a.publicado_at).toLocaleDateString("es-ES")}` : ""}`,
  )
  .join("\n")}

Genera 3-5 RECOMENDACIONES accionables basadas en estos datos.

FORMATO JSON estricto (array, sin texto antes/después):
[
  {
    "titulo": "<titular corto>",
    "insight": "<observación concreta basada en los datos>",
    "accion_sugerida": "<qué hacer mañana>",
    "prioridad": "alta|media|baja"
  }
]

Reglas:
- Cita números reales de los datos
- Acción sugerida ESPECÍFICA, no "publica más", sino "publica un reel sobre X el martes a las 19h"
- Prioridad alta solo si la diferencia es brutal (>2x)
- Máximo 5 recomendaciones`;

  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 1500,
      temperature: 0.4,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = completion.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return 0;
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed)) return 0;

    const db = getClient();
    if (!db) return 0;

    // Borrar las recomendaciones "nuevas" anteriores para no acumular duplicados
    await (db as Row)
      .from("marta_recomendaciones")
      .delete()
      .eq("owner_email", owner_email)
      .eq("status", "nueva");

    const rows = parsed
      .filter((r: Row) => typeof r.titulo === "string" && typeof r.insight === "string" && typeof r.accion_sugerida === "string")
      .slice(0, 5)
      .map((r: Row) => ({
        owner_email,
        titulo: r.titulo.slice(0, 200),
        insight: r.insight.slice(0, 500),
        accion_sugerida: r.accion_sugerida.slice(0, 500),
        prioridad: ["alta", "media", "baja"].includes(r.prioridad) ? r.prioridad : "media",
        source_data: { summary },
        status: "nueva",
      }));

    if (rows.length === 0) return 0;
    const { error } = await (db as Row).from("marta_recomendaciones").insert(rows);
    if (error) throw error;
    return rows.length;
  } catch (e) {
    console.error("[marta-analytics]", e);
    return 0;
  }
}

export async function listRecomendaciones(
  owner_email: string,
  status: "nueva" | "aceptada" | "descartada" = "nueva",
): Promise<Recomendacion[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("marta_recomendaciones")
    .select("*")
    .eq("owner_email", owner_email)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function setRecomendacionStatus(
  id: string,
  owner_email: string,
  status: "aceptada" | "descartada",
): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row)
    .from("marta_recomendaciones")
    .update({ status })
    .eq("id", id)
    .eq("owner_email", owner_email);
}

/** Cron nocturno: procesa todos los clientes con ≥3 posts publicados */
export async function runAnalyticsLearningCron(): Promise<{ owners: number; recs: number }> {
  const db = getClient();
  if (!db) return { owners: 0, recs: 0 };

  const { data: ownersData } = await (db as Row)
    .from("marta_post_analytics")
    .select("owner_email")
    .order("owner_email");

  const owners: string[] = Array.from(new Set((ownersData ?? []).map((r: Row) => String(r.owner_email))));
  let totalRecs = 0;

  for (const owner of owners) {
    const { getMartaProfile } = await import("./marta-profile");
    const profile = await getMartaProfile(owner);
    if (!profile.nombre_negocio) continue;
    const n = await generateRecomendaciones(owner, profile);
    totalRecs += n;
  }

  return { owners: owners.length, recs: totalRecs };
}
