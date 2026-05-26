/**
 * Marta · Templates de campañas por eventos del calendario español.
 * Genera pieza completa adaptada al negocio del cliente.
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

export type Evento = { key: string; nombre: string; fecha_aprox: string; emoji: string; descripcion: string };

export const EVENTOS_ES: Evento[] = [
  { key: "rebajas_enero", nombre: "Rebajas de enero", fecha_aprox: "07-01", emoji: "🏷️", descripcion: "Inicio rebajas invierno" },
  { key: "san_valentin", nombre: "San Valentín", fecha_aprox: "14-02", emoji: "❤️", descripcion: "Día de los enamorados" },
  { key: "dia_padre", nombre: "Día del Padre", fecha_aprox: "19-03", emoji: "👨‍👧", descripcion: "San José" },
  { key: "semana_santa", nombre: "Semana Santa", fecha_aprox: "01-04", emoji: "🌷", descripcion: "Vacaciones primavera" },
  { key: "dia_madre", nombre: "Día de la Madre", fecha_aprox: "05-05", emoji: "👩‍👧", descripcion: "Primer domingo mayo" },
  { key: "rebajas_verano", nombre: "Rebajas de verano", fecha_aprox: "01-07", emoji: "☀️", descripcion: "Inicio rebajas verano" },
  { key: "vuelta_cole", nombre: "Vuelta al cole", fecha_aprox: "01-09", emoji: "🎒", descripcion: "Septiembre" },
  { key: "halloween", nombre: "Halloween", fecha_aprox: "31-10", emoji: "🎃", descripcion: "Noche de brujas" },
  { key: "black_friday", nombre: "Black Friday", fecha_aprox: "28-11", emoji: "🛍️", descripcion: "Último viernes noviembre" },
  { key: "cyber_monday", nombre: "Cyber Monday", fecha_aprox: "01-12", emoji: "💻", descripcion: "Lunes siguiente a Black Friday" },
  { key: "navidad", nombre: "Navidad", fecha_aprox: "25-12", emoji: "🎄", descripcion: "Campaña diciembre" },
  { key: "fin_anio", nombre: "Fin de año", fecha_aprox: "31-12", emoji: "🥂", descripcion: "Nochevieja + propósitos" },
];

const SYSTEM = (negocio: string, sector: string, tono: string) => `Eres Marta, especialista en campañas estacionales para "${negocio}" (${sector}).

Dado un evento del calendario, generas una pieza de Instagram ADAPTADA al negocio (NO genérica).

REGLAS:
- Tono: ${tono}. Idioma español de España.
- Conecta el evento con el servicio/producto del negocio de forma natural (no forzada).
- Caption máximo 200 palabras, con saltos de línea para legibilidad.
- 6-8 hashtags relevantes mezclando del sector + del evento.
- CTA clara y accionable.
- Notas visuales describen la imagen ideal para que el cliente la pueda generar/grabar.

FORMATO JSON estricto:
{
  "caption": "<texto completo del caption con emojis>",
  "hashtags": "#tag1 #tag2 ...",
  "hook": "<primer renglón gancho, máx 12 palabras>",
  "cta": "<call to action>",
  "notas_visuales": "<descripción visual de la imagen/video ideal>"
}`;

export async function generateTemplate(input: {
  evento: Evento;
  tipoPieza: "post" | "reel" | "carrusel" | "story";
  profile: MartaProfile;
}) {
  const { evento, tipoPieza, profile } = input;
  const negocio = profile.nombre_negocio || "el negocio";
  const sector = profile.sector || "negocio local";
  const tono = profile.tono_marca || "cercano y profesional";

  try {
    const c = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 1200,
      temperature: 0.7,
      system: SYSTEM(negocio, sector, tono),
      messages: [{ role: "user", content: `Evento: ${evento.nombre} (${evento.descripcion}).\nTipo de pieza: ${tipoPieza}.\nGenera el JSON.` }],
    });
    const block = c.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]);
  } catch (e) {
    console.error("[marta-templates]", e);
    return null;
  }
}

export async function saveTemplate(input: Row) {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row).from("marta_templates_eventos").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function listTemplates(owner_email: string) {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("marta_templates_eventos").select("*").eq("owner_email", owner_email).order("fecha_objetivo", { ascending: true });
  return data ?? [];
}

export async function deleteTemplate(id: string, owner_email: string) {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("marta_templates_eventos").delete().eq("id", id).eq("owner_email", owner_email);
}
