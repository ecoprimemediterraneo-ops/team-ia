/**
 * Lucía · Brief diario + Compromisos + Brief reunión + Reportes.
 */
import { anthropic, MODELS } from "@/lib/claude";
import type { LuciaProfile } from "./lucia-profile";

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

// ===== Daily brief =====
export type DailyBrief = {
  id: string;
  brief_date: string;
  resumen: string;
  emails_urgentes: number;
  emails_total: number;
  reuniones_hoy: number;
  propuestas_pendientes: number;
  highlights: string[];
};

export async function generateDailyBrief(input: {
  owner_email: string;
  profile: LuciaProfile;
  emails_recientes?: Array<{ from: string; subject: string; snippet: string; intent?: string }>;
}): Promise<DailyBrief | null> {
  const today = new Date().toISOString().slice(0, 10);
  const emails = input.emails_recientes ?? [];
  const total = emails.length;
  const urgentes = emails.filter((e) => e.intent === "urgente" || e.intent === "queja").length;
  const reuniones = emails.filter((e) => /reunion|reunión|meet|llamada/i.test(e.subject + e.snippet)).length;
  const propuestas = emails.filter((e) => /propuesta|presupuesto/i.test(e.subject + e.snippet)).length;

  let resumen = `Buenos días${input.profile.nombre_persona ? ` ${input.profile.nombre_persona}` : ""}. Tienes ${total} emails (${urgentes} urgentes), ${reuniones} mencionan reunión y ${propuestas} hablan de propuestas.`;
  let highlights: string[] = [];

  if (emails.length > 0) {
    try {
      const c = await anthropic.messages.create({
        model: MODELS.fast,
        max_tokens: 800,
        temperature: 0.3,
        system: `Asistente ejecutiva. Generas brief matinal claro y accionable en español. JSON: {"resumen":"2-3 frases","highlights":["item 1","item 2","..."]}`,
        messages: [{ role: "user", content: `Persona: ${input.profile.nombre_persona || "el usuario"}. Hoy: ${today}.\nEmails recibidos:\n${emails.slice(0, 30).map((e) => `- ${e.from}: ${e.subject} — ${e.snippet.slice(0, 100)}`).join("\n")}\n\nGenera JSON.` }],
      });
      const block = c.content[0]; const text = block && block.type === "text" ? block.text.trim() : ""; const m = text.match(/\{[\s\S]*\}/);
      if (m) { const p = JSON.parse(m[0]); resumen = p.resumen || resumen; highlights = Array.isArray(p.highlights) ? p.highlights.slice(0, 8) : []; }
    } catch (e) { console.error("[lucia-brief]", e); }
  }

  const db = getClient();
  if (!db) return { id: "no-db", brief_date: today, resumen, emails_urgentes: urgentes, emails_total: total, reuniones_hoy: reuniones, propuestas_pendientes: propuestas, highlights };

  const { data } = await (db as Row).from("lucia_daily_briefs").upsert({
    owner_email: input.owner_email, brief_date: today, resumen,
    emails_urgentes: urgentes, emails_total: total, reuniones_hoy: reuniones, propuestas_pendientes: propuestas,
    highlights,
  }, { onConflict: "owner_email,brief_date" }).select().single();
  return data;
}

export async function listDailyBriefs(owner_email: string, limit = 14) {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("lucia_daily_briefs").select("*").eq("owner_email", owner_email).order("brief_date", { ascending: false }).limit(limit);
  return data ?? [];
}

// ===== Compromisos =====
export type Compromiso = { id: string; compromiso_texto: string; fecha_limite: string | null; destinatario: string | null; status: string; created_at: string; origen_email: string | null };

export async function detectCompromisos(input: { owner_email: string; sentEmails: Array<{ id?: string; to: string; subject: string; body: string }> }): Promise<Compromiso[]> {
  if (input.sentEmails.length === 0) return [];
  try {
    const c = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 1200,
      temperature: 0.2,
      system: `Detector de compromisos sueltos en emails enviados. Extraes promesas concretas con fecha (ej: "te envío X el martes", "te paso la propuesta esta semana"). JSON:
{"compromisos":[{"texto":"...","fecha_limite":"YYYY-MM-DD o null","destinatario":"email","origen_subject":"..."}]}`,
      messages: [{ role: "user", content: `Emails enviados:\n${input.sentEmails.slice(0, 20).map((e) => `→ ${e.to} · "${e.subject}"\n${e.body.slice(0, 400)}`).join("\n\n")}\n\nExtrae compromisos.` }],
    });
    const block = c.content[0]; const text = block && block.type === "text" ? block.text.trim() : ""; const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed.compromisos)) return [];

    const db = getClient();
    if (!db) return [];
    const rows = parsed.compromisos.map((c: Row) => ({
      owner_email: input.owner_email,
      compromiso_texto: c.texto,
      fecha_limite: c.fecha_limite || null,
      destinatario: c.destinatario || null,
      origen_email: c.origen_subject || null,
    }));
    const { data } = await (db as Row).from("lucia_compromisos").insert(rows).select();
    return data ?? [];
  } catch (e) { console.error("[lucia-compromisos]", e); return []; }
}

export async function listCompromisos(owner_email: string, status?: string) {
  const db = getClient();
  if (!db) return [];
  let q = (db as Row).from("lucia_compromisos").select("*").eq("owner_email", owner_email);
  if (status) q = q.eq("status", status);
  const { data } = await q.order("fecha_limite", { ascending: true }).limit(100);
  return data ?? [];
}

export async function updateCompromiso(id: string, owner_email: string, status: "cumplido" | "descartado" | "vencido") {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("lucia_compromisos").update({ status, cumplido_at: status === "cumplido" ? new Date().toISOString() : null }).eq("id", id).eq("owner_email", owner_email);
}

// ===== Brief reunión =====
export async function generateMeetingBrief(input: { owner_email: string; meeting_with: string; meeting_at?: string; profile: LuciaProfile; related_emails?: Array<{ subject: string; body: string }> }) {
  try {
    const c = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 1500,
      temperature: 0.3,
      system: `Asistente ejecutiva. Generas brief de reunión en markdown claro: contexto + temas a tratar + puntos pendientes + preguntas sugeridas. JSON: {"brief":"<markdown>","topics":["..."]}`,
      messages: [{ role: "user", content: `Reunión con: ${input.meeting_with}\nCuándo: ${input.meeting_at || "próximamente"}\n\nEmails relacionados:\n${(input.related_emails || []).slice(0, 10).map((e) => `"${e.subject}": ${e.body.slice(0, 300)}`).join("\n\n")}\n\nGenera brief.` }],
    });
    const block = c.content[0]; const text = block && block.type === "text" ? block.text.trim() : ""; const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);

    const db = getClient();
    if (!db) return { id: "no-db", brief_text: parsed.brief, topics: parsed.topics || [], meeting_with: input.meeting_with, meeting_at: input.meeting_at };

    const { data } = await (db as Row).from("lucia_meeting_briefs").insert({
      owner_email: input.owner_email,
      meeting_with: input.meeting_with,
      meeting_at: input.meeting_at || null,
      brief_text: parsed.brief,
      topics: parsed.topics || [],
      related_thread_ids: [],
    }).select().single();
    return data;
  } catch (e) { console.error("[lucia-meet]", e); return null; }
}

export async function listMeetingBriefs(owner_email: string) {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("lucia_meeting_briefs").select("*").eq("owner_email", owner_email).order("meeting_at", { ascending: false }).limit(30);
  return data ?? [];
}

// ===== Reportes =====
function currentPeriod(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

export async function generateReporte(input: { owner_email: string; profile: LuciaProfile; periodo?: string }) {
  const periodo = input.periodo || currentPeriod();
  const briefs = await listDailyBriefs(input.owner_email, 31);
  const filtered = briefs.filter((b: Row) => b.brief_date?.startsWith(periodo));

  const total_emails = filtered.reduce((s: number, b: Row) => s + (b.emails_total || 0), 0);
  const total_urgentes = filtered.reduce((s: number, b: Row) => s + (b.emails_urgentes || 0), 0);
  const reuniones_mes = filtered.reduce((s: number, b: Row) => s + (b.reuniones_hoy || 0), 0);
  const compromisos = await listCompromisos(input.owner_email);
  const compromisos_pendientes = compromisos.filter((c: Row) => c.status === "pendiente").length;
  const compromisos_cumplidos = compromisos.filter((c: Row) => c.status === "cumplido").length;

  const metricas = {
    emails_procesados: total_emails,
    urgentes_atendidos: total_urgentes,
    reuniones_brief_generados: reuniones_mes,
    compromisos_cumplidos,
    compromisos_pendientes,
    minutos_ahorrados_estim: total_emails * 2,
  };

  let resumen_ejecutivo = `Lucía procesó ${total_emails} emails en ${periodo}, identificó ${total_urgentes} urgentes y ahorró ~${total_emails * 2} minutos de bandeja.`;
  let insights: string[] = []; let recomendaciones: string[] = [];

  if (total_emails > 0) {
    try {
      const c = await anthropic.messages.create({
        model: MODELS.fast, max_tokens: 1000, temperature: 0.4,
        system: `Analista productividad. JSON: {"resumen_ejecutivo":"...","insights":["..."],"recomendaciones":["..."]}`,
        messages: [{ role: "user", content: `Persona: ${input.profile.nombre_persona}. Periodo ${periodo}. ${total_emails} emails, ${total_urgentes} urgentes, ${reuniones_mes} reuniones. Compromisos: ${compromisos_cumplidos} cumplidos / ${compromisos_pendientes} pendientes.` }],
      });
      const block = c.content[0]; const text = block && block.type === "text" ? block.text.trim() : ""; const m = text.match(/\{[\s\S]*\}/);
      if (m) { const p = JSON.parse(m[0]); resumen_ejecutivo = p.resumen_ejecutivo || resumen_ejecutivo; insights = p.insights?.slice(0, 5) || []; recomendaciones = p.recomendaciones?.slice(0, 5) || []; }
    } catch (e) { console.error(e); }
  } else { insights = ["Sin briefs en este periodo."]; recomendaciones = ["Conecta Gmail y deja que Lucía procese tu bandeja al menos 1 semana."]; }

  const db = getClient();
  if (!db) return { id: "no-db", owner_email: input.owner_email, periodo, resumen_ejecutivo, metricas, insights, recomendaciones, created_at: new Date().toISOString() };
  const { data } = await (db as Row).from("lucia_reportes").upsert({ owner_email: input.owner_email, periodo, resumen_ejecutivo, metricas, insights, recomendaciones }, { onConflict: "owner_email,periodo" }).select().single();
  return data;
}

export async function listReportes(owner_email: string) {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("lucia_reportes").select("*").eq("owner_email", owner_email).order("periodo", { ascending: false }).limit(12);
  return data ?? [];
}
