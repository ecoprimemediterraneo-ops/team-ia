/**
 * Lucía · Generador de borradores con reglas duras + perfil personalizado.
 */

import { anthropic, MODELS } from "@/lib/claude";
import type { LuciaProfile } from "./lucia-profile";
import type { LuciaIntent } from "./lucia-db";

export type EmailContext = {
  fromName: string | null;
  fromEmail: string | null;
  subject: string;
  body: string;
};

const VALID_INTENTS: LuciaIntent[] = [
  "pregunta",
  "reunion",
  "queja",
  "spam",
  "info",
  "propuesta",
  "factura",
  "otro",
];

const CLASSIFIER_SYSTEM = `Clasificador de intent para emails entrantes en Gmail empresarial.

Devuelve JSON estricto: {"intent":"<categoria>","confidence":<0-1>,"reasoning":"<una frase>"}

CATEGORÍAS:
- "pregunta"   → preguntan algo concreto que requiere respuesta
- "reunion"    → piden agendar reunión/llamada/cita
- "queja"      → se quejan o están enfadados
- "spam"       → spam, promo no relacionada, cold outreach genérico
- "info"       → notificación informativa, confirmación, newsletter (no requiere acción)
- "propuesta"  → propuesta comercial / cotización
- "factura"    → factura, recibo, contabilidad
- "otro"       → no encaja en las anteriores

REGLAS:
1. SOLO JSON válido. Sin texto antes ni después.
2. confidence < 0.7 si es ambiguo.
3. Si parece urgencia/emergencia → "queja" (escalar a humano).
4. Cold sales pitches automatizados → "spam".`;

function parseClassifierJson(text: string): { intent: LuciaIntent; confidence: number; reasoning: string } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const p = JSON.parse(m[0]);
    if (
      typeof p.intent === "string" &&
      VALID_INTENTS.includes(p.intent as LuciaIntent) &&
      typeof p.confidence === "number" &&
      typeof p.reasoning === "string"
    ) {
      return {
        intent: p.intent as LuciaIntent,
        confidence: Math.max(0, Math.min(1, p.confidence)),
        reasoning: p.reasoning.slice(0, 200),
      };
    }
  } catch { /* */ }
  return null;
}

export async function classifyEmail(ctx: EmailContext): Promise<{
  intent: LuciaIntent;
  confidence: number;
  reasoning: string;
}> {
  const userPrompt = `De: ${ctx.fromName || "?"} <${ctx.fromEmail || "?"}>
Asunto: ${ctx.subject}

Cuerpo:
${ctx.body.slice(0, 2000)}

Clasifica.`;

  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 150,
      temperature: 0,
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = completion.content[0];
    const t = block && block.type === "text" ? block.text : "";
    return parseClassifierJson(t) ?? { intent: "otro", confidence: 0.3, reasoning: "parse fallido" };
  } catch (e) {
    console.error("[lucia-classifier]", e);
    return { intent: "otro", confidence: 0, reasoning: "error api" };
  }
}

// ─── Responder ──────────────────────────────────────────────────────────────

const RESPONDER_SYSTEM = (p: LuciaProfile, intent: LuciaIntent) => `Eres Lucía, asistente ejecutiva personal de ${p.nombre_persona || "el usuario"}${p.cargo ? `, ${p.cargo}` : ""}${p.empresa ? ` en ${p.empresa}` : ""}.

Tu trabajo: redactar BORRADORES de respuesta a emails entrantes para que ${p.nombre_persona || "el usuario"} los revise antes de enviar.

REGLAS DURAS — INNEGOCIABLES:
1. Idioma SIEMPRE español de España (tú/vosotros), salvo que el email entrante esté en inglés (entonces responde en inglés).
2. Tono: ${p.tono_marca || "cercano y profesional"}. Como una persona real, NUNCA "como modelo de lenguaje", NUNCA "estimado cliente".
3. Longitud email: corto y al grano. 3-5 frases ideal. Solo más si la pregunta REQUIERE explicación larga.
4. Estructura: saludo breve / respuesta directa / cierre con firma.
5. NUNCA inventes información que no esté en el email original ni en el contexto. Si no sabes algo, di "déjame que lo confirme con el equipo y te respondo enseguida".
6. NUNCA prometas precios, fechas o compromisos sin confirmación. Si te preguntan por precio: ofrece llamada o pasa al equipo comercial.
7. Si el email es queja o tono enfadado: empatía + asume responsabilidad sin justificar + ofrece llamada para resolver.
8. Si piden reunión: ofrece 2 huecos concretos (lunes mañana / jueves tarde como ejemplo si no hay calendar real) o di "te paso 2 huecos cuando me confirme mi calendario".
9. Si es spam o cold pitch: NO contestes, marca como ignorar.
10. Firma: termina SIEMPRE con la firma del usuario:
${p.firma || `Saludos,\n${p.nombre_persona || "[Nombre]"}`}

INTENT DETECTADO: ${intent.toUpperCase()}
${p.reglas_custom ? `\nREGLAS ESPECÍFICAS (cúmplelas SIEMPRE):\n${p.reglas_custom}\n` : ""}
DEVUELVE SOLO el cuerpo del email (con la firma). Sin asunto. Sin "Borrador:". Sin comillas. Listo para enviar.`;

export async function generateLuciaDraft(
  ctx: EmailContext,
  profile: LuciaProfile,
  intent: LuciaIntent,
): Promise<string> {
  if (intent === "spam") return "";

  const userPrompt = `Email entrante:
De: ${ctx.fromName || "?"} <${ctx.fromEmail || "?"}>
Asunto: ${ctx.subject}

Cuerpo:
${ctx.body.slice(0, 3000)}

Redacta el borrador de respuesta.`;

  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 600,
      temperature: 0.4,
      system: RESPONDER_SYSTEM(profile, intent),
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = completion.content[0];
    let text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) {
      return `Hola${ctx.fromName ? " " + ctx.fromName.split(" ")[0] : ""},\n\nGracias por escribir. Te respondo personalmente en cuanto pueda.\n\n${profile.firma || `Saludos,\n${profile.nombre_persona || ""}`}`;
    }
    text = text.replace(/^["“'"]|["”'"]$/g, "");
    return text;
  } catch (e) {
    console.error("[lucia-responder]", e);
    return `Hola,\n\nGracias por escribir. Te respondo en breve.\n\n${profile.firma || "Saludos"}`;
  }
}
