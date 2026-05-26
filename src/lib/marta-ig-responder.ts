/**
 * Marta · Generador de respuestas para DMs Instagram.
 * Aplica las "reglas duras" definidas: sin precios, sin diagnósticos,
 * máx 280 chars, máx 2 emojis, español de España, ofrecer cita.
 */

import { anthropic, MODELS } from "@/lib/claude";
import type { Intent, Message } from "./marta-ig-db";

export type NegocioConfig = {
  /** Nombre del negocio que aparece como remitente */
  nombreNegocio: string;
  /** "Cercano" / "Profesional" / "Cercano-profesional" */
  tonoMarca?: string;
  /** Horario del negocio en texto libre */
  horario?: string;
  /** Lista de servicios destacados (string libre) */
  serviciosDestacados?: string;
  /** Sector — informa al modelo del contexto */
  sector?: string;
  /** Reglas custom adicionales que el cliente define (textarea libre) */
  reglasCustom?: string;
};

const SYSTEM_BUILDER = (cfg: NegocioConfig) => `Eres la asistente virtual de ${cfg.nombreNegocio} en Instagram. Tu nombre es Marta.

CONTEXTO DEL NEGOCIO:
- Nombre: ${cfg.nombreNegocio}
- Sector: ${cfg.sector ?? "negocio local"}
- Horario: ${cfg.horario ?? "no especificado — di que lo confirmas con el equipo"}
- Servicios destacados: ${cfg.serviciosDestacados ?? "no especificado"}
- Tono de marca: ${cfg.tonoMarca ?? "cercano, profesional"}

REGLAS DURAS — INNEGOCIABLES:
1. Idioma: SIEMPRE español de España (tú, vosotros). NUNCA latino neutro (usted, ustedes).
2. Tono: cercano, humano, profesional. Como una recepcionista que cae bien. NUNCA "como modelo de lenguaje".
3. Longitud: MÁXIMO 280 caracteres. Ideal 100-180. Instagram DM funciona mejor corto.
4. Emojis: máximo 2 por mensaje. Sin excesos.
5. NUNCA prometas precios concretos. Si preguntan precio → "Depende un poco de tu caso. ¿Te paso a agendar una primera valoración? Es gratis y allí te lo explican exacto."
6. NUNCA des diagnósticos médicos ni recomendaciones de tratamiento. Si preguntan eso → "Eso lo valora mejor el profesional en persona. ¿Te agendamos cita?"
7. Si piden cita: pide los 3 datos clave en UN mensaje: nombre + teléfono + preferencia horario.
8. Si no sabes algo → "Déjame que lo confirme con el equipo y te digo en un ratito, ¿vale?"
9. Si la conversación está enfadada → tono empático, NUNCA defensivo, ofrece llamada de un humano.
10. NO uses fórmulas robóticas: "estimado cliente", "esperamos haber resuelto su duda", "no dude en contactarnos". Habla como persona.
${cfg.reglasCustom ? `\nREGLAS ESPECÍFICAS DE ESTE NEGOCIO (cúmplelas SIEMPRE):\n${cfg.reglasCustom}\n` : ""}
RESPONDE SOLO con el texto del mensaje, sin prefijos, sin "Marta:", sin comillas. Directo el mensaje.`;

function userPromptBuilder(
  message: string,
  intent: Intent,
  recentMessages: Message[],
): string {
  const historial = recentMessages
    .slice(-6)
    .map((m) => `[${m.direction === "in" ? "Cliente" : "Marta"}]: ${m.content}`)
    .join("\n");

  return `Intent detectado: ${intent}
${historial ? `\nHistorial reciente:\n${historial}\n` : ""}
Mensaje del cliente (responde a este):
${message}

Devuelve solo el texto de respuesta, máx 280 chars, español España, aplicando las reglas duras.`;
}

export async function generateIgResponse(
  message: string,
  intent: Intent,
  recentMessages: Message[],
  negocio: NegocioConfig,
): Promise<string> {
  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 250,
      temperature: 0.4, // suficiente variedad sin ser caótico
      system: SYSTEM_BUILDER(negocio),
      messages: [{ role: "user", content: userPromptBuilder(message, intent, recentMessages) }],
    });

    const block = completion.content[0];
    let text = block && block.type === "text" ? block.text.trim() : "";

    // Sanitización dura final
    if (!text) {
      return `¡Hola! Te respondemos enseguida desde el equipo de ${negocio.nombreNegocio} 🙏`;
    }
    // Quitar comillas envolventes si las hay
    text = text.replace(/^["“'"]|["”'"]$/g, "");
    // Truncar a 280 chars como red de seguridad
    if (text.length > 280) text = text.slice(0, 277) + "…";
    return text;
  } catch (e) {
    console.error("[marta-ig-responder]", e);
    return `¡Hola! En un ratito te contestamos personalmente desde ${negocio.nombreNegocio} 🙏`;
  }
}
