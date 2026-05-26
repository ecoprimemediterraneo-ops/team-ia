/**
 * Marta · Repurposing — de 1 contenido fuente a 5 piezas adaptadas.
 *
 * Salida: { tiktok, shorts, post_ig, carrusel, blog }
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

export type SourceTipo = "reel" | "post" | "carrusel" | "video_largo";

export type Piezas = {
  tiktok: { hook: string; script: string; hashtags: string };
  shorts: { titulo_seo: string; descripcion: string };
  post_ig: { caption: string; hashtags: string };
  carrusel: { titulo: string; slides: Array<{ numero: number; texto: string }> };
  blog: { titulo: string; meta_descripcion: string; cuerpo: string };
};

export type Repurpose = {
  id: string;
  owner_email: string;
  source_tipo: SourceTipo;
  source_descripcion: string;
  piezas: Piezas;
  status: string;
  created_at: string;
};

const SYSTEM = (negocio: string, sector: string, tono: string) => `Eres Marta, especialista en repurposing de contenido para "${negocio}" (${sector}).

Tu tarea: dado UN contenido fuente, generar 5 piezas DERIVADAS adaptadas a cada canal sin copiar literal.

REGLAS DURAS:
1. Español de España. Tono ${tono}.
2. CADA pieza adaptada al formato y audiencia del canal:
   - TikTok → ritmo rápido, transiciones, jerga TikTok, máx 60s
   - YouTube Shorts → titulo SEO con keyword + descripción con keywords
   - Post Instagram → texto + emoji + hashtags amplio
   - Carrusel → 6-7 slides educativos texto corto
   - Blog post → 400-600 palabras SEO, H2/H3, intro + 3 puntos + conclusión
3. NO copies frases literales entre piezas. CADA UNA con su voz.
4. La carrusel y el reel ya los tenemos otros endpoints para versión completa; aquí da sólo el esqueleto/sinopsis para no duplicar generadores.

FORMATO JSON estricto (sin texto antes/después):
{
  "tiktok": {"hook": "<8-12 palabras>", "script": "<máx 60s con timing tipo [0-5s] ...>", "hashtags": "#1 #2 ..."},
  "shorts": {"titulo_seo": "<título con keyword>", "descripcion": "<3-4 frases con keywords>"},
  "post_ig": {"caption": "<caption completo>", "hashtags": "#1 #2 ..."},
  "carrusel": {"titulo": "<título portada>", "slides": [{"numero":2,"texto":"<frase slide>"},...]},
  "blog": {"titulo": "<H1>", "meta_descripcion": "<150 chars>", "cuerpo": "<400-600 palabras con H2/H3 reales>"}
}`;

export async function generateRepurpose(input: {
  sourceTipo: SourceTipo;
  sourceDescripcion: string;
  profile: MartaProfile;
}): Promise<Piezas | null> {
  const { sourceTipo, sourceDescripcion, profile } = input;
  const nombre = profile.nombre_negocio || "el negocio";
  const sector = profile.sector || "negocio local";
  const tono = profile.tono_marca || "cercano y profesional";

  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 2500,
      temperature: 0.5,
      system: SYSTEM(nombre, sector, tono),
      messages: [{
        role: "user",
        content: `Contenido fuente (${sourceTipo}):\n${sourceDescripcion}\n\nGenera las 5 piezas en JSON.`,
      }],
    });
    const block = completion.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    if (!parsed.tiktok || !parsed.post_ig || !parsed.blog) return null;
    return parsed as Piezas;
  } catch (e) {
    console.error("[marta-repurpose]", e);
    return null;
  }
}

export async function saveRepurpose(input: {
  owner_email: string;
  source_tipo: SourceTipo;
  source_descripcion: string;
  piezas: Piezas;
}): Promise<Repurpose | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("marta_repurpose")
    .insert({ ...input, status: "borrador" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listRepurpose(owner_email: string, limit = 30): Promise<Repurpose[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("marta_repurpose")
    .select("*")
    .eq("owner_email", owner_email)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function deleteRepurpose(id: string, owner_email: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("marta_repurpose").delete().eq("id", id).eq("owner_email", owner_email);
}
