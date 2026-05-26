/**
 * Marta · Reportes mensuales ejecutivos (para guardar / imprimir / mostrar al jefe).
 */
import { anthropic, MODELS } from "@/lib/claude";
import { listAnalytics } from "./marta-analytics";
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

export type Reporte = {
  id: string;
  owner_email: string;
  periodo: string;
  resumen_ejecutivo: string;
  metricas: Record<string, number | string>;
  insights: string[];
  recomendaciones: string[];
  created_at: string;
};

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function generateReporte(input: { owner_email: string; profile: MartaProfile; periodo?: string }): Promise<Reporte | null> {
  const periodo = input.periodo || currentPeriod();
  const all = await listAnalytics(input.owner_email, 200);

  // Filtrar por periodo (YYYY-MM)
  const posts = all.filter((p) => p.publicado_at && p.publicado_at.startsWith(periodo));

  const total_posts = posts.length;
  const total_reach = posts.reduce((s, p) => s + (p.reach || 0), 0);
  const total_likes = posts.reduce((s, p) => s + (p.likes || 0), 0);
  const total_comments = posts.reduce((s, p) => s + (p.comments || 0), 0);
  const avg_engagement = posts.length > 0 ? posts.reduce((s, p) => s + (Number(p.engagement_rate) || 0), 0) / posts.length : 0;
  const top = [...posts].sort((a, b) => (Number(b.engagement_rate) || 0) - (Number(a.engagement_rate) || 0))[0];

  const metricas = {
    total_posts,
    total_reach,
    total_likes,
    total_comments,
    avg_engagement: Number(avg_engagement.toFixed(2)),
    top_post: top ? `${top.titulo || "(sin título)"} — ${top.engagement_rate}%` : "n/a",
  };

  const negocio = input.profile.nombre_negocio || "el negocio";

  let resumen_ejecutivo = `Resumen del periodo ${periodo} para ${negocio}: ${total_posts} publicaciones con ${total_reach.toLocaleString("es-ES")} alcance acumulado y ${avg_engagement.toFixed(2)}% de engagement medio.`;
  let insights: string[] = [];
  let recomendaciones: string[] = [];

  if (total_posts >= 1) {
    try {
      const c = await anthropic.messages.create({
        model: MODELS.fast,
        max_tokens: 1500,
        temperature: 0.4,
        system: `Eres analista de marketing de Instagram. Generas un reporte ejecutivo en español de España, claro y accionable. Sin paja.

FORMATO JSON estricto:
{
  "resumen_ejecutivo": "<2-3 frases ejecutivas del periodo>",
  "insights": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "recomendaciones": ["<acción 1>", "<acción 2>", "<acción 3>"]
}`,
        messages: [{
          role: "user",
          content: `Negocio: ${negocio}. Periodo: ${periodo}.
Datos:
- Publicaciones: ${total_posts}
- Alcance total: ${total_reach}
- Likes: ${total_likes}
- Comentarios: ${total_comments}
- Engagement medio: ${avg_engagement.toFixed(2)}%
- Top post: ${metricas.top_post}

Posts por tipo: ${JSON.stringify(posts.reduce((acc: Row, p) => { acc[p.tipo_post] = (acc[p.tipo_post] || 0) + 1; return acc; }, {}))}

Genera el JSON.`,
        }],
      });
      const block = c.content[0];
      const text = block && block.type === "text" ? block.text.trim() : "";
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (parsed.resumen_ejecutivo) resumen_ejecutivo = parsed.resumen_ejecutivo;
        if (Array.isArray(parsed.insights)) insights = parsed.insights.slice(0, 5);
        if (Array.isArray(parsed.recomendaciones)) recomendaciones = parsed.recomendaciones.slice(0, 5);
      }
    } catch (e) { console.error("[reporte]", e); }
  } else {
    insights = ["Aún no hay publicaciones registradas en este periodo."];
    recomendaciones = ["Publica al menos 4-6 piezas/mes para tener datos significativos."];
  }

  const db = getClient();
  if (!db) {
    return { id: "no-db", owner_email: input.owner_email, periodo, resumen_ejecutivo, metricas, insights, recomendaciones, created_at: new Date().toISOString() };
  }

  const { data, error } = await (db as Row)
    .from("marta_reportes")
    .upsert({ owner_email: input.owner_email, periodo, resumen_ejecutivo, metricas, insights, recomendaciones }, { onConflict: "owner_email,periodo" })
    .select()
    .single();
  if (error) { console.error("[reporte upsert]", error); return null; }
  return data;
}

export async function listReportes(owner_email: string) {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("marta_reportes").select("*").eq("owner_email", owner_email).order("periodo", { ascending: false }).limit(24);
  return data ?? [];
}
