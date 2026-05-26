/**
 * Marta · Sugerencias de cuentas afines para colaborar (co-marketing).
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

export type Colab = {
  cuenta_sugerida: string;
  tipo_cuenta: "complementaria" | "referente" | "micro_influencer";
  por_que: string;
  propuesta_colab: string;
  beneficio_estimado: string;
};

const SYSTEM = (negocio: string, sector: string, ciudad: string) => `Eres Marta, especialista en co-marketing local para "${negocio}" (${sector}${ciudad ? `, ${ciudad}` : ""}).

Tu tarea: sugerir 5 TIPOS de cuentas con las que colaborar (no inventes @usuarios reales que no conozcas, describe el PERFIL: "cafetería de especialidad en el centro", "fisio deportivo zona X"...).

REGLAS:
- 5 sugerencias variadas: mezcla COMPLEMENTARIAS (servicios afines, mismo público), REFERENTES (cuentas grandes del sector para inspiración) y MICRO_INFLUENCERS (1k-10k followers, local).
- Para cada una: descripción del perfil + por qué encaja + propuesta de colaboración concreta (sorteo, intercambio, post conjunto, evento...) + beneficio estimado.
- Propuesta lista para copiar/pegar como DM.
- Idioma español de España, tono profesional pero cercano.

FORMATO JSON estricto:
{
  "colaboraciones": [
    {
      "cuenta_sugerida": "<descripción del tipo de cuenta>",
      "tipo_cuenta": "complementaria|referente|micro_influencer",
      "por_que": "<por qué encaja>",
      "propuesta_colab": "<mensaje DM listo>",
      "beneficio_estimado": "<beneficio para ambos>"
    }
  ]
}`;

export async function generateColaboraciones(profile: MartaProfile): Promise<Colab[]> {
  const negocio = profile.nombre_negocio || "el negocio";
  const sector = profile.sector || "negocio local";
  const ciudad = ""; // si tuviéramos ciudad en perfil
  try {
    const c = await anthropic.messages.create({
      model: MODELS.strong,
      max_tokens: 2500,
      temperature: 0.7,
      system: SYSTEM(negocio, sector, ciudad),
      messages: [{ role: "user", content: `Servicios destacados: ${profile.servicios_destacados || "no especificados"}.\nGenera el JSON con 5 colaboraciones.` }],
    });
    const block = c.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed.colaboraciones)) return [];
    return parsed.colaboraciones.slice(0, 5);
  } catch (e) {
    console.error("[marta-colab]", e);
    return [];
  }
}

export async function saveColaboraciones(owner_email: string, colabs: Colab[]) {
  const db = getClient();
  if (!db) return [];
  const rows = colabs.map((c) => ({ owner_email, ...c }));
  const { data, error } = await (db as Row).from("marta_colaboraciones").insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

export async function listColaboraciones(owner_email: string) {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("marta_colaboraciones").select("*").eq("owner_email", owner_email).order("created_at", { ascending: false }).limit(50);
  return data ?? [];
}

export async function updateColabStatus(id: string, owner_email: string, status: "contactada" | "aceptada" | "descartada") {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("marta_colaboraciones").update({ status }).eq("id", id).eq("owner_email", owner_email);
}
