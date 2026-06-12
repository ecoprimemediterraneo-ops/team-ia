// =============================================================================
// Motor de imagen de Marta para el flujo de publicación (modo MEZCLA).
// =============================================================================
//
//   generatePostImage()  → NO hay foto: Marta crea la imagen con IA (DALL·E 3)
//                          usando TODA la ficha del cliente (sector, servicios,
//                          tono, público, estilo). Devuelve URL durable + el
//                          prompt usado (para auditar).
//
//   styleExistingPhoto()  → SÍ hay foto: se aplica el estilo visual de la ficha
//                          (preset sharp y/o estilo IA Gemini) a la foto pegada.
//
// Ambas devuelven una URL servida por /api/admin/marta-image/<id>, que persiste
// en Supabase para seguir viva cuando se publique la propuesta más tarde.
//
// SOLO imágenes (IMAGE / STORIES_IMAGE). Reels y stories de vídeo NO se generan:
// el vídeo lo sube el cliente.
// =============================================================================

import "server-only";
import { anthropic, MODELS } from "./claude";
import { openai } from "./openai";
import { getFicha, getEstilo, fichaToPromptContext } from "./ficha";
import { storeImage, imageUrlFor } from "./marta-image-store";
import { applyStyle } from "./image-style";
import { transformWithAI } from "./image-style-ai";
import type { StyleConfig } from "./image-style-presets";

export type GenImageResult =
  | { ok: true; url: string; prompt: string }
  | { ok: false; reason: "no_ficha" | "no_api_key" | "ai_error" | "store_error"; detail: string };

export type StylePhotoResult =
  | { ok: true; url: string }
  | { ok: false; detail: string };

// Dirección de estilo visual (en inglés) derivada de la ficha, para el prompt.
function styleDirection(estilo: StyleConfig): string {
  if (estilo.aiStyle === "comic") {
    return "modern flat illustration, clean bold lines, saturated flat colors, premium graphic-novel look";
  }
  if (estilo.aiStyle === "editorial") {
    return "premium editorial magazine photography, careful directional lighting, cinematic contrast, photorealistic";
  }
  switch (estilo.preset) {
    case "calido":
      return "professional photography, warm inviting tones, soft natural glow";
    case "vivido":
      return "professional photography, vivid saturated colors, high contrast, punchy and eye-catching";
    case "luminoso":
      return "professional photography, bright airy premium feel, light clean backgrounds";
    default:
      return "professional photography, natural true-to-life colors, clean composition";
  }
}

// -----------------------------------------------------------------------------
// 1) Generar imagen con IA usando TODA la ficha
// -----------------------------------------------------------------------------
export async function generatePostImage(opts: {
  tenantId: string;
  tema?: string;
  contexto?: string;
  mediaType: "IMAGE" | "STORIES_IMAGE";
  baseUrl?: string;
}): Promise<GenImageResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "no_api_key", detail: "Falta ANTHROPIC_API_KEY." };
  }
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, reason: "no_api_key", detail: "Falta OPENAI_API_KEY (DALL·E)." };
  }

  const ficha = await getFicha(opts.tenantId);
  if (!ficha) {
    return {
      ok: false,
      reason: "no_ficha",
      detail: `No hay ficha para "${opts.tenantId}". Crea la ficha en /admin/ficha-cliente.`,
    };
  }
  const estilo = await getEstilo(opts.tenantId);
  const fichaCtx = fichaToPromptContext(ficha);
  const styleDir = styleDirection(estilo);

  // Paso 1 — Claude (director de arte) construye el prompt de DALL·E con la ficha.
  let dallePrompt: string;
  try {
    const r = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 320,
      system: `Eres director de arte de una agencia. Te dan la FICHA de un negocio real y un tema, y devuelves UN prompt EN INGLÉS para DALL·E 3 que genere la imagen de un post de Instagram para ESE negocio.

REGLAS CRÍTICAS:
- La imagen debe representar EL NEGOCIO Y SU SERVICIO concreto (mira sector y servicios clave de la ficha). Si es una clínica dental, muestra sonrisas, dientes sanos, consulta dental, instrumental limpio; si es estética, tratamientos faciales/corporales, cabina, piel cuidada; etc.
- PROHIBIDO devolver imágenes genéricas o fuera de contexto (paisajes, montañas, objetos al azar) que no tengan que ver con el negocio.
- Refleja al público objetivo y el tono de marca de la ficha.
- Estilo visual a aplicar: ${styleDir}.
- Sin texto, logos ni marcas de agua en la imagen (DALL·E no escribe texto bien).
- Composición cuadrada/limpia, lista para Instagram.

Devuelve SOLO el prompt en inglés, una sola línea, sin comillas ni explicaciones.`,
      messages: [
        {
          role: "user",
          content: `FICHA DEL NEGOCIO:\n${fichaCtx}\n\nTEMA DEL POST: ${opts.tema?.trim() || "(elige un tema realista y relevante para este negocio)"}\n${opts.contexto?.trim() ? `CONTEXTO EXTRA: ${opts.contexto.trim()}` : ""}`,
        },
      ],
    });
    dallePrompt = r.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();
    if (!dallePrompt) {
      return { ok: false, reason: "ai_error", detail: "El director de arte (Haiku) devolvió un prompt vacío." };
    }
  } catch (err) {
    return { ok: false, reason: "ai_error", detail: `Haiku: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Paso 2 — DALL·E 3 genera la imagen.
  const size = opts.mediaType === "STORIES_IMAGE" ? "1024x1792" : "1024x1024";
  let tempUrl: string | undefined;
  try {
    const img = await openai.images.generate({
      model: "dall-e-3",
      prompt: dallePrompt,
      n: 1,
      size,
      quality: "standard",
    });
    tempUrl = img.data?.[0]?.url;
  } catch (err) {
    return { ok: false, reason: "ai_error", detail: `DALL·E: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!tempUrl) {
    return { ok: false, reason: "ai_error", detail: "DALL·E no devolvió URL de imagen." };
  }

  // Paso 3 — descargar los bytes y servirlos desde nuestra URL durable.
  try {
    const resp = await fetch(tempUrl);
    if (!resp.ok) throw new Error(`fetch DALL·E url status ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    const id = await storeImage(buf, "image/png");
    return { ok: true, url: imageUrlFor(id, opts.baseUrl), prompt: dallePrompt };
  } catch (err) {
    return { ok: false, reason: "store_error", detail: `No se pudo guardar la imagen: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// -----------------------------------------------------------------------------
// 2) Aplicar el estilo de la ficha a una foto que pegó el cliente
// -----------------------------------------------------------------------------
export async function styleExistingPhoto(opts: {
  tenantId: string;
  url: string;
  baseUrl?: string;
}): Promise<StylePhotoResult> {
  const estilo = await getEstilo(opts.tenantId);
  try {
    const resp = await fetch(opts.url);
    if (!resp.ok) throw new Error(`fetch foto status ${resp.status}`);
    const baseBuf = Buffer.from(await resp.arrayBuffer());

    // Si la ficha define estilo IA (comic/editorial) → Gemini; si falla, preset.
    let working: Buffer = baseBuf;
    if (estilo.aiStyle) {
      const ai = await transformWithAI(baseBuf, estilo.aiStyle);
      if (ai.ok) working = ai.image;
      else console.warn(`[marta-image-gen] estilo IA falló (${ai.reason}), uso solo preset sharp.`);
    }
    const styled = await applyStyle(working, estilo); // preset + cuadrado
    const id = await storeImage(styled, "image/jpeg");
    return { ok: true, url: imageUrlFor(id, opts.baseUrl) };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
