/**
 * Pablo · Clasificador de intent para mensajes WhatsApp.
 */

import { anthropic, MODELS } from "@/lib/claude";
import type { WaIntent, WaMessage } from "./pablo-wa-db";

const SYSTEM = `Eres un clasificador de intent para mensajes que llegan al WhatsApp Business de un negocio local en España.

Tu única tarea: leer el mensaje + el historial reciente y devolver JSON estricto:
{"intent":"<categoria>","confidence":<0-1>,"reasoning":"<una frase>"}

CATEGORÍAS PERMITIDAS (SOLO estas):
- "consulta_precio"  → pregunta cuánto cuesta algo
- "pedir_cita"       → quiere reservar / agendar cita
- "confirmar_cita"   → confirma una cita ya agendada ("sí, allí estaré")
- "cancelar_cita"    → cancela o pide cambiar una cita
- "info_servicio"    → pregunta qué hacéis, horario, dirección, parking
- "queja"            → se queja de algo (mal servicio, tarda, error)
- "spam"             → spam, link sospechoso, oferta no relacionada
- "saludo"           → solo "hola", emoji, sin pedir nada concreto
- "otro"             → no encaja en las anteriores

REGLAS DURAS:
1. SOLO JSON válido. Sin texto antes ni después.
2. confidence < 0.7 si el mensaje es muy corto o ambiguo.
3. Urgencia médica/emergencia → "queja" (escalar a humano YA).
4. Si pide cita Y precio en el mismo mensaje → "pedir_cita" (mayor prioridad).
5. Si responde "sí", "vale", "ok" tras un mensaje del negocio → mirar contexto: confirmar/aceptar lo que se le ofreció.`;

export type ClassifierResult = {
  intent: WaIntent;
  confidence: number;
  reasoning: string;
};

const VALID: WaIntent[] = [
  "consulta_precio",
  "pedir_cita",
  "confirmar_cita",
  "cancelar_cita",
  "info_servicio",
  "queja",
  "spam",
  "saludo",
  "otro",
];

function parseJson(text: string): ClassifierResult | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const p = JSON.parse(m[0]);
    if (typeof p.intent === "string" && VALID.includes(p.intent) && typeof p.confidence === "number" && typeof p.reasoning === "string") {
      return {
        intent: p.intent,
        confidence: Math.max(0, Math.min(1, p.confidence)),
        reasoning: p.reasoning.slice(0, 200),
      };
    }
  } catch { /* */ }
  return null;
}

export async function classifyWaMessage(text: string, history: WaMessage[] = []): Promise<ClassifierResult> {
  const hist = history
    .slice(-5)
    .map((m) => `[${m.direction === "in" ? "Cliente" : "Pablo"}]: ${m.content}`)
    .join("\n");

  const userPrompt = hist
    ? `Historial reciente:\n${hist}\n\nMensaje nuevo:\n${text}\n\nClasifica.`
    : `Mensaje:\n${text}\n\nClasifica.`;

  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 150,
      temperature: 0,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = completion.content[0];
    const t = block && block.type === "text" ? block.text : "";
    return parseJson(t) ?? { intent: "otro", confidence: 0.3, reasoning: "parse fallido" };
  } catch (e) {
    console.error("[pablo-classifier]", e);
    return { intent: "otro", confidence: 0, reasoning: "error api" };
  }
}
