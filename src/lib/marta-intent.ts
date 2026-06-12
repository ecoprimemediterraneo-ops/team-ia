// Clasificador de intención de la respuesta del cliente sobre una propuesta
// de Marta. Usado por el interceptor del webhook de Pablo para decidir si
// publicar, ajustar imagen, ajustar caption o descartar.
//
// Usa Haiku con JSON schema implícito (validación post-hoc). Si no hay
// ANTHROPIC_API_KEY o falla, cae a un heurístico simple basado en regex.

import { anthropic, MODELS } from "./claude";
import { isApprovalText } from "./marta-proposals";

export type MartaIntent =
  | "ok"
  | "cambiar_foto"
  | "cambiar_caption"
  | "rechazar"
  | "feedback_general";

export type ClassifyResult = {
  intent: MartaIntent;
  confidence: number;       // 0..1
  source: "ai" | "regex_fallback";
  detail?: string;          // qué cambio pidió el cliente, si aplica
  // Qué regenerar (cuando el intent pide cambios). Permite "ambos" en una sola
  // respuesta tipo "cambia la foto y el texto".
  changeFoto?: boolean;
  changeCaption?: boolean;
};

// A partir del intent + flags del modelo, decide qué regenerar.
function deriveChange(
  intent: MartaIntent,
  foto?: boolean,
  caption?: boolean,
): { changeFoto: boolean; changeCaption: boolean } {
  if (intent === "cambiar_foto") return { changeFoto: true, changeCaption: !!caption };
  if (intent === "cambiar_caption") return { changeCaption: true, changeFoto: !!foto };
  if (intent === "feedback_general") {
    // Solo regenera lo que el modelo marcó. Si no marcó nada (p. ej. "gracias",
    // una duda), no se regenera: el webhook pedirá aclaración. Evita gastar una
    // generación de imagen en mensajes que no piden cambios.
    return { changeFoto: !!foto, changeCaption: !!caption };
  }
  return { changeFoto: false, changeCaption: false }; // ok / rechazar
}

const SYSTEM_PROMPT = `Eres un clasificador. Recibes la respuesta de un dueño de negocio sobre una propuesta de post de Instagram (foto + caption) que un asistente IA llamado Marta le acaba de enviar por WhatsApp.

Tu tarea: clasificar la respuesta en UNA de estas 5 intenciones:
- "ok": el cliente aprueba y quiere publicar tal cual. Ej: "ok", "vale", "publica", "publícalo", "perfecto", "me gusta", "👍", "sí, dale", "súbelo".
- "cambiar_foto": pide cambiar/ajustar la imagen (no el texto). Ej: "cambia la foto", "esa imagen no me gusta", "ponla más clara", "otra foto", "la imagen no encaja".
- "cambiar_caption": pide cambiar/ajustar el texto del post (no la imagen). Ej: "el texto está largo", "quítale hashtags", "más corto", "el copy no", "reescríbelo", "cambia el caption".
- "rechazar": descarta del todo, no quiere publicar nada de esto. Ej: "no", "descártalo", "borra esto", "no me convence nada", "olvídalo".
- "feedback_general": ninguno de los anteriores claro — comentario, pregunta, duda, mezcla, etc.

Si el cliente pide cambios tanto en foto como en texto, usa intent "feedback_general" y marca AMBOS flags. Si está indeciso, "feedback_general".

Marca además QUÉ hay que regenerar:
- "change_foto": true si pide tocar la imagen.
- "change_caption": true si pide tocar el texto.
(Para "cambia la foto y el texto" → ambos true.)

Responde EXCLUSIVAMENTE con un objeto JSON con esta forma exacta (sin markdown, sin explicaciones extra):
{"intent":"ok|cambiar_foto|cambiar_caption|rechazar|feedback_general","confidence":0.0-1.0,"detail":"resumen muy breve del cambio pedido o vacío","change_foto":true|false,"change_caption":true|false}`;

const VALID: Set<MartaIntent> = new Set([
  "ok",
  "cambiar_foto",
  "cambiar_caption",
  "rechazar",
  "feedback_general",
]);

function regexFallback(text: string): ClassifyResult {
  // Aprobación clara → ok.
  if (isApprovalText(text)) {
    return { intent: "ok", confidence: 0.95, source: "regex_fallback" };
  }
  const t = text.toLowerCase();
  // Rechazo claro.
  if (/^\s*(no|nope|descart|borra|ol[v]?id[ae])/i.test(t)) {
    return { intent: "rechazar", confidence: 0.7, source: "regex_fallback" };
  }
  // Pista de foto vs caption.
  const fotoHits = /\b(foto|imagen|imágen|imagine|fotito|foto\?)/.test(t);
  const captionHits = /\b(texto|copy|caption|descripci[oó]n|hashtag|párrafo|frase)/.test(t);
  if (fotoHits && captionHits) {
    return { intent: "feedback_general", confidence: 0.6, source: "regex_fallback", changeFoto: true, changeCaption: true };
  }
  if (fotoHits) {
    return { intent: "cambiar_foto", confidence: 0.6, source: "regex_fallback", changeFoto: true, changeCaption: false };
  }
  if (captionHits) {
    return { intent: "cambiar_caption", confidence: 0.6, source: "regex_fallback", changeFoto: false, changeCaption: true };
  }
  // Sin pistas claras: feedback general SIN cambios marcados → el webhook
  // pedirá aclaración (no regenera a ciegas).
  return { intent: "feedback_general", confidence: 0.4, source: "regex_fallback", changeFoto: false, changeCaption: false };
}

/**
 * Clasifica la respuesta del cliente. Idempotente: misma entrada → misma
 * salida (asumiendo el modelo lo respete).
 */
export async function classifyClientReply(text: string): Promise<ClassifyResult> {
  if (!text || !text.trim()) {
    return { intent: "feedback_general", confidence: 0, source: "regex_fallback" };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return regexFallback(text);
  }

  try {
    const ai = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Respuesta del cliente:\n"""${text.slice(0, 1500)}"""`,
        },
      ],
    });
    const raw = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    // Robustez: extrae el primer {...} del output por si el modelo añadió texto.
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return regexFallback(text);

    let parsed: unknown;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return regexFallback(text);
    }

    const j = parsed as {
      intent?: string;
      confidence?: number;
      detail?: string;
      change_foto?: boolean;
      change_caption?: boolean;
    };
    const intent = (j.intent ?? "").toString() as MartaIntent;
    if (!VALID.has(intent)) return regexFallback(text);

    const confidence = Number.isFinite(j.confidence) ? Math.max(0, Math.min(1, j.confidence!)) : 0.7;
    const change = deriveChange(intent, j.change_foto, j.change_caption);
    return {
      intent,
      confidence,
      source: "ai",
      detail: typeof j.detail === "string" ? j.detail.slice(0, 200) : undefined,
      changeFoto: change.changeFoto,
      changeCaption: change.changeCaption,
    };
  } catch (err) {
    console.error("[marta/intent] AI classify falló:", err);
    return regexFallback(text);
  }
}
