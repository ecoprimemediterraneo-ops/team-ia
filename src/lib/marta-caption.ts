// Cerebro de publicación de Marta: genera el caption de Instagram leyendo
// la ficha del tenant. Modelo: Claude Haiku (mismo patrón que informe-mensual.ts
// y sergio-analysis.ts).
//
// Marta en Instagram NO renderiza markdown — prohibido cualquier asterisco.

import "server-only";
import { anthropic, MODELS } from "./claude";
import { getFicha, fichaToPromptContext } from "./ficha";

const MAX_CAPTION = 2200;

export type GenerarCaptionInput = {
  tenantId: string;
  tema?: string;
  contexto?: string;
};

export type GenerarCaptionResult =
  | { ok: true; caption: string; tema: string }
  | { ok: false; reason: "no_ficha" | "no_api_key" | "api_error" | "empty"; detail: string };

function buildPrompt(opts: {
  fichaContext: string;
  tema?: string;
  contexto?: string;
}): string {
  const { fichaContext, tema, contexto } = opts;
  const temaLine = tema
    ? `TEMA OBLIGATORIO DEL POST: ${tema}`
    : `TEMA: elige tú un tema realista y atractivo para el sector y momento del año (promoción, consejo, recordatorio, novedad, testimonio, etc.). Devuélvelo en la primera línea como "TEMA: …" seguido de DOS saltos de línea y luego el caption.`;
  const ctxLine = contexto ? `CONTEXTO EXTRA APORTADO: ${contexto}\n` : "";

  return `ROL: ERES el negocio descrito abajo escribiendo el caption de TU próximo post de Instagram para TUS clientes/pacientes finales. Escribes en primera persona del plural del negocio ("ofrecemos", "te esperamos", "en nuestra clínica"). No eres una agencia. No eres Marta. No eres una IA.

FICHA DEL NEGOCIO (eres TÚ):
${fichaContext}

${ctxLine}${temaLine}

OBJETIVO: promocionar TUS servicios a TUS clientes/pacientes. El post lo verán seguidores que ya conocen tu sector — clientes finales, no empresarios buscando software.

PROHIBIDO ABSOLUTAMENTE (te despiden si los mencionas):
- AI-Team, agentes IA, asistentes IA, automatización, beta, plazas, software, herramientas.
- Hablar de marketing, redes sociales, community manager.
- Mencionar a "Marta" o cualquier otro agente.
- Vender nada que no sean los servicios concretos del negocio (blanqueamiento dental, corte de pelo, masaje, lo que toque según la ficha).

REGLAS DE FORMATO (críticas):
- CORTO. Máximo 4-5 líneas de texto + 1 línea de hashtags. Nada de párrafos largos.
- Línea 1: gancho directo (pregunta, dato, frase corta con personalidad). Sin "En [nombre del negocio]…".
- 2-3 líneas centrales: UNA sola idea sobre el tema. Concreto, no genérico.
- Última línea de texto: UN CTA suave (pedir cita, escribir por DM, reservar, llamar).
- Línea final de hashtags: 3 a 8 hashtags relevantes (sector + ciudad + servicio), en una sola línea, separados por espacios.
- Español de España, tutea al cliente final.
- Sin asteriscos (*), sin guiones bajos (_), sin markdown, sin negritas, sin listas. Solo texto plano.
- Emojis: máximo 2 en todo el caption, solo si aportan.
- Máximo ${MAX_CAPTION} caracteres totales (apunta a 400-700, no rellenes).
- No inventes precios ni promociones específicas si no están en la ficha. No prometas resultados garantizados.

FORMATO DE SALIDA:
${tema ? `Devuelve SOLO el caption. Sin comillas, sin meta-comentarios, sin explicar lo que has hecho.` : `Línea 1: "TEMA: <tema elegido para el negocio>"\nLínea 2 vacía.\nLíneas 3+: el caption tal cual se publicaría.\nSin comillas, sin meta-comentarios.`}`;
}

function stripMarkdown(s: string): string {
  // Marta IG no renderiza markdown — eliminamos asteriscos, subrayados de cursiva
  // y backticks que se cuelen.
  return s
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/__/g, "")
    .replace(/_(?=\S)|(?<=\S)_/g, "");
}

function parseModelOutput(raw: string, temaInput?: string): { caption: string; tema: string } {
  const text = stripMarkdown(raw.trim());
  if (temaInput) {
    return { caption: text.slice(0, MAX_CAPTION), tema: temaInput };
  }
  const m = text.match(/^\s*TEMA:\s*([^\n]+)\n+([\s\S]+)$/i);
  if (m) {
    return { tema: m[1].trim(), caption: m[2].trim().slice(0, MAX_CAPTION) };
  }
  return { tema: "general", caption: text.slice(0, MAX_CAPTION) };
}

export async function generarCaption(
  input: GenerarCaptionInput,
): Promise<GenerarCaptionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "no_api_key", detail: "Falta ANTHROPIC_API_KEY en env." };
  }

  const ficha = await getFicha(input.tenantId);
  if (!ficha) {
    return {
      ok: false,
      reason: "no_ficha",
      detail: `No hay ficha para el tenant "${input.tenantId}". Crea la ficha en /admin/ficha-cliente.`,
    };
  }

  const fichaContext = fichaToPromptContext(ficha);
  const prompt = buildPrompt({
    fichaContext,
    tema: input.tema?.trim() || undefined,
    contexto: input.contexto?.trim() || undefined,
  });

  try {
    const ai = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    if (!raw) {
      return { ok: false, reason: "empty", detail: "Haiku devolvió respuesta vacía." };
    }

    const { caption, tema } = parseModelOutput(raw, input.tema?.trim() || undefined);
    if (!caption) {
      return { ok: false, reason: "empty", detail: "Caption vacío tras parseo." };
    }
    return { ok: true, caption, tema };
  } catch (err) {
    return {
      ok: false,
      reason: "api_error",
      detail: `Anthropic: ${(err as Error).message}`,
    };
  }
}

// -----------------------------------------------------------------------------
// PENDIENTE — punto de unión con la imagen y el flujo de aprobación.
// Cuando esté listo el motor de imagen + el flujo de aprobación por WhatsApp:
//
//   import { applyStyle } from "./image-style";
//   import { getStyleConfig } from "./style-config-temp";
//   import { sendWhatsAppApproval } from "./pablo"; // TODO
//
//   export async function prepararPublicacion(tenantId: string, opts: {
//     tema?: string;
//     imagenSrc: Buffer | string; // URL o buffer
//   }) {
//     const cap = await generarCaption({ tenantId, tema: opts.tema });
//     if (!cap.ok) throw new Error(cap.detail);
//     const style = getStyleConfig(); // de momento temp; luego desde ficha del tenant
//     const imgBuf = typeof opts.imagenSrc === "string"
//       ? Buffer.from(await (await fetch(opts.imagenSrc)).arrayBuffer())
//       : opts.imagenSrc;
//     const finalImage = await applyStyle(imgBuf, style);
//     // 1. subir imagen a almacenamiento público
//     // 2. enviar a fundador por WhatsApp: caption + preview imagen + botones aprobar/regenerar
//     // 3. al aprobar -> publishToInstagram() de marta-publish.ts
//     return { caption: cap.caption, tema: cap.tema, finalImage };
//   }
// -----------------------------------------------------------------------------
