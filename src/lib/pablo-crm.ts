/**
 * Pablo · CRM (leads + etapas + tagging) + Citas + Catálogo + Keywords + Insights + Voz.
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

// ===== LEADS / PIPELINE =====
export const ETAPAS = ["nuevo", "conversacion", "cita_programada", "cliente", "recurrente", "perdido"] as const;
export type Etapa = typeof ETAPAS[number];

export type Lead = {
  id: string; phone: string; nombre: string | null; etapa: Etapa;
  tags: string[]; notas: string | null; valor_estim: number | null;
  primera_conversacion_at: string; ultima_actividad_at: string;
  fuente: string | null; created_at: string;
};

export async function upsertLead(input: { owner_email: string; phone: string; nombre?: string; fuente?: string }) {
  const db = getClient(); if (!db) return null;
  const { data } = await (db as Row).from("pablo_leads").upsert({ ...input, ultima_actividad_at: new Date().toISOString() }, { onConflict: "owner_email,phone" }).select().single();
  return data;
}
export async function listLeads(owner_email: string, etapa?: string) {
  const db = getClient(); if (!db) return [];
  let q = (db as Row).from("pablo_leads").select("*").eq("owner_email", owner_email);
  if (etapa) q = q.eq("etapa", etapa);
  const { data } = await q.order("ultima_actividad_at", { ascending: false }).limit(200);
  return data ?? [];
}
export async function updateLeadStage(id: string, owner_email: string, patch: Partial<Lead>) {
  const db = getClient(); if (!db) return;
  await (db as Row).from("pablo_leads").update({ ...patch, ultima_actividad_at: new Date().toISOString() }).eq("id", id).eq("owner_email", owner_email);
}
export async function deleteLead(id: string, owner_email: string) {
  const db = getClient(); if (!db) return;
  await (db as Row).from("pablo_leads").delete().eq("id", id).eq("owner_email", owner_email);
}

// Auto-tagger por Claude
export async function autoTagLead(input: { owner_email: string; profile: PabloProfile; lead_id: string; lastMessages: string[] }): Promise<string[]> {
  try {
    const c = await anthropic.messages.create({
      model: MODELS.fast, max_tokens: 200, temperature: 0.2,
      system: `Etiqueta a un lead WhatsApp. JSON: {"tags":["caliente","vip","precio_sensible","spam","decidido","comparando","perdido"]}. Elige máximo 3 tags relevantes.`,
      messages: [{ role: "user", content: `Negocio: ${input.profile.nombre_negocio}\nÚltimos mensajes del lead:\n${input.lastMessages.slice(0, 10).join("\n---\n")}` }],
    });
    const block = c.content[0]; const text = block && block.type === "text" ? block.text.trim() : ""; const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed.tags)) return [];
    const tags = parsed.tags.slice(0, 3);
    await updateLeadStage(input.lead_id, input.owner_email, { tags });
    return tags;
  } catch (e) { console.error("[pablo-tag]", e); return []; }
}

// ===== CITAS + RECORDATORIOS =====
export type Cita = {
  id: string; phone: string; nombre: string | null; servicio: string | null;
  scheduled_at: string; duracion_min: number; status: string;
  recordatorio_24h_sent: boolean; recordatorio_2h_sent: boolean; followup_sent: boolean;
  notas: string | null;
};

export async function createCita(input: { owner_email: string; lead_id?: string; phone: string; nombre?: string; servicio?: string; scheduled_at: string; duracion_min?: number; notas?: string }) {
  const db = getClient(); if (!db) return null;
  const { data, error } = await (db as Row).from("pablo_citas").insert(input).select().single();
  if (error) throw error;
  // mover lead a etapa cita_programada
  if (input.lead_id) await updateLeadStage(input.lead_id, input.owner_email, { etapa: "cita_programada" as Etapa });
  return data;
}
export async function listCitas(owner_email: string, status?: string) {
  const db = getClient(); if (!db) return [];
  let q = (db as Row).from("pablo_citas").select("*").eq("owner_email", owner_email);
  if (status) q = q.eq("status", status);
  const { data } = await q.order("scheduled_at", { ascending: true }).limit(200);
  return data ?? [];
}
export async function updateCita(id: string, owner_email: string, patch: Partial<Cita>) {
  const db = getClient(); if (!db) return;
  await (db as Row).from("pablo_citas").update(patch).eq("id", id).eq("owner_email", owner_email);
}
export async function deleteCita(id: string, owner_email: string) {
  const db = getClient(); if (!db) return;
  await (db as Row).from("pablo_citas").delete().eq("id", id).eq("owner_email", owner_email);
}

export function generateRecordatorioText(input: { tipo: "24h" | "2h" | "followup"; profile: PabloProfile; nombre?: string; servicio?: string; scheduled_at: string }): string {
  const nombre = input.nombre || "";
  const negocio = input.profile.nombre_negocio || "nosotros";
  const fecha = new Date(input.scheduled_at);
  const hora = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const dia = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  if (input.tipo === "24h") return `Hola${nombre ? ` ${nombre}` : ""} 👋 Te recordamos tu cita en ${negocio} mañana ${dia} a las ${hora}${input.servicio ? ` para ${input.servicio}` : ""}. Si no puedes venir, avísanos por aquí. ¡Gracias!`;
  if (input.tipo === "2h") return `Hola${nombre ? ` ${nombre}` : ""} 👋 En 2 horas te esperamos en ${negocio} (a las ${hora}). ¿Confirmas que vienes? Responde SÍ. ¡Hasta ahora!`;
  return `Hola${nombre ? ` ${nombre}` : ""} 👋 Gracias por venir hoy a ${negocio}. ¿Cómo fue tu experiencia? Si te ha gustado, una reseña en Google nos ayudaría muchísimo 🌟`;
}

// ===== CATÁLOGO =====
export type Item = { id: string; nombre: string; descripcion: string | null; precio: number | null; precio_desde: boolean; duracion_min: number | null; categoria: string | null; keywords: string | null; active: boolean };

export async function listCatalogo(owner_email: string) {
  const db = getClient(); if (!db) return [];
  const { data } = await (db as Row).from("pablo_catalogo").select("*").eq("owner_email", owner_email).eq("active", true).order("created_at", { ascending: false });
  return data ?? [];
}
export async function createItem(input: Omit<Item, "id" | "active"> & { owner_email: string; active?: boolean }) {
  const db = getClient(); if (!db) return null;
  const { data, error } = await (db as Row).from("pablo_catalogo").insert({ ...input, active: input.active ?? true }).select().single();
  if (error) throw error;
  return data;
}
export async function deleteItem(id: string, owner_email: string) {
  const db = getClient(); if (!db) return;
  await (db as Row).from("pablo_catalogo").delete().eq("id", id).eq("owner_email", owner_email);
}

// ===== KEYWORDS CRÍTICAS =====
export type Keyword = { id: string; keyword: string; accion: "escalar" | "bloquear_auto" | "alerta"; motivo: string | null; active: boolean };

export async function listKeywords(owner_email: string) {
  const db = getClient(); if (!db) return [];
  const { data } = await (db as Row).from("pablo_keywords_criticas").select("*").eq("owner_email", owner_email).eq("active", true).order("created_at", { ascending: false });
  return data ?? [];
}
export async function createKeyword(input: { owner_email: string; keyword: string; accion: string; motivo?: string }) {
  const db = getClient(); if (!db) return null;
  const { data, error } = await (db as Row).from("pablo_keywords_criticas").insert(input).select().single();
  if (error) throw error;
  return data;
}
export async function deleteKeyword(id: string, owner_email: string) {
  const db = getClient(); if (!db) return;
  await (db as Row).from("pablo_keywords_criticas").delete().eq("id", id).eq("owner_email", owner_email);
}
export function checkKeywords(message: string, keywords: Keyword[]): { matched: Keyword[]; action: "escalar" | "bloquear_auto" | "alerta" | null } {
  const lower = message.toLowerCase();
  const matched = keywords.filter((k) => lower.includes(k.keyword.toLowerCase()));
  if (matched.length === 0) return { matched: [], action: null };
  const priorities = { bloquear_auto: 3, escalar: 2, alerta: 1 };
  const top = matched.sort((a, b) => priorities[b.accion] - priorities[a.accion])[0];
  return { matched, action: top.accion };
}

// ===== INSIGHTS DE NEGOCIO =====
export async function generateInsights(input: { owner_email: string; profile: PabloProfile; analyticsData: Row }) {
  try {
    const c = await anthropic.messages.create({
      model: MODELS.strong, max_tokens: 1500, temperature: 0.5,
      system: `Eres analista de negocio. A partir de datos WhatsApp, generas insights ACCIONABLES y específicos (no genéricos). Cada insight = un hallazgo + acción concreta. JSON:
{"insights":[{"titulo":"...","insight":"...","accion_sugerida":"...","prioridad":"alta|media|baja"}]}`,
      messages: [{ role: "user", content: `Negocio: ${input.profile.nombre_negocio} (${input.profile.sector}).\nDatos: ${JSON.stringify(input.analyticsData)}\n\nGenera 3-5 insights.` }],
    });
    const block = c.content[0]; const text = block && block.type === "text" ? block.text.trim() : ""; const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed.insights)) return [];
    const db = getClient();
    if (db) {
      const rows = parsed.insights.map((i: Row) => ({ owner_email: input.owner_email, ...i }));
      await (db as Row).from("pablo_insights").insert(rows);
    }
    return parsed.insights;
  } catch (e) { console.error("[pablo-insights]", e); return []; }
}
export async function listInsights(owner_email: string) {
  const db = getClient(); if (!db) return [];
  const { data } = await (db as Row).from("pablo_insights").select("*").eq("owner_email", owner_email).order("created_at", { ascending: false }).limit(20);
  return data ?? [];
}
export async function updateInsightStatus(id: string, owner_email: string, status: string) {
  const db = getClient(); if (!db) return;
  await (db as Row).from("pablo_insights").update({ status }).eq("id", id).eq("owner_email", owner_email);
}

// ===== VOZ (audios) =====
export const VOCES_PABLO = [
  { id: "ErXwobaYiN019PkySvjV", nombre: "Antoni · Masculina cercana" },
  { id: "EXAVITQu4vr4xnSDxMaL", nombre: "Bella · Femenina cálida" },
  { id: "VR6AewLTigWG4xSOukaG", nombre: "Arnold · Masculina seria" },
];
export async function generateVoiceAudio(input: { owner_email: string; script: string; voiceId?: string; lead_phone?: string }): Promise<{ audioBase64: string; voiceName: string } | { error: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { error: "Falta ELEVENLABS_API_KEY" };
  const voice = VOCES_PABLO.find((v) => v.id === input.voiceId) || VOCES_PABLO[0];
  const script = input.script.trim().slice(0, 1000);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: script, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } }),
    });
    if (!res.ok) return { error: `ElevenLabs ${res.status}` };
    const buf = await res.arrayBuffer();
    const audioBase64 = Buffer.from(buf).toString("base64");
    const db = getClient();
    if (db) await (db as Row).from("pablo_voice_audios").insert({ owner_email: input.owner_email, lead_phone: input.lead_phone || null, script, voice_id: voice.id, caracteres_usados: script.length });
    return { audioBase64, voiceName: voice.nombre };
  } catch (e) { console.error("[pablo-voice]", e); return { error: "Error audio" }; }
}
