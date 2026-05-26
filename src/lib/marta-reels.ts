/**
 * Marta · Generador de Reels profesionales para Instagram.
 * Devuelve script completo con hook + planos B-roll + texto overlay + música.
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

export type ReelStatus = "borrador" | "aprobado" | "grabado" | "publicado";

export type Reel = {
  id: string;
  owner_email: string;
  tema: string;
  duracion_seg: number;
  hook: string;
  script: string;
  planos_broll: string[];
  texto_overlay: Array<{ tiempo: string; texto: string }>;
  musica_sugerida: string | null;
  cta_final: string | null;
  hashtags: string | null;
  status: ReelStatus;
  created_at: string;
};

const SYSTEM_BUILDER = (negocio: string, sector: string, tono: string) => `Eres Marta, especialista IA en crear Reels virales de Instagram para "${negocio}" (sector: ${sector}).

Tu tarea: dado un tema, generar un Reel PROFESIONAL completo listo para grabar.

REGLAS DURAS — INNEGOCIABLES:
1. Idioma SIEMPRE español de España (tú/vosotros).
2. Tono: ${tono}. Natural, humano, NUNCA "como modelo de lenguaje".
3. **HOOK CRÍTICO**: los primeros 3 segundos deciden si el usuario sigue mirando o pasa. Empieza FUERTE:
   - Una pregunta provocadora
   - Una afirmación contraintuitiva
   - Un beneficio claro y específico
   - NUNCA "Hola, soy María de Clínica Sonrisa"
4. Script con TIMING POR SEGUNDOS, formato: "[0-3s] Hook / [3-8s] Punto 1 / etc"
5. Para cada bloque del script: indica QUÉ se ve en pantalla (plano B-roll)
6. Texto overlay (lo que aparece escrito en el video) corto y legible en móvil
7. CTA final claro: "comenta X", "guarda este reel", "envíanos DM", "agenda en bio"
8. Música sugerida: trending actual del sector (di el estilo, no nombre marca)
9. Hashtags: 5-8 relevantes mix nicho + amplio

FORMATO DE SALIDA (JSON estricto, nada antes ni después):

{
  "hook": "<primeros 3 segundos, frase impactante>",
  "script": "<script completo con timing tipo '[0-3s] ... [3-8s] ... [8-15s] ...' >",
  "planos_broll": ["<plano 1: descripción visual concreta>", "<plano 2>", "<plano 3>", "<plano 4>", "<plano 5>"],
  "texto_overlay": [
    {"tiempo": "0-3s", "texto": "<texto corto en pantalla>"},
    {"tiempo": "5-10s", "texto": "<...>"},
    {"tiempo": "20-25s", "texto": "<CTA>"}
  ],
  "musica_sugerida": "<estilo de audio trending recomendado>",
  "cta_final": "<llamada acción final clara>",
  "hashtags": "#hashtag1 #hashtag2 ..."
}`;

export async function generateReel(input: {
  tema: string;
  duracionSeg?: number;
  profile: MartaProfile;
}): Promise<Omit<Reel, "id" | "owner_email" | "status" | "created_at"> & { duracion_seg: number; tema: string }> {
  const { tema, profile } = input;
  const duracion = input.duracionSeg ?? 30;
  const nombre = profile.nombre_negocio || "el negocio";
  const sector = profile.sector || "negocio local";
  const tono = profile.tono_marca || "cercano y profesional";

  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 1500,
      temperature: 0.7,
      system: SYSTEM_BUILDER(nombre, sector, tono),
      messages: [{
        role: "user",
        content: `Tema del Reel: ${tema}\nDuración objetivo: ${duracion} segundos\n\nGenera el JSON.`,
      }],
    });

    const block = completion.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return fallback(tema, duracion);
    const parsed = JSON.parse(m[0]);
    return {
      tema,
      duracion_seg: duracion,
      hook: parsed.hook || "Hook por defecto",
      script: parsed.script || "Script no generado",
      planos_broll: Array.isArray(parsed.planos_broll) ? parsed.planos_broll : [],
      texto_overlay: Array.isArray(parsed.texto_overlay) ? parsed.texto_overlay : [],
      musica_sugerida: parsed.musica_sugerida || null,
      cta_final: parsed.cta_final || null,
      hashtags: parsed.hashtags || null,
    };
  } catch (e) {
    console.error("[marta-reels]", e);
    return fallback(tema, duracion);
  }
}

function fallback(tema: string, duracion: number) {
  return {
    tema,
    duracion_seg: duracion,
    hook: `Mira esto sobre ${tema}`,
    script: "Error generando reel. Intenta de nuevo.",
    planos_broll: [],
    texto_overlay: [],
    musica_sugerida: null,
    cta_final: null,
    hashtags: null,
  };
}

// ─── BD ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveReel(owner_email: string, reel: any): Promise<Reel | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("marta_reels")
    .insert({ owner_email, ...reel, status: "borrador" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listReels(owner_email: string, limit = 30): Promise<Reel[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("marta_reels")
    .select("*")
    .eq("owner_email", owner_email)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function setReelStatus(id: string, owner_email: string, status: ReelStatus): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("marta_reels").update({ status }).eq("id", id).eq("owner_email", owner_email);
}

export async function deleteReel(id: string, owner_email: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("marta_reels").delete().eq("id", id).eq("owner_email", owner_email);
}
