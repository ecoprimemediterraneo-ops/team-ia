// Motor de estilo visual para las fotos de Marta.
// Aplica un preset de color tipo Lightroom/VSCO, redimensiona a 1080x1080
// y opcionalmente compone un logo.
//
// PENDIENTE: conectar StyleConfig con la ficha del tenant (src/lib/tenants.ts)
// cuando la otra sesión termine. De momento se guarda en src/lib/style-config-temp.ts.

import "server-only";
import sharp from "sharp";
import type { StyleConfig, StylePreset } from "./image-style-presets";

export { STYLE_PRESETS, AI_STYLES } from "./image-style-presets";
export type { StyleConfig, StylePreset, AIStyle } from "./image-style-presets";

const SIZE = 1080;

async function fetchBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

function applyPreset(pipeline: sharp.Sharp, preset: StylePreset): sharp.Sharp {
  switch (preset) {
    case "natural":
      return pipeline;
    case "calido":
      // Tonos cálidos + brillo suave: ideal para estética/clínicas.
      return pipeline
        .modulate({ brightness: 1.06, saturation: 1.1 })
        .tint({ r: 255, g: 228, b: 200 })
        .linear(1.02, -5);
    case "vivido":
      // Saturación + contraste altos, colores que entran por los ojos.
      return pipeline
        .modulate({ saturation: 1.45, brightness: 1.02 })
        .linear(1.15, -12)
        .gamma(1.05);
    case "luminoso":
      // Alto brillo, aireado, fondos claros, look premium.
      // Subimos brillo, reducimos saturación, levantamos las sombras con offset+.
      return pipeline
        .modulate({ brightness: 1.18, saturation: 0.9 })
        .linear(0.95, 22);
    default:
      return pipeline;
  }
}

export async function applyStyle(
  imageBuffer: Buffer,
  styleConfig: StyleConfig,
): Promise<Buffer> {
  let pipeline = sharp(imageBuffer).resize(SIZE, SIZE, {
    fit: "cover",
    position: "centre",
  });

  pipeline = applyPreset(pipeline, styleConfig.preset);

  let base = await pipeline.jpeg({ quality: 90 }).toBuffer();

  if (styleConfig.logoUrl) {
    try {
      const logoBuf = await fetchBuffer(styleConfig.logoUrl);
      const logoW = Math.round(SIZE * 0.15);
      const logo = await sharp(logoBuf)
        .resize(logoW, logoW, { fit: "inside" })
        .ensureAlpha()
        .composite([
          {
            input: Buffer.from([255, 255, 255, Math.round(0.8 * 255)]),
            raw: { width: 1, height: 1, channels: 4 },
            tile: true,
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer();

      base = await sharp(base)
        .composite([{ input: logo, gravity: "southeast" }])
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch {
      // si el logo falla, devolvemos la imagen sin logo
    }
  }

  return base;
}

// Asegura 1080x1080 cuadrado.
export async function ensureSquare(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .resize(SIZE, SIZE, { fit: "cover", position: "centre" })
    .jpeg({ quality: 90 })
    .toBuffer();
}
