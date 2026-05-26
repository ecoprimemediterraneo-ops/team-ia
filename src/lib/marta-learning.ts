/**
 * Marta · Aprendizaje semi-automático.
 *
 * Cada noche analiza las últimas N ediciones del cliente y genera sugerencias
 * de reglas custom que el founder puede aceptar o rechazar con un click.
 *
 * Las ediciones se detectan así:
 *   - approved_text != null en marta_ig_pending_responses
 *     → significa que el cliente editó la respuesta antes de aprobarla
 */

import { anthropic, MODELS } from "@/lib/claude";

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

export type EditPair = {
  original: string;
  edited: string;
  intent: string | null;
};

export type PatternSuggestion = {
  id: string;
  owner_email: string;
  rule_text: string;
  evidence: string;
  pattern_type: string;
  source_edits_count: number;
  status: "pending" | "accepted" | "rejected" | "dismissed";
  accepted_at: string | null;
  created_at: string;
};

/**
 * Lee las últimas N ediciones (approved_text != original) del cliente.
 */
export async function recentEditsByOwner(ownerEmail: string, limit = 20): Promise<EditPair[]> {
  const db = getClient();
  if (!db) return [];

  const { data } = await (db as Row)
    .from("marta_ig_pending_responses")
    .select("proposed_response, approved_text, intent")
    .eq("owner_email", ownerEmail)
    .not("approved_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? [])
    .filter((r: Row) => r.approved_text && r.approved_text !== r.proposed_response)
    .map((r: Row) => ({
      original: r.proposed_response,
      edited: r.approved_text,
      intent: r.intent,
    }));
}

const PATTERN_PROMPT = `Eres analista de patrones de comunicación. Recibes pares (respuesta_original / respuesta_editada_por_humano) de un asistente IA en Instagram.

Tu tarea: detectar patrones consistentes en cómo el humano EDITA las respuestas, para generar REGLAS PERMANENTES que el asistente deba seguir.

REGLAS de detección:
1. Un patrón debe aparecer en AL MENOS 2 ediciones distintas para considerarlo.
2. Cada sugerencia debe ser una regla CONCRETA y ACCIONABLE, en una frase corta.
3. Tipos válidos: tono (formal/cercano), vocabulario (preferencias léxicas), formato (largo/corto/emojis), prohibicion (no decir X), otro.
4. NO sugieras cosas obvias ya cubiertas (ej. "responde en español").
5. Si NO hay patrón claro, devuelve [] vacío. Es mejor cero sugerencias que sugerencias débiles.

Devuelve SOLO un JSON array válido. Sin texto antes ni después. Formato exacto:

[
  {
    "rule_text": "<regla en una frase, lista para añadir>",
    "evidence": "<ejemplo concreto de cambio observado>",
    "pattern_type": "tono|vocabulario|formato|prohibicion|otro",
    "source_edits_count": <número entero de ediciones que respaldan esto>
  }
]

Si no hay patrones, devuelve exactamente: []`;

/**
 * Analiza ediciones con Claude y devuelve sugerencias parsed.
 */
export async function detectPatterns(edits: EditPair[]): Promise<
  Array<{
    rule_text: string;
    evidence: string;
    pattern_type: string;
    source_edits_count: number;
  }>
> {
  if (edits.length < 2) return [];

  const userPrompt = `Aquí tienes ${edits.length} pares de edición (intent en corchetes):

${edits
  .map(
    (e, i) =>
      `--- Edición ${i + 1} [${e.intent ?? "?"}] ---
ORIGINAL: ${e.original}
EDITADA:  ${e.edited}`,
  )
  .join("\n\n")}

Detecta patrones y devuelve el JSON array.`;

  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 1000,
      temperature: 0.2,
      system: PATTERN_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = completion.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (p: Row) =>
          typeof p.rule_text === "string" &&
          p.rule_text.length > 5 &&
          p.rule_text.length < 300 &&
          typeof p.source_edits_count === "number" &&
          p.source_edits_count >= 2,
      )
      .slice(0, 5);
  } catch (e) {
    console.error("[marta-learning] detect error", e);
    return [];
  }
}

/**
 * Inserta sugerencias en BD evitando duplicados (compara rule_text).
 */
export async function saveSuggestions(
  ownerEmail: string,
  suggestions: Array<{
    rule_text: string;
    evidence: string;
    pattern_type: string;
    source_edits_count: number;
  }>,
): Promise<number> {
  const db = getClient();
  if (!db) return 0;
  if (suggestions.length === 0) return 0;

  // Lookup sugerencias existentes (pending o accepted) para evitar duplicar
  const { data: existing } = await (db as Row)
    .from("marta_pattern_suggestions")
    .select("rule_text")
    .eq("owner_email", ownerEmail)
    .in("status", ["pending", "accepted"]);

  const existingSet = new Set((existing ?? []).map((e: Row) => e.rule_text.toLowerCase().trim()));
  const fresh = suggestions.filter((s) => !existingSet.has(s.rule_text.toLowerCase().trim()));
  if (fresh.length === 0) return 0;

  const rows = fresh.map((s) => ({
    owner_email: ownerEmail,
    rule_text: s.rule_text,
    evidence: s.evidence,
    pattern_type: s.pattern_type,
    source_edits_count: s.source_edits_count,
    status: "pending",
  }));

  const { error } = await (db as Row).from("marta_pattern_suggestions").insert(rows);
  if (error) {
    console.error("[marta-learning] save error", error);
    return 0;
  }
  return fresh.length;
}

export async function listSuggestions(
  ownerEmail: string,
  status: "pending" | "accepted" | "rejected" | "dismissed" = "pending",
): Promise<PatternSuggestion[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("marta_pattern_suggestions")
    .select("*")
    .eq("owner_email", ownerEmail)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function updateSuggestionStatus(
  id: string,
  ownerEmail: string,
  status: "accepted" | "rejected" | "dismissed",
): Promise<PatternSuggestion | null> {
  const db = getClient();
  if (!db) return null;
  const patch: Row = { status };
  if (status === "accepted") patch.accepted_at = new Date().toISOString();

  const { data } = await (db as Row)
    .from("marta_pattern_suggestions")
    .update(patch)
    .eq("id", id)
    .eq("owner_email", ownerEmail)
    .select()
    .single();
  return data ?? null;
}

/**
 * Cron nocturno: lookup todos los owners con ediciones recientes
 * y para cada uno detecta patrones nuevos.
 */
export async function runLearningCronForAllOwners(): Promise<{
  owners_procesados: number;
  sugerencias_creadas: number;
}> {
  const db = getClient();
  if (!db) return { owners_procesados: 0, sugerencias_creadas: 0 };

  // Owners con al menos 1 edición en los últimos 7 días
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: rows } = await (db as Row)
    .from("marta_ig_pending_responses")
    .select("owner_email")
    .not("approved_text", "is", null)
    .gte("created_at", weekAgo);

  const ownersRaw = (rows ?? []).map((r: Row) => String(r.owner_email));
  const owners: string[] = Array.from(new Set(ownersRaw));
  let totalCreated = 0;

  for (const owner of owners) {
    const edits = await recentEditsByOwner(owner, 20);
    if (edits.length < 2) continue;
    const suggestions = await detectPatterns(edits);
    const created = await saveSuggestions(owner, suggestions);
    totalCreated += created;
  }

  return { owners_procesados: owners.length, sugerencias_creadas: totalCreated };
}
