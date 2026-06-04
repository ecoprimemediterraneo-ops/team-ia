// Transformación de imagen vía Google Gemini Nano Banana (gemini-3.1-flash-image).
// La env var GEMINI_API_KEY es obligatoria — léela de process.env, NUNCA hardcodeada.

import "server-only";
import { ensureSquare } from "./image-style";
import type { AIStyle } from "./image-style-presets";

const MODEL = "gemini-3.1-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 60_000;

const PROMPTS: Record<AIStyle, string> = {
  comic:
    "Transforma esta foto en estilo cómic / ilustración moderna: líneas limpias y definidas, colores planos saturados, sombreado simple por zonas, estética tipo graphic novel premium. Mantén EXACTAMENTE la composición, las personas y los elementos clave de la foto original. No añadas texto ni firmas.",
  editorial:
    "Aplica a esta foto un look editorial de revista premium profesional: iluminación cuidada y direccional, colores ricos y matizados, contraste cinematográfico, tonos de piel naturales, profundidad. Mantén el realismo fotográfico, la composición original y todos los elementos de la escena. No añadas texto ni firmas.",
};

export type AITransformResult =
  | { ok: true; image: Buffer }
  | { ok: false; reason: "no_api_key" | "api_error" | "timeout" | "no_image"; detail: string };

export async function transformWithAI(
  imageBuffer: Buffer,
  estiloIA: AIStyle,
): Promise<AITransformResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      ok: false,
      reason: "no_api_key",
      detail: "Falta GEMINI_API_KEY en .env.local (local) o en Vercel (prod).",
    };
  }

  const prompt = PROMPTS[estiloIA];
  if (!prompt) {
    return { ok: false, reason: "api_error", detail: `Estilo IA desconocido: ${estiloIA}` };
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBuffer.toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const err = e as Error;
    if (err.name === "AbortError") {
      return { ok: false, reason: "timeout", detail: `Gemini tardó >${TIMEOUT_MS}ms` };
    }
    return { ok: false, reason: "api_error", detail: `Network: ${err.message}` };
  }
  clearTimeout(timer);

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return {
      ok: false,
      reason: "api_error",
      detail: `Gemini ${resp.status}: ${text.slice(0, 400)}`,
    };
  }

  let json: unknown;
  try {
    json = await resp.json();
  } catch (e) {
    return { ok: false, reason: "api_error", detail: `JSON parse: ${(e as Error).message}` };
  }

  // Recorre candidates[].content.parts[] buscando inlineData con imagen.
  const j = json as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
    }>;
    promptFeedback?: unknown;
  };

  const parts = j.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(
    (p) => p?.inlineData?.data && (p.inlineData.mimeType || "").startsWith("image/"),
  );
  if (!imgPart || !imgPart.inlineData?.data) {
    return {
      ok: false,
      reason: "no_image",
      detail: `Respuesta sin imagen. feedback=${JSON.stringify(j.promptFeedback ?? null).slice(0, 200)}`,
    };
  }

  const raw = Buffer.from(imgPart.inlineData.data, "base64");
  try {
    const squared = await ensureSquare(raw);
    return { ok: true, image: squared };
  } catch (e) {
    return { ok: false, reason: "api_error", detail: `Resize: ${(e as Error).message}` };
  }
}
