/**
 * Rocío · Generador de respuestas a reseñas Google.
 * Aplica reglas duras del sector + tono custom del cliente.
 */

import { anthropic, MODELS } from "@/lib/claude";
import type { RocioProfile } from "./rocio-profile";

export type RocioContext = {
  reviewerName: string | null;
  rating: number;
  reviewText: string;
};

export function classifyReviewIntent(rating: number, text: string): "positiva" | "negativa" | "neutra" | "posible_falsa" {
  if (rating >= 4) return "positiva";
  if (rating <= 2) return "negativa";
  if (rating === 3) return "neutra";
  // heurística simple para falsas: muy corta + sin contexto + 1 estrella
  if (rating === 1 && text.length < 20) return "posible_falsa";
  return "neutra";
}

const SYSTEM_BUILDER = (p: RocioProfile, intent: string) => `Eres Rocío, gestora de reseñas Google de "${p.nombre_negocio || 'el negocio'}".

CONTEXTO:
- Tono de marca: ${p.tono_marca || "cordial y profesional"}
- Firma: ${p.firma_respuesta || "El equipo"}

REGLAS DURAS — INNEGOCIABLES:
1. Idioma SIEMPRE español de España (tú/vosotros, NUNCA usted/ustedes).
2. Tono humano, NUNCA "como modelo de lenguaje", NUNCA "estimado cliente".
3. Longitud MÁXIMA 4 frases. Las respuestas largas son peor que cortas.
4. Empieza nombrando al cliente si lo tienes, si no "¡Hola!" o "Hola".
5. NUNCA prometas precios concretos ni descuentos.
6. NUNCA discutas en público con el cliente.
7. Cierra con "${p.firma_respuesta || "El equipo de " + (p.nombre_negocio || "tu negocio")}".

REGLAS SEGÚN TIPO DE RESEÑA:
- POSITIVA (4-5★): agradecimiento sincero + menciona detalle CONCRETO de lo que el cliente dijo + invitación a volver. Cero plantilla genérica.
- NEUTRA (3★): agradeces + pregunta abierta de cómo mejorar + nunca defensivo.
- NEGATIVA (1-2★): empatía + asume responsabilidad sin justificar + ofrece canal privado (email/teléfono) para resolver. NUNCA echar la culpa a algo o alguien.
- POSIBLE FALSA: respuesta firme y profesional, deja constancia de que "no nos consta como cliente" sin acusar abiertamente.

INTENT DETECTADO: ${intent.toUpperCase()}
${p.reglas_custom ? `\nREGLAS ESPECÍFICAS DE ESTE NEGOCIO (cúmplelas SIEMPRE):\n${p.reglas_custom}\n` : ""}
DEVUELVE SOLO el texto de la respuesta. Sin comillas. Sin prefijos. Sin "Rocío:". Sin explicaciones. Listo para pegar en Google.`;

export async function generateReviewResponse(
  ctx: RocioContext,
  profile: RocioProfile,
): Promise<{ response: string; intent: string }> {
  const intent = classifyReviewIntent(ctx.rating, ctx.reviewText);

  const userPrompt = `Reseña de ${ctx.reviewerName || "un cliente"} (${ctx.rating}★):

"${ctx.reviewText}"

Redacta la respuesta pública para Google.`;

  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 300,
      temperature: 0.4,
      system: SYSTEM_BUILDER(profile, intent),
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = completion.content[0];
    let text = block && block.type === "text" ? block.text.trim() : "";
    text = text.replace(/^["“'"]|["”'"]$/g, "");
    return { response: text || `¡Hola${ctx.reviewerName ? " " + ctx.reviewerName : ""}! Gracias por tu reseña. ${profile.firma_respuesta || "El equipo"}`, intent };
  } catch (e) {
    console.error("[rocio-responder]", e);
    return { response: `¡Hola${ctx.reviewerName ? " " + ctx.reviewerName : ""}! Gracias por tu reseña. ${profile.firma_respuesta || "El equipo"}`, intent };
  }
}

// ─── Templates para SOLICITAR reseña ────────────────────────────────────────

export type RequestChannel = "whatsapp" | "sms" | "email";

export function buildReviewRequestMessage(
  channel: RequestChannel,
  customerName: string | null,
  businessName: string,
  reviewLink: string,
): string {
  const hola = customerName ? `Hola ${customerName}` : "¡Hola!";
  if (channel === "whatsapp") {
    return `${hola} 👋 Soy del equipo de ${businessName}. Si te ha gustado nuestra atención, ¿nos dejas una reseña en Google? Solo te lleva 30 segundos y nos ayuda muchísimo 🙏

👉 ${reviewLink}

¡Gracias!`;
  }
  if (channel === "sms") {
    return `${hola}, soy del equipo de ${businessName}. ¿Nos dejas una reseña en Google? 30 segundos: ${reviewLink} ¡Gracias!`;
  }
  // email
  return `${hola},

Soy del equipo de ${businessName}. Te escribimos porque ha sido un placer atenderte.

Si tienes 30 segundos, nos ayudaría muchísimo que nos dejes una reseña en Google. Tu opinión hace que otros clientes nos descubran:

${reviewLink}

¡Gracias de corazón!

— El equipo de ${businessName}`;
}
