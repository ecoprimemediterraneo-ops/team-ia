// Generador de respuestas a reseñas de Google Business Profile para Rocío.
//
// Usa Haiku con la ficha del cliente como contexto. El tono cambia según el
// rating de la reseña:
//   1-2★ → disculpa profesional, propuesta de solución, invitación a hablar
//          por privado para arreglarlo. Nunca culpar al cliente.
//   3★   → cortés, agradecer feedback, invitación a mejorar.
//   4-5★ → cordial cercano, agradecer y reforzar el lazo. Sin sonar a robot.
//
// Reglas duras:
//   - Castellano de España, tuteo.
//   - Sin emojis salvo que la reseña tuviera (entonces máximo 1).
//   - Sin asteriscos, sin markdown.
//   - Máximo 4-5 líneas. Una reseña pide brevedad, no ensayo.
//   - Nunca inventar promociones, descuentos o servicios no listados en la
//     ficha.
//   - Si la reseña no tiene texto (5★ "estrellas sueltas"), respuesta corta
//     tipo "¡Gracias por las 5 estrellas, María! Te esperamos pronto."

import { anthropic, MODELS } from "./claude";
import { fichaToPromptContext, getFicha, type Ficha } from "./ficha";
import type { GbpReview } from "./google-business";

export type ReplyGenResult =
  | { ok: true; reply: string; tono: ReplyTono }
  | { ok: false; reason: "no_api_key" | "no_ficha" | "api_error"; detail: string };

export type ReplyTono = "disculpa" | "cortes" | "cordial";

export function pickTono(rating: 1 | 2 | 3 | 4 | 5): ReplyTono {
  if (rating <= 2) return "disculpa";
  if (rating === 3) return "cortes";
  return "cordial";
}

function buildPrompt(ficha: Ficha, review: GbpReview, tono: ReplyTono): string {
  const sinTexto = !review.comment.trim();
  return `ROL: ERES el negocio descrito abajo respondiendo PÚBLICAMENTE a una reseña de Google. Hablas como portavoz del negocio, en primera persona del plural ("gracias por", "te esperamos"). No eres una agencia, no eres una IA, no eres "Rocío".

FICHA DEL NEGOCIO:
${fichaToPromptContext(ficha)}

LA RESEÑA QUE RESPONDES:
- Autor: ${review.reviewer.displayName}
- Estrellas: ${review.starRating}/5
- Texto: ${sinTexto ? "(sin texto, solo estrellas)" : `"${review.comment}"`}

TONO REQUERIDO: ${tono === "disculpa"
    ? "Disculpa profesional. La reseña es negativa. Reconoce lo que dice (sin culpar al cliente), pide disculpas con sinceridad, ofrece una propuesta concreta para arreglarlo e invita a contactaros por privado (mensaje directo, teléfono o email). NUNCA discutas. NUNCA digas 'lo investigaremos' a secas. Sé humano."
    : tono === "cortes"
      ? "Cordial pero cortés. Agradece el feedback, reconoce el punto de mejora si lo menciona, invita a volver con la promesa de mejorar."
      : "Cordial cercano. Agradece sinceramente, refuerza la conexión. Sin ser meloso. Si la reseña tiene un detalle concreto, recógelo."}

REGLAS DE FORMATO (críticas):
- Castellano de España, tuteo.
- Saluda por su nombre.
- Máximo 4-5 líneas. ${sinTexto ? "Si solo hay estrellas, basta una respuesta de 1-2 frases breves." : ""}
- Sin asteriscos, sin markdown, sin negritas.
- Emojis solo si la reseña tiene; máximo 1.
- No prometas descuentos ni promociones que no estén en la ficha.
- No menciones AI-Team, Rocío, IA, automatización ni nada similar.

Devuelve EXCLUSIVAMENTE el texto de la respuesta, listo para publicar en Google. Sin comillas, sin meta-comentarios.`;
}

export async function generateReviewReply(
  tenantId: string,
  review: GbpReview,
): Promise<ReplyGenResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "no_api_key", detail: "Falta ANTHROPIC_API_KEY." };
  }
  const ficha = await getFicha(tenantId);
  if (!ficha) {
    return {
      ok: false,
      reason: "no_ficha",
      detail: `No hay ficha para tenant "${tenantId}". Configúrala en /admin/ficha-cliente.`,
    };
  }

  const tono = pickTono(review.starRating);

  try {
    const ai = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 400,
      messages: [{ role: "user", content: buildPrompt(ficha, review, tono) }],
    });
    const raw = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();
    const cleaned = raw
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`/g, "")
      .trim();
    if (!cleaned) return { ok: false, reason: "api_error", detail: "respuesta vacía" };
    return { ok: true, reply: cleaned, tono };
  } catch (err) {
    return {
      ok: false,
      reason: "api_error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Heurística: 5★ sin texto = candidato a auto-reply. El flag global
 * ROCIO_AUTO_REPLY decide si se publica directo o pasa por aprobación.
 */
export function shouldAutoReply(review: GbpReview): boolean {
  if ((process.env.ROCIO_AUTO_REPLY || "").toLowerCase() !== "true") return false;
  return review.starRating === 5 && !review.comment.trim();
}
