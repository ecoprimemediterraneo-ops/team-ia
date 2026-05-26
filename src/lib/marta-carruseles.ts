/**
 * Marta · Generador de carruseles multi-slide para Instagram/LinkedIn.
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

export type CarruselStatus = "borrador" | "aprobado" | "publicado";

export type CarruselSlide = {
  numero: number;
  titulo: string;
  contenido: string;
  descripcion_visual: string;
};

export type CarruselPortada = {
  titulo: string;
  subtitulo: string;
  descripcion_visual: string;
};

export type Carrusel = {
  id: string;
  owner_email: string;
  tema: string;
  num_slides: number;
  portada: CarruselPortada;
  slides: CarruselSlide[];
  caption: string;
  cta_final: string | null;
  hashtags: string | null;
  status: CarruselStatus;
  created_at: string;
};

const SYSTEM_BUILDER = (negocio: string, sector: string, tono: string) => `Eres Marta, especialista IA en carruseles educativos virales de Instagram y LinkedIn para "${negocio}" (${sector}).

Tu tarea: dado un tema, generar un CARRUSEL completo de 5-10 slides listo para diseñar.

REGLAS DURAS:
1. Idioma español de España. Tono: ${tono}. Natural, humano.
2. **PORTADA = el slide más importante**: tiene que generar ganas de deslizar
   - Título: pregunta/afirmación FUERTE (8 palabras máx)
   - Subtítulo: promesa concreta del valor
   - Descripción visual: qué imagen/diseño mostraría
3. **Slides** (5-9): cada slide UN solo concepto. Texto MUY corto (móvil first).
4. **Último slide siempre CTA**: comentar, guardar, agendar, dm, etc.
5. Caption del post: 2-3 frases que enganchen + CTA + 5-8 hashtags
6. Descripción visual de cada slide: qué color, qué imagen, qué iconos. Útil para diseñador o Canva.

FORMATO JSON estricto (nada antes/después):

{
  "portada": {
    "titulo": "<título corto e impactante>",
    "subtitulo": "<subtítulo con promesa concreta>",
    "descripcion_visual": "<descripción de qué se vería: color, imagen, tipografía>"
  },
  "slides": [
    {"numero": 2, "titulo": "<título slide>", "contenido": "<1-2 frases máx>", "descripcion_visual": "<descripción>"},
    ...
  ],
  "caption": "<caption del post Instagram con 2-3 frases + CTA>",
  "cta_final": "<llamada acción del último slide>",
  "hashtags": "#hashtag1 #hashtag2 ..."
}

Importante: la portada va como slide 1 (no la incluyas en el array slides). El array slides empieza en numero 2.`;

export async function generateCarrusel(input: {
  tema: string;
  numSlides?: number;
  profile: MartaProfile;
}): Promise<Omit<Carrusel, "id" | "owner_email" | "status" | "created_at"> & { tema: string; num_slides: number }> {
  const { tema, profile } = input;
  const numSlides = Math.min(10, Math.max(5, input.numSlides ?? 7));
  const nombre = profile.nombre_negocio || "el negocio";
  const sector = profile.sector || "negocio local";
  const tono = profile.tono_marca || "cercano y profesional";

  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 2000,
      temperature: 0.7,
      system: SYSTEM_BUILDER(nombre, sector, tono),
      messages: [{
        role: "user",
        content: `Tema del carrusel: ${tema}\nNúmero de slides total (incluida portada): ${numSlides}\n\nGenera el JSON.`,
      }],
    });

    const block = completion.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return fallback(tema, numSlides);
    const parsed = JSON.parse(m[0]);
    return {
      tema,
      num_slides: numSlides,
      portada: parsed.portada || { titulo: tema, subtitulo: "", descripcion_visual: "" },
      slides: Array.isArray(parsed.slides) ? parsed.slides : [],
      caption: parsed.caption || `Sobre ${tema}`,
      cta_final: parsed.cta_final || null,
      hashtags: parsed.hashtags || null,
    };
  } catch (e) {
    console.error("[marta-carruseles]", e);
    return fallback(tema, numSlides);
  }
}

function fallback(tema: string, numSlides: number) {
  return {
    tema,
    num_slides: numSlides,
    portada: { titulo: tema, subtitulo: "Error", descripcion_visual: "" },
    slides: [],
    caption: "Error generando carrusel. Intenta de nuevo.",
    cta_final: null,
    hashtags: null,
  };
}

// ─── BD ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveCarrusel(owner_email: string, c: any): Promise<Carrusel | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("marta_carruseles")
    .insert({ owner_email, ...c, status: "borrador" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listCarruseles(owner_email: string, limit = 30): Promise<Carrusel[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("marta_carruseles")
    .select("*")
    .eq("owner_email", owner_email)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function deleteCarrusel(id: string, owner_email: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("marta_carruseles").delete().eq("id", id).eq("owner_email", owner_email);
}
