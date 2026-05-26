/**
 * Marta · Detección de oportunidades virales en cuentas del sector.
 *
 * El cliente registra cuentas a vigilar. Cron diario las analiza y, si detecta
 * que han publicado algo que está reventando, genera propuesta adaptada para el cliente.
 *
 * Hoy: sin Meta Insights API, el escaneo de competencia se hace con datos seeds
 * o se complementa con Sergio (Firecrawl) para perfiles públicos.
 *
 * Cuando Meta apruebe IG Hashtag Search API: scanner automático real.
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

export type Competidor = {
  id: string;
  owner_email: string;
  username: string;
  motivo: string | null;
  active: boolean;
  last_scanned_at: string | null;
  created_at: string;
};

export type Oportunidad = {
  id: string;
  owner_email: string;
  source_username: string | null;
  source_url: string | null;
  tipo_contenido: string | null;
  por_que: string;
  propuesta_adaptada: string;
  status: "pending" | "aceptada" | "descartada";
  created_at: string;
};

// ─── Competidores CRUD ───────────────────────────────────────────────────────

export async function listCompetidores(owner_email: string): Promise<Competidor[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("marta_competencia")
    .select("*")
    .eq("owner_email", owner_email)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function addCompetidor(input: {
  owner_email: string;
  username: string;
  motivo?: string;
}): Promise<Competidor | null> {
  const db = getClient();
  if (!db) return null;
  const clean = input.username.replace(/^@/, "").trim().toLowerCase();
  const { data, error } = await (db as Row)
    .from("marta_competencia")
    .insert({
      owner_email: input.owner_email,
      username: clean,
      motivo: input.motivo ?? null,
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCompetidor(id: string, owner_email: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("marta_competencia").delete().eq("id", id).eq("owner_email", owner_email);
}

// ─── Oportunidades ──────────────────────────────────────────────────────────

export async function listOportunidades(
  owner_email: string,
  status: "pending" | "aceptada" | "descartada" = "pending",
): Promise<Oportunidad[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("marta_oportunidades")
    .select("*")
    .eq("owner_email", owner_email)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function setOportunidadStatus(
  id: string,
  owner_email: string,
  status: "aceptada" | "descartada",
): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row)
    .from("marta_oportunidades")
    .update({ status })
    .eq("id", id)
    .eq("owner_email", owner_email);
}

// ─── Generación de propuesta adaptada ──────────────────────────────────────

/**
 * Dado un post viral observado (descripción libre), genera versión adaptada para el cliente.
 * Esta función se usa tanto en el cron (automático) como en el botón "generar manual".
 */
export async function adaptarPostViral(input: {
  descripcionViral: string;        // "Reel de @clinicarival que hizo 100k views. Habla de 3 mitos sobre implantes"
  sourceUsername?: string;
  tipoContenido?: string;
  profile: MartaProfile;
}): Promise<{ por_que: string; propuesta_adaptada: string }> {
  const userPrompt = `Negocio del cliente: ${input.profile.nombre_negocio || "el negocio"} (sector: ${input.profile.sector || "negocio local"})
Tono de marca del cliente: ${input.profile.tono_marca || "cercano y profesional"}

CONTENIDO VIRAL DETECTADO:
${input.descripcionViral}

Fuente: ${input.sourceUsername ? "@" + input.sourceUsername : "desconocida"}
Tipo: ${input.tipoContenido || "post"}

Tu tarea:
1. POR_QUE: en 1-2 frases concretas, explica POR QUÉ funcionó (hook, formato, emoción que despierta, novedad...).
2. PROPUESTA_ADAPTADA: descripción concreta de cómo el cliente puede hacer SU versión sin copiar literal. Adapta al sector + tono del cliente. Sé específico (tema concreto, hook sugerido, estructura).

FORMATO JSON estricto:
{"por_que": "<...>", "propuesta_adaptada": "<...>"}`;

  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 800,
      temperature: 0.4,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = completion.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("parse");
    const parsed = JSON.parse(m[0]);
    return {
      por_que: parsed.por_que || "(sin razonamiento)",
      propuesta_adaptada: parsed.propuesta_adaptada || "(sin propuesta)",
    };
  } catch (e) {
    console.error("[marta-virales]", e);
    return { por_que: "Error generando análisis", propuesta_adaptada: input.descripcionViral };
  }
}

export async function saveOportunidad(input: {
  owner_email: string;
  source_username?: string;
  source_url?: string;
  tipo_contenido?: string;
  por_que: string;
  propuesta_adaptada: string;
}): Promise<Oportunidad | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("marta_oportunidades")
    .insert({
      owner_email: input.owner_email,
      source_username: input.source_username ?? null,
      source_url: input.source_url ?? null,
      tipo_contenido: input.tipo_contenido ?? null,
      por_que: input.por_que,
      propuesta_adaptada: input.propuesta_adaptada,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
