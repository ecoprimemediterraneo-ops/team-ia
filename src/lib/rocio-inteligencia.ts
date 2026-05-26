/**
 * Rocío · Sentimiento + Templates sector + Pedir reseñas + Reportes.
 */
import { anthropic, MODELS } from "@/lib/claude";
import type { RocioProfile } from "./rocio-profile";

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

export const SECTORES = ["clinica", "peluqueria", "restaurante", "hotel", "fisio", "gimnasio", "tienda", "otro"] as const;
export type Sector = typeof SECTORES[number];

export type Sentiment = "muy_positivo" | "positivo" | "neutro" | "negativo" | "muy_negativo";

export async function analyzeSentiment(input: { owner_email: string; review_text: string; rating?: number; review_id?: string }) {
  try {
    const c = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 600,
      temperature: 0.2,
      system: `Analista experto de reseñas Google. Para una reseña, devuelves JSON estricto:
{
  "sentiment": "muy_positivo|positivo|neutro|negativo|muy_negativo",
  "emocion_principal": "<gratitud|queja|frustracion|entusiasmo|decepcion|otro>",
  "temas": ["atencion","precio","tiempo_espera","calidad","limpieza"],
  "prioridad_respuesta": "urgente|alta|normal|baja",
  "flags": ["competencia","posible_falsa","escalar"]
}`,
      messages: [{ role: "user", content: `Rating: ${input.rating ?? "?"}/5\nTexto: ${input.review_text}` }],
    });
    const block = c.content[0]; const text = block && block.type === "text" ? block.text.trim() : ""; const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);

    const db = getClient();
    if (db) {
      await (db as Row).from("rocio_review_sentiment").insert({
        owner_email: input.owner_email,
        review_id: input.review_id ?? null,
        rating: input.rating ?? null,
        review_text: input.review_text,
        sentiment: parsed.sentiment,
        emocion_principal: parsed.emocion_principal,
        temas: parsed.temas ?? [],
        prioridad_respuesta: parsed.prioridad_respuesta,
        flags: parsed.flags ?? [],
      });
    }
    return parsed;
  } catch (e) { console.error("[rocio-sentiment]", e); return null; }
}

export async function listSentiments(owner_email: string, limit = 100) {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("rocio_review_sentiment").select("*").eq("owner_email", owner_email).order("analyzed_at", { ascending: false }).limit(limit);
  return data ?? [];
}

// Templates sector
const TEMPLATES_SEED: Record<Sector, Record<Sentiment, { titulo: string; body: string }[]>> = {
  clinica: {
    muy_positivo: [{ titulo: "Gracias 5★", body: "¡Muchas gracias, {nombre}! Nos alegra muchísimo haber estado a la altura. Te esperamos siempre que lo necesites. Un saludo del equipo de {negocio}." }],
    positivo: [{ titulo: "Agradecer 4★", body: "Gracias por tu reseña, {nombre}. Nos esforzamos cada día por mejorar y tu opinión nos ayuda. ¡Hasta pronto!" }],
    neutro: [{ titulo: "Pedir más info", body: "Hola {nombre}, gracias por tu valoración. ¿Hay algo concreto que podamos mejorar? Nos encantaría conocerlo. Equipo {negocio}." }],
    negativo: [{ titulo: "Disculparse 2★", body: "Sentimos mucho tu experiencia, {nombre}. No es nuestro estándar. Te invitamos a contactarnos directamente en {contacto} para revisarlo y compensarte." }],
    muy_negativo: [{ titulo: "Escalar 1★", body: "Lamentamos profundamente lo ocurrido, {nombre}. Es muy importante para nosotros entender qué pasó. Por favor escríbenos a {contacto} para ofrecerte una solución personalizada." }],
  },
  peluqueria: {
    muy_positivo: [{ titulo: "5★ peluquería", body: "¡Mil gracias, {nombre}! Nos has hecho el día. Te esperamos pronto para seguir cuidando tu pelo ✂️💛" }],
    positivo: [{ titulo: "4★ peluquería", body: "Gracias por confiar en nosotras, {nombre}. ¡Hasta la próxima!" }],
    neutro: [{ titulo: "3★ peluquería", body: "Hola {nombre}, gracias por tu opinión. Cuéntanos qué podemos mejorar la próxima vez ✨" }],
    negativo: [{ titulo: "2★ peluquería", body: "Sentimos no haber cumplido tus expectativas, {nombre}. Nos encantaría que volvieras y compensarte. Escríbenos a {contacto}." }],
    muy_negativo: [{ titulo: "1★ peluquería", body: "Lo sentimos muchísimo, {nombre}. Esto no es lo habitual y queremos arreglarlo. Por favor llámanos al {contacto}." }],
  },
  restaurante: {
    muy_positivo: [{ titulo: "5★ resto", body: "¡Gracias, {nombre}! Nos hace muy felices que disfrutaras de la experiencia. Te esperamos pronto 🍽️" }],
    positivo: [{ titulo: "4★ resto", body: "Gracias por venir, {nombre}. ¡Hasta la próxima visita!" }],
    neutro: [{ titulo: "3★ resto", body: "Hola {nombre}, gracias por tu valoración. ¿Algo que mejorar? Nos lo apuntamos." }],
    negativo: [{ titulo: "2★ resto", body: "Sentimos que la experiencia no fuera la esperada, {nombre}. Por favor escríbenos a {contacto} para conocer los detalles y poder mejorar." }],
    muy_negativo: [{ titulo: "1★ resto", body: "Lamentamos enormemente lo ocurrido, {nombre}. Nos gustaría conocer todo lo que pasó. Te invitamos a contactarnos en {contacto}." }],
  },
  hotel: {
    muy_positivo: [{ titulo: "5★ hotel", body: "¡Gracias por elegirnos, {nombre}! Nos alegra que tu estancia fuera tan agradable. Te esperamos en tu próxima visita 🏨" }],
    positivo: [{ titulo: "4★ hotel", body: "Gracias por tu reseña, {nombre}. Hasta pronto." }],
    neutro: [{ titulo: "3★ hotel", body: "Hola {nombre}, gracias por compartir tu experiencia. ¿Qué podríamos haber hecho mejor?" }],
    negativo: [{ titulo: "2★ hotel", body: "Sentimos no haber cumplido tus expectativas, {nombre}. Nos gustaría poder compensarte. Escríbenos a {contacto}." }],
    muy_negativo: [{ titulo: "1★ hotel", body: "Lamentamos profundamente tu experiencia, {nombre}. Es muy importante que hablemos. Contáctanos en {contacto}." }],
  },
  fisio: {
    muy_positivo: [{ titulo: "5★ fisio", body: "Gracias por tu confianza, {nombre}. Nos alegra que el tratamiento te haya funcionado tan bien. ¡A cuidarse!" }],
    positivo: [{ titulo: "4★ fisio", body: "Gracias {nombre}. Aquí nos tienes para lo que necesites." }],
    neutro: [{ titulo: "3★ fisio", body: "Hola {nombre}, gracias por tu opinión. ¿Algo que mejorar en próximas sesiones?" }],
    negativo: [{ titulo: "2★ fisio", body: "Sentimos no haber cumplido tus expectativas, {nombre}. Llámanos al {contacto} para hablar." }],
    muy_negativo: [{ titulo: "1★ fisio", body: "Sentimos mucho tu experiencia, {nombre}. Necesitamos conocer los detalles. Escríbenos a {contacto}." }],
  },
  gimnasio: {
    muy_positivo: [{ titulo: "5★ gym", body: "¡Gracias, {nombre}! Nos motiva ver que disfrutas entrenando con nosotros 💪" }],
    positivo: [{ titulo: "4★ gym", body: "Gracias por tu valoración, {nombre}. ¡Sigamos!" }],
    neutro: [{ titulo: "3★ gym", body: "Hola {nombre}, gracias por tu feedback. ¿Algo concreto que mejorar?" }],
    negativo: [{ titulo: "2★ gym", body: "Sentimos no haber cumplido tus expectativas, {nombre}. Por favor escríbenos a {contacto}." }],
    muy_negativo: [{ titulo: "1★ gym", body: "Lamentamos tu experiencia, {nombre}. Queremos arreglarlo. Contáctanos en {contacto}." }],
  },
  tienda: {
    muy_positivo: [{ titulo: "5★ tienda", body: "¡Gracias por tu reseña, {nombre}! Nos alegra que estés contento con tu compra. ¡Hasta pronto!" }],
    positivo: [{ titulo: "4★ tienda", body: "Gracias {nombre}, ¡vuelve cuando quieras!" }],
    neutro: [{ titulo: "3★ tienda", body: "Hola {nombre}, gracias por tu opinión. ¿Hay algo que podamos mejorar?" }],
    negativo: [{ titulo: "2★ tienda", body: "Sentimos lo ocurrido, {nombre}. Escríbenos a {contacto} para resolverlo." }],
    muy_negativo: [{ titulo: "1★ tienda", body: "Lamentamos profundamente lo ocurrido, {nombre}. Llámanos al {contacto} cuanto antes." }],
  },
  otro: {
    muy_positivo: [{ titulo: "5★ genérico", body: "¡Muchas gracias, {nombre}! Nos alegra haberte dado un gran servicio." }],
    positivo: [{ titulo: "4★ genérico", body: "Gracias por tu reseña, {nombre}." }],
    neutro: [{ titulo: "3★ genérico", body: "Gracias {nombre}, ¿algo que podamos mejorar?" }],
    negativo: [{ titulo: "2★ genérico", body: "Sentimos no haber cumplido expectativas, {nombre}. Escríbenos a {contacto}." }],
    muy_negativo: [{ titulo: "1★ genérico", body: "Lamentamos tu experiencia, {nombre}. Por favor contáctanos en {contacto}." }],
  },
};

export function getSeedTemplates(sector: Sector) { return TEMPLATES_SEED[sector]; }

export async function listTemplatesSector(owner_email: string) {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("rocio_templates_sector").select("*").eq("owner_email", owner_email).eq("active", true).order("created_at", { ascending: false });
  return data ?? [];
}

export async function createTemplateSector(input: { owner_email: string; sector: string; sentiment: string; titulo: string; body: string }) {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row).from("rocio_templates_sector").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTemplateSector(id: string, owner_email: string) {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("rocio_templates_sector").delete().eq("id", id).eq("owner_email", owner_email);
}

// Pedir reseñas
export async function generatePedirMessage(input: { profile: RocioProfile; canal: "whatsapp" | "sms" | "email"; cliente_nombre?: string; link_resena: string }): Promise<string> {
  try {
    const c = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 300,
      temperature: 0.5,
      system: `Pides reseñas Google de forma educada y breve. Devuelves SOLO el mensaje, sin comentarios. Adapta al canal: ${input.canal === "email" ? "puede ser algo más largo" : "corto y directo, max 2 frases"}.`,
      messages: [{ role: "user", content: `Negocio: ${input.profile.nombre_negocio || "el negocio"}. Cliente: ${input.cliente_nombre || "cliente"}. Link: ${input.link_resena}. Genera el mensaje.` }],
    });
    const block = c.content[0]; return block && block.type === "text" ? block.text.trim() : "";
  } catch { return `Hola${input.cliente_nombre ? ` ${input.cliente_nombre}` : ""}, gracias por confiar en nosotros. Si te ha gustado la experiencia, una reseña en Google nos ayudaría muchísimo: ${input.link_resena} ⭐ ¡Gracias!`; }
}

export async function savePedirResena(input: { owner_email: string; cliente_nombre?: string; cliente_contacto: string; canal: string; mensaje: string; link_resena?: string; programado_para?: string }) {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row).from("rocio_pedir_resenas").insert({ ...input, status: input.programado_para ? "programado" : "borrador" }).select().single();
  if (error) throw error;
  return data;
}

export async function listPedirResenas(owner_email: string) {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("rocio_pedir_resenas").select("*").eq("owner_email", owner_email).order("created_at", { ascending: false }).limit(50);
  return data ?? [];
}

export async function markPedirEnviado(id: string, owner_email: string) {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("rocio_pedir_resenas").update({ status: "enviado", enviado_at: new Date().toISOString() }).eq("id", id).eq("owner_email", owner_email);
}

// Reportes
function currentPeriod(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

export async function generateReporte(input: { owner_email: string; profile: RocioProfile; periodo?: string }) {
  const periodo = input.periodo || currentPeriod();
  const sentiments = await listSentiments(input.owner_email, 500);
  const filtered = sentiments.filter((s: Row) => s.analyzed_at?.startsWith(periodo));

  const total = filtered.length;
  const avg_rating = total > 0 ? filtered.reduce((s: number, r: Row) => s + (Number(r.rating) || 0), 0) / total : 0;
  const distribucion: Record<string, number> = {};
  for (const r of filtered) { const k = r.sentiment || "neutro"; distribucion[k] = (distribucion[k] || 0) + 1; }
  const urgentes = filtered.filter((r: Row) => r.prioridad_respuesta === "urgente" || r.prioridad_respuesta === "alta").length;

  const metricas = { total_resenas: total, rating_medio: Number(avg_rating.toFixed(2)), urgentes, distribucion };
  let resumen_ejecutivo = `${input.profile.nombre_negocio || "El negocio"} recibió ${total} reseñas en ${periodo} con rating medio ${avg_rating.toFixed(1)}/5.`;
  let insights: string[] = []; let recomendaciones: string[] = [];

  if (total > 0) {
    try {
      const c = await anthropic.messages.create({
        model: MODELS.fast,
        max_tokens: 1000,
        temperature: 0.4,
        system: `Analista de reputación online. Genera JSON: {"resumen_ejecutivo":"...","insights":["..."],"recomendaciones":["..."]}`,
        messages: [{ role: "user", content: `${input.profile.nombre_negocio}. ${total} reseñas. Rating ${avg_rating.toFixed(1)}. Distribución: ${JSON.stringify(distribucion)}. Urgentes: ${urgentes}.` }],
      });
      const block = c.content[0]; const text = block && block.type === "text" ? block.text.trim() : ""; const m = text.match(/\{[\s\S]*\}/);
      if (m) { const p = JSON.parse(m[0]); resumen_ejecutivo = p.resumen_ejecutivo || resumen_ejecutivo; insights = p.insights?.slice(0, 5) || []; recomendaciones = p.recomendaciones?.slice(0, 5) || []; }
    } catch (e) { console.error(e); }
  } else { insights = ["Sin reseñas en este periodo."]; recomendaciones = ["Pide reseñas a tus clientes contentos con la nueva función."]; }

  const db = getClient();
  if (!db) return { id: "no-db", owner_email: input.owner_email, periodo, resumen_ejecutivo, metricas, insights, recomendaciones, created_at: new Date().toISOString() };
  const { data } = await (db as Row).from("rocio_reportes").upsert({ owner_email: input.owner_email, periodo, resumen_ejecutivo, metricas, insights, recomendaciones }, { onConflict: "owner_email,periodo" }).select().single();
  return data;
}

export async function listReportes(owner_email: string) {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("rocio_reportes").select("*").eq("owner_email", owner_email).order("periodo", { ascending: false }).limit(12);
  return data ?? [];
}
