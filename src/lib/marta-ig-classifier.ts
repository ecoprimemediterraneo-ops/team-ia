/**
 * Marta · Clasificador de intent para DMs/comentarios Instagram.
 * Devuelve JSON estricto { intent, confidence, reasoning }.
 *
 * Uso:
 *   const result = await classifyIgMessage(text, recentMessages);
 *   if (result.intent === "queja" || result.confidence < 0.7) → escalar
 */

import { anthropic, MODELS } from "@/lib/claude";
import type { Intent, Message } from "./marta-ig-db";

const SYSTEM = `Eres un clasificador de intent para mensajes que llegan a Instagram (DMs, comentarios, menciones) de un negocio local en España.

Tu única tarea: leer el mensaje del usuario + el historial reciente y devolver un JSON con:
  - intent: una de estas categorías exactas
  - confidence: número entre 0 y 1
  - reasoning: 1 frase corta explicando por qué

CATEGORÍAS PERMITIDAS (usa SOLO estas):
- "consulta_precio"    → pregunta cuánto cuesta algo
- "pedir_cita"         → quiere reservar / agendar
- "info_servicio"      → pregunta qué hacéis, horario, dirección, parking, etc.
- "queja"              → se queja de algo (mal servicio, tarda, etc.)
- "spam"               → claramente spam, link sospechoso, promo no relacionada
- "saludo"             → solo dice hola, "buenos días", emoji suelto, sin pedir nada
- "otro"               → no encaja en las anteriores

REGLAS DURAS:
1. Devuelve SOLO JSON válido. NADA de texto antes o después.
2. confidence < 0.7 si el mensaje es ambiguo o muy corto.
3. Si detectas urgencia médica/emergencia → intent="queja" (necesita humano YA).
4. Si el usuario pide cita Y precio en el mismo mensaje → intent="pedir_cita" (es prioridad mayor).
5. Spam = URL sospechosa, promesa irreal (ganar dinero, criptomonedas), mensaje copiado masivo.

Formato exacto de salida:
{"intent":"<categoria>","confidence":<0-1>,"reasoning":"<una frase>"}`;

export type ClassifierResult = {
  intent: Intent;
  confidence: number;
  reasoning: string;
};

const VALID_INTENTS: Intent[] = [
  "consulta_precio",
  "pedir_cita",
  "info_servicio",
  "queja",
  "spam",
  "saludo",
  "otro",
];

function safeJsonParse(text: string): ClassifierResult | null {
  // Intentar extraer JSON del texto (a veces Claude añade ```json wrappers)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (
      typeof parsed.intent === "string" &&
      VALID_INTENTS.includes(parsed.intent as Intent) &&
      typeof parsed.confidence === "number" &&
      typeof parsed.reasoning === "string"
    ) {
      return {
        intent: parsed.intent as Intent,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        reasoning: parsed.reasoning.slice(0, 200),
      };
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

export async function classifyIgMessage(
  messageText: string,
  recentMessages: Message[] = [],
): Promise<ClassifierResult> {
  // Construir contexto: últimos 5 mensajes en formato compacto
  const historial = recentMessages
    .slice(-5)
    .map((m) => `[${m.direction === "in" ? "Usuario" : "Marta"}]: ${m.content}`)
    .join("\n");

  const userPrompt = historial
    ? `Historial reciente:\n${historial}\n\nMensaje nuevo del usuario:\n${messageText}\n\nClasifícalo.`
    : `Mensaje del usuario:\n${messageText}\n\nClasifícalo.`;

  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 150,
      temperature: 0,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = completion.content[0];
    const text = block && block.type === "text" ? block.text : "";
    const result = safeJsonParse(text);
    if (result) return result;

    // Fallback si el parse falla
    return { intent: "otro", confidence: 0.3, reasoning: "Parse fallido del clasificador" };
  } catch (e) {
    console.error("[marta-ig-classifier]", e);
    return { intent: "otro", confidence: 0, reasoning: "Error API Claude" };
  }
}
