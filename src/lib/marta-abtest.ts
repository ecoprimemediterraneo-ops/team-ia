/**
 * Marta · A/B testing de hooks.
 *
 * Flujo:
 *  1. Cliente da un tema → Marta genera 3 hooks alternativos (A/B/C)
 *  2. Cliente publica la versión A en story (test rápido) y mide engagement 2-4h
 *  3. Cliente vuelve, marca cuál ganó → Marta guarda el ganador y aprende
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

export type AbVariant = { letra: "A" | "B" | "C"; hook: string; rationale: string };

export type AbTest = {
  id: string;
  owner_email: string;
  tema: string;
  variantes: AbVariant[];
  winner_letra: "A" | "B" | "C" | null;
  metricas_winner: Record<string, number>;
  status: "pending" | "running" | "resolved" | "discarded";
  created_at: string;
  resolved_at: string | null;
};

const SYSTEM = (negocio: string, sector: string, tono: string) => `Eres Marta, especialista en hooks virales de Instagram para "${negocio}" (${sector}).

Tu tarea: dado un tema, generar EXACTAMENTE 3 versiones distintas del HOOK (los primeros 3 segundos del reel o el primer renglón del post).

REGLAS DURAS:
1. Idioma español de España. Tono: ${tono}.
2. Cada hook debe usar un patrón psicológico DIFERENTE:
   - A → curiosidad / contradicción
   - B → beneficio directo / promesa
   - C → emoción / historia personal
3. Máximo 12 palabras cada hook.
4. NUNCA "Hola soy [nombre]". NUNCA "En este reel te voy a contar".
5. Para cada hook, una frase corta (15-25 palabras) explicando POR QUÉ debería funcionar.

FORMATO JSON estricto:
{
  "variantes": [
    {"letra": "A", "hook": "<hook A>", "rationale": "<por qué A funciona>"},
    {"letra": "B", "hook": "<hook B>", "rationale": "<por qué B funciona>"},
    {"letra": "C", "hook": "<hook C>", "rationale": "<por qué C funciona>"}
  ]
}`;

export async function generateAbVariants(input: { tema: string; profile: MartaProfile }): Promise<AbVariant[]> {
  const { tema, profile } = input;
  const nombre = profile.nombre_negocio || "el negocio";
  const sector = profile.sector || "negocio local";
  const tono = profile.tono_marca || "cercano y profesional";

  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 800,
      temperature: 0.8,
      system: SYSTEM(nombre, sector, tono),
      messages: [{ role: "user", content: `Tema: ${tema}\n\nGenera el JSON con 3 variantes.` }],
    });
    const block = completion.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed.variantes)) return [];
    return parsed.variantes
      .filter((v: Row) => ["A", "B", "C"].includes(v.letra) && typeof v.hook === "string")
      .slice(0, 3) as AbVariant[];
  } catch (e) {
    console.error("[marta-abtest]", e);
    return [];
  }
}

export async function saveAbTest(input: {
  owner_email: string;
  tema: string;
  variantes: AbVariant[];
}): Promise<AbTest | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("marta_ab_tests")
    .insert({ ...input, status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listAbTests(owner_email: string, limit = 30): Promise<AbTest[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("marta_ab_tests")
    .select("*")
    .eq("owner_email", owner_email)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function resolveAbTest(
  id: string,
  owner_email: string,
  winner: "A" | "B" | "C",
  metricas: Record<string, number> = {},
): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row)
    .from("marta_ab_tests")
    .update({
      winner_letra: winner,
      metricas_winner: metricas,
      status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_email", owner_email);
}

export async function deleteAbTest(id: string, owner_email: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("marta_ab_tests").delete().eq("id", id).eq("owner_email", owner_email);
}
