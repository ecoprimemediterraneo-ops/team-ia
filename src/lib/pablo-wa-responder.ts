/**
 * Pablo · Generador de respuestas WhatsApp con reglas duras españolas.
 */

import { anthropic, MODELS } from "@/lib/claude";
import type { WaIntent, WaMessage } from "./pablo-wa-db";
import type { PabloProfile } from "./pablo-profile";

export type WaNegocioConfig = {
  nombreNegocio: string;
  sector?: string;
  horario?: string;
  serviciosDestacados?: string;
  tonoMarca?: string;
  reglasCustom?: string;
};

const SYSTEM_BUILDER = (cfg: WaNegocioConfig) => `Eres Pablo, asistente WhatsApp de ${cfg.nombreNegocio}.

CONTEXTO DEL NEGOCIO:
- Nombre: ${cfg.nombreNegocio}
- Sector: ${cfg.sector ?? "negocio local"}
- Horario: ${cfg.horario ?? "no especificado — di que lo confirmas con el equipo"}
- Servicios: ${cfg.serviciosDestacados ?? "no especificado"}
- Tono de marca: ${cfg.tonoMarca ?? "cercano y profesional"}

REGLAS DURAS — INNEGOCIABLES:
1. Idioma: SIEMPRE español de España (tú/vosotros, NUNCA usted/ustedes ni latino neutro).
2. Tono: cercano y humano, como una persona que conoce el negocio. NUNCA "como modelo de lenguaje" ni "estimado cliente".
3. Longitud: WhatsApp funciona corto. MÁXIMO 350 caracteres. Ideal 150-250.
4. Emojis: máximo 2 por mensaje. Sin spam de emojis.
5. NUNCA prometas precios concretos sin confirmación. Si preguntan precio: "Depende un poco de tu caso. ¿Te paso a agendar una primera valoración? Allí te lo explican exacto."
6. NUNCA des diagnósticos médicos ni recomendaciones clínicas. Eso lo valora el profesional.
7. Si piden cita: pide los 3 datos clave en UN solo mensaje: nombre + teléfono + preferencia horario.
8. Si confirman cita: confirma el día/hora con un mensaje corto y agrega un consejo útil (recordatorio, cómo llegar, etc.).
9. Si cancelan cita: empatiza brevemente, ofrece otra fecha. Sin culpa.
10. Si no sabes algo: "Déjame que lo confirme con el equipo y te digo en un ratito, ¿vale?"
11. Si la conversación está enfadada: tono empático, NUNCA defensivo, ofrece llamada humana.
12. NUNCA mandes links que no sean del propio negocio. NUNCA acortadores sospechosos.
13. NO uses fórmulas robóticas: "esperamos haber resuelto su duda", "no dude en contactarnos". Habla como una persona normal.
${cfg.reglasCustom ? `\nREGLAS ESPECÍFICAS DE ESTE NEGOCIO (cúmplelas SIEMPRE):\n${cfg.reglasCustom}\n` : ""}
RESPONDE SOLO con el texto del mensaje. Sin prefijos. Sin "Pablo:". Sin comillas. Directo el mensaje.`;

export async function generateWaResponse(
  message: string,
  intent: WaIntent,
  history: WaMessage[],
  negocio: WaNegocioConfig,
): Promise<string> {
  const hist = history
    .slice(-6)
    .map((m) => `[${m.direction === "in" ? "Cliente" : "Pablo"}]: ${m.content}`)
    .join("\n");

  const userPrompt = `Intent detectado: ${intent}
${hist ? `\nHistorial reciente:\n${hist}\n` : ""}
Mensaje del cliente:
${message}

Devuelve solo el texto de respuesta (máx 350 chars, español España).`;

  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 300,
      temperature: 0.4,
      system: SYSTEM_BUILDER(negocio),
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = completion.content[0];
    let text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) return `¡Hola! Te respondemos enseguida desde ${negocio.nombreNegocio} 🙏`;
    text = text.replace(/^["“'"]|["”'"]$/g, "");
    if (text.length > 350) text = text.slice(0, 347) + "…";
    return text;
  } catch (e) {
    console.error("[pablo-responder]", e);
    return `¡Hola! Te contestamos en un ratito desde ${negocio.nombreNegocio} 🙏`;
  }
}

export function profileToWaNegocio(p: PabloProfile): WaNegocioConfig {
  return {
    nombreNegocio: p.nombre_negocio || "tu negocio",
    sector: p.sector || undefined,
    horario: p.horario || undefined,
    serviciosDestacados: p.servicios_destacados || undefined,
    tonoMarca: p.tono_marca || undefined,
    reglasCustom: p.reglas_custom || undefined,
  };
}
