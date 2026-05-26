/**
 * Pablo · Analytics WhatsApp + A/B tests + Reportes.
 */
import { anthropic, MODELS } from "@/lib/claude";
import type { PabloProfile } from "./pablo-profile";

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

export type MsgAnalytic = {
  id: string;
  owner_email: string;
  intent: string | null;
  message_in: string | null;
  message_out: string | null;
  status: string;
  converted: boolean;
  conversion_value: number | null;
  responded_at: string;
  converted_at: string | null;
};

export async function trackMessage(input: {
  owner_email: string;
  conversation_id?: string;
  intent: string;
  message_in: string;
  message_out: string;
  variant_letra?: string;
  response_template_id?: string;
}) {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row).from("pablo_message_analytics").insert(input).select().single();
  if (error) console.error("[pablo-analytics]", error);
  return data;
}

export async function markConverted(id: string, owner_email: string, value?: number) {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("pablo_message_analytics").update({
    converted: true,
    conversion_value: value ?? null,
    converted_at: new Date().toISOString(),
    status: "converted",
  }).eq("id", id).eq("owner_email", owner_email);
}

export async function listAnalytics(owner_email: string, limit = 200): Promise<MsgAnalytic[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("pablo_message_analytics").select("*").eq("owner_email", owner_email).order("responded_at", { ascending: false }).limit(limit);
  return data ?? [];
}

export async function getAnalyticsSummary(owner_email: string) {
  const all = await listAnalytics(owner_email, 500);
  const total = all.length;
  const converted = all.filter((m) => m.converted).length;
  const conv_rate = total > 0 ? (converted / total) * 100 : 0;
  const total_value = all.reduce((s, m) => s + (Number(m.conversion_value) || 0), 0);

  const by_intent: Record<string, { total: number; converted: number; rate: number }> = {};
  for (const m of all) {
    const k = m.intent || "otro";
    if (!by_intent[k]) by_intent[k] = { total: 0, converted: 0, rate: 0 };
    by_intent[k].total++;
    if (m.converted) by_intent[k].converted++;
  }
  for (const k of Object.keys(by_intent)) {
    by_intent[k].rate = by_intent[k].total > 0 ? (by_intent[k].converted / by_intent[k].total) * 100 : 0;
  }

  return { total, converted, conv_rate: Number(conv_rate.toFixed(2)), total_value, by_intent };
}

// ===== A/B Tests =====
export type AbVariant = { letra: "A" | "B" | "C"; body: string; rationale: string; sent_count?: number; converted_count?: number };

export async function generateAbVariants(input: { tema: string; intent: string; profile: PabloProfile }): Promise<AbVariant[]> {
  try {
    const c = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 1000,
      temperature: 0.8,
      system: `Eres Pablo, especialista en respuestas WhatsApp para "${input.profile.nombre_negocio || "el negocio"}" (${input.profile.sector || "negocio local"}). Tono: ${input.profile.tono_marca || "cercano"}.

Generas 3 versiones distintas de respuesta para mensaje WhatsApp. Cada una usa enfoque diferente:
- A: directo y eficiente
- B: cálido y empático
- C: con CTA fuerte (llama a acción)

Máximo 4 frases por respuesta. JSON estricto:
{"variantes":[{"letra":"A","body":"...","rationale":"por qué funciona"},...]}`,
      messages: [{ role: "user", content: `Intent: ${input.intent}\nTema/contexto: ${input.tema}\n\nGenera 3 variantes.` }],
    });
    const block = c.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    return Array.isArray(parsed.variantes) ? parsed.variantes.slice(0, 3) : [];
  } catch (e) { console.error("[pablo-ab]", e); return []; }
}

export async function saveAbTest(input: { owner_email: string; intent: string; tema: string; variantes: AbVariant[] }) {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row).from("pablo_ab_tests").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function listAbTests(owner_email: string) {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("pablo_ab_tests").select("*").eq("owner_email", owner_email).order("created_at", { ascending: false }).limit(30);
  return data ?? [];
}

export async function resolveAbTest(id: string, owner_email: string, winner: "A" | "B" | "C") {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("pablo_ab_tests").update({ winner_letra: winner, status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id).eq("owner_email", owner_email);
}

// ===== Templates por intent =====
export type Template = { id: string; intent: string; titulo: string; body: string; uso_count: number; active: boolean };

export const INTENTS_PABLO = ["precio", "info", "queja", "lead", "pedido", "cita", "ubicacion", "horario"];

export async function listTemplates(owner_email: string): Promise<Template[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("pablo_templates_intent").select("*").eq("owner_email", owner_email).eq("active", true).order("uso_count", { ascending: false });
  return data ?? [];
}

export async function createTemplate(input: { owner_email: string; intent: string; titulo: string; body: string }) {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row).from("pablo_templates_intent").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTemplate(id: string, owner_email: string) {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("pablo_templates_intent").delete().eq("id", id).eq("owner_email", owner_email);
}

// ===== Reportes =====
function currentPeriod(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

export async function generateReporte(input: { owner_email: string; profile: PabloProfile; periodo?: string }) {
  const periodo = input.periodo || currentPeriod();
  const all = await listAnalytics(input.owner_email, 1000);
  const filtered = all.filter((m) => m.responded_at?.startsWith(periodo));

  const total = filtered.length;
  const converted = filtered.filter((m) => m.converted).length;
  const conv_rate = total > 0 ? (converted / total) * 100 : 0;
  const total_value = filtered.reduce((s, m) => s + (Number(m.conversion_value) || 0), 0);
  const by_intent: Record<string, number> = {};
  for (const m of filtered) { const k = m.intent || "otro"; by_intent[k] = (by_intent[k] || 0) + 1; }

  const metricas = { total_mensajes: total, conversiones: converted, conv_rate: Number(conv_rate.toFixed(2)), valor_eur: total_value };
  let resumen_ejecutivo = `${input.profile.nombre_negocio || "El negocio"} atendió ${total} mensajes en ${periodo} con ${converted} conversiones (${conv_rate.toFixed(1)}%).`;
  let insights: string[] = [];
  let recomendaciones: string[] = [];

  if (total > 0) {
    try {
      const c = await anthropic.messages.create({
        model: MODELS.fast,
        max_tokens: 1200,
        temperature: 0.4,
        system: `Analista WhatsApp. Genera reporte JSON: {"resumen_ejecutivo":"...","insights":["..."],"recomendaciones":["..."]}`,
        messages: [{ role: "user", content: `Negocio: ${input.profile.nombre_negocio}. Sector: ${input.profile.sector}. Periodo: ${periodo}.\nTotal: ${total}. Conv: ${converted} (${conv_rate.toFixed(1)}%). Valor: ${total_value}€.\nPor intent: ${JSON.stringify(by_intent)}.` }],
      });
      const block = c.content[0]; const text = block && block.type === "text" ? block.text.trim() : ""; const m = text.match(/\{[\s\S]*\}/);
      if (m) { const p = JSON.parse(m[0]); resumen_ejecutivo = p.resumen_ejecutivo || resumen_ejecutivo; insights = p.insights?.slice(0, 5) || []; recomendaciones = p.recomendaciones?.slice(0, 5) || []; }
    } catch (e) { console.error(e); }
  } else { insights = ["Sin mensajes en este periodo."]; recomendaciones = ["Verifica la integración Meta WhatsApp."]; }

  const db = getClient();
  if (!db) return { id: "no-db", owner_email: input.owner_email, periodo, resumen_ejecutivo, metricas, insights, recomendaciones, created_at: new Date().toISOString() };
  const { data } = await (db as Row).from("pablo_reportes").upsert({ owner_email: input.owner_email, periodo, resumen_ejecutivo, metricas, insights, recomendaciones }, { onConflict: "owner_email,periodo" }).select().single();
  return data;
}

export async function listReportes(owner_email: string) {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("pablo_reportes").select("*").eq("owner_email", owner_email).order("periodo", { ascending: false }).limit(12);
  return data ?? [];
}
