/**
 * Marta · Traducción de captions/hashtags para audiencias multilingües.
 * Cachea en Supabase para no re-pagar mismo texto.
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

export const IDIOMAS = [
  { code: "en", nombre: "Inglés", flag: "🇬🇧" },
  { code: "fr", nombre: "Francés", flag: "🇫🇷" },
  { code: "de", nombre: "Alemán", flag: "🇩🇪" },
  { code: "it", nombre: "Italiano", flag: "🇮🇹" },
  { code: "pt", nombre: "Portugués", flag: "🇵🇹" },
  { code: "ca", nombre: "Catalán", flag: "🟡" },
];

const NOMBRES: Record<string, string> = { en: "inglés", fr: "francés", de: "alemán", it: "italiano", pt: "portugués", ca: "catalán" };

export async function translateCaption(input: {
  owner_email: string;
  text: string;
  targetLang: string;
  context?: "caption" | "hashtags" | "hook";
}): Promise<string | null> {
  const { owner_email, text, targetLang, context = "caption" } = input;
  if (!text.trim() || !NOMBRES[targetLang]) return null;

  const db = getClient();
  // Buscar cache
  if (db) {
    const { data } = await (db as Row)
      .from("marta_translations")
      .select("translated_text")
      .eq("owner_email", owner_email)
      .eq("source_text", text)
      .eq("target_lang", targetLang)
      .limit(1)
      .maybeSingle();
    if (data?.translated_text) return data.translated_text;
  }

  try {
    const c = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 1500,
      temperature: 0.3,
      system: `Eres traductor experto de marketing en redes sociales. Traduces del español al ${NOMBRES[targetLang]} preservando: tono, emojis, hashtags (los hashtags NO se traducen, se mantienen), saltos de línea y CTAs. Devuelves SOLO la traducción, sin comentarios.`,
      messages: [{ role: "user", content: text }],
    });
    const block = c.content[0];
    const translated = block && block.type === "text" ? block.text.trim() : "";
    if (!translated) return null;

    if (db) {
      await (db as Row).from("marta_translations").insert({
        owner_email,
        source_text: text,
        source_lang: "es",
        target_lang: targetLang,
        translated_text: translated,
        context,
      });
    }
    return translated;
  } catch (e) {
    console.error("[marta-translate]", e);
    return null;
  }
}
