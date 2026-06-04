// Modo arranque de Marta — genera de golpe la base de un perfil de
// Instagram para que parezca real desde el día 1:
//
//   1. BIO de Instagram (4 líneas) basada en la ficha.
//   2. N posts coherentes (caption + imagen estilada con el StyleConfig
//      del tenant).
//
// Reutiliza generarCaption (B3) y el motor de imagen (applyStyle +
// transformWithAI). Las imágenes generadas viven en el image-store en
// memoria; se sirven vía /api/admin/marta-image/[id].

import "server-only";
import { anthropic, MODELS } from "./claude";
import { fichaToPromptContext, getFicha, getEstilo, type Ficha } from "./ficha";
import { generarCaption } from "./marta-caption";
import { applyStyle } from "./image-style";
import { transformWithAI } from "./image-style-ai";
import { imageUrlFor, storeImage } from "./marta-image-store";
import type { StyleConfig } from "./image-style-presets";

const BIO_MAX = 150; // Instagram limita a 150 caracteres por línea visual.

export type BioResult =
  | { ok: true; bio: string; lineas: string[] }
  | { ok: false; reason: "no_ficha" | "no_api_key" | "api_error"; detail: string };

export type SeedDraft = {
  id: string;
  tema: string;
  caption: string;
  imageId: string;
  imageUrl: string;
  styleApplied: StyleConfig;
  aiUsed: boolean;
};

export type ArranqueResult =
  | { ok: true; bio: BioResult; drafts: SeedDraft[]; errors: string[] }
  | { ok: false; reason: "no_ficha" | "no_api_key"; detail: string };

// -----------------------------------------------------------------------------
// BIO
// -----------------------------------------------------------------------------

const BIO_SYSTEM = `Eres copywriter de bios de Instagram para negocios locales. Escribes EN PRIMERA PERSONA DEL PLURAL del negocio (somos, ofrecemos, te esperamos). NO eres una agencia, no eres una IA. Tu salida es la bio definitiva, lista para pegar en Instagram.

REGLAS:
- 4 líneas exactas, separadas por saltos de línea (\\n).
- Línea 1: qué somos (sector + propuesta corta, máx 5-7 palabras).
- Línea 2: ciudad y/o zona donde operamos.
- Línea 3: gancho de marca (rasgo diferencial concreto, NO genérico).
- Línea 4: CTA simple — "Reserva por DM 📩" o equivalente del sector.
- Español de España, tuteo. Cada línea ≤ 40 caracteres si puedes.
- Emojis con cuentagotas (máximo 2 en TODA la bio, solo si encajan).
- Sin asteriscos, sin markdown, sin hashtags, sin URLs.
- Coherente con el tono de marca de la ficha.

Devuelve EXCLUSIVAMENTE las 4 líneas, sin etiquetas, sin comillas, sin meta-comentarios.`;

export async function generateBio(tenantId: string): Promise<BioResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "no_api_key", detail: "Falta ANTHROPIC_API_KEY." };
  }
  const ficha = await getFicha(tenantId);
  if (!ficha) {
    return {
      ok: false,
      reason: "no_ficha",
      detail: `No hay ficha para el tenant "${tenantId}". Crea la ficha en /admin/ficha-cliente.`,
    };
  }

  try {
    const ai = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 300,
      system: BIO_SYSTEM,
      messages: [
        {
          role: "user",
          content: `FICHA DEL NEGOCIO:\n${fichaToPromptContext(ficha)}\n\nEscribe nuestra bio de Instagram.`,
        },
      ],
    });
    const raw = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();
    const lineas = raw
      .split(/\r?\n/)
      .map((l) => l.replace(/^["'`]+|["'`]+$/g, "").trim())
      .filter((l) => l.length > 0)
      .slice(0, 4);
    const bio = lineas.join("\n");
    if (!bio) {
      return { ok: false, reason: "api_error", detail: "Bio vacía." };
    }
    return { ok: true, bio: bio.slice(0, BIO_MAX * 4), lineas };
  } catch (err) {
    return {
      ok: false,
      reason: "api_error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

// -----------------------------------------------------------------------------
// Ideas de posts (para diversidad)
// -----------------------------------------------------------------------------

const TEMAS_BASE: { categoria: string; ejemplos: string[] }[] = [
  { categoria: "servicio", ejemplos: ["servicio estrella", "tratamiento popular", "novedad de este mes"] },
  { categoria: "consejo", ejemplos: ["consejo útil para clientes", "tip de mantenimiento"] },
  { categoria: "valores", ejemplos: ["por qué nos eligen", "nuestro enfoque diferente"] },
  { categoria: "agenda", ejemplos: ["recordatorio de cita", "horario y disponibilidad"] },
  { categoria: "antes_despues", ejemplos: ["resultado real de un cliente", "transformación"] },
  { categoria: "equipo", ejemplos: ["el equipo detrás", "experiencia del equipo"] },
  { categoria: "promo", ejemplos: ["promo vigente del mes", "primera consulta gratis"] },
  { categoria: "valor_anadido", ejemplos: ["preguntas frecuentes resueltas", "qué incluye realmente"] },
  { categoria: "estilo_vida", ejemplos: ["el momento del día perfecto para venir", "ritual del cliente"] },
];

function pickTemas(ficha: Ficha, n: number): { tema: string; categoria: string }[] {
  // Mezclamos categorías base + servicios y promos de la ficha.
  const pool: { tema: string; categoria: string }[] = [];
  for (const c of TEMAS_BASE) {
    for (const ej of c.ejemplos) pool.push({ tema: ej, categoria: c.categoria });
  }
  for (const s of ficha.serviciosClave) pool.push({ tema: `nuestro servicio: ${s}`, categoria: "servicio" });
  for (const p of ficha.promosActuales ?? []) pool.push({ tema: `promo activa: ${p}`, categoria: "promo" });

  // Mezcla determinística (sin Math.random para no romper SSR caching).
  const seed = n + ficha.nombreNegocio.length;
  const result: { tema: string; categoria: string }[] = [];
  for (let i = 0; i < n; i++) {
    const idx = (i * 31 + seed) % pool.length;
    result.push(pool[idx]);
  }
  return result;
}

// -----------------------------------------------------------------------------
// Generación de imágenes (stock + estilo del cliente)
// -----------------------------------------------------------------------------

async function fetchSeedImage(seed: string): Promise<Buffer> {
  // Picsum stock — sustituible por Unsplash u otro con env.
  const baseProvider = process.env.SEED_IMAGE_PROVIDER || "https://picsum.photos/seed";
  const url = `${baseProvider}/${encodeURIComponent(seed)}/1200/1200.jpg`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`seed image ${url} -> ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function styleImageForTenant(
  baseBuf: Buffer,
  estilo: StyleConfig,
): Promise<{ bytes: Buffer; aiUsed: boolean; aiError?: string }> {
  let working = baseBuf;
  let aiUsed = false;
  let aiError: string | undefined;
  if (estilo.aiStyle) {
    const ai = await transformWithAI(baseBuf, estilo.aiStyle);
    if (ai.ok) {
      working = ai.image;
      aiUsed = true;
    } else {
      aiError = `${ai.reason}: ${ai.detail}`;
    }
  }
  const styled = await applyStyle(working, estilo);
  return { bytes: styled, aiUsed, aiError };
}

// -----------------------------------------------------------------------------
// Orquestador
// -----------------------------------------------------------------------------

/**
 * Genera la BIO + n drafts (default 6). Cada draft = caption (B3) + imagen
 * estilada con el StyleConfig del tenant. Devuelve los drafts ya con URL
 * pública (servida desde /api/admin/marta-image/[id]).
 */
export async function generateArranque(
  tenantId: string,
  count = 6,
  opts?: { baseUrl?: string },
): Promise<ArranqueResult> {
  const ficha = await getFicha(tenantId);
  if (!ficha) {
    return { ok: false, reason: "no_ficha", detail: `No hay ficha para tenant ${tenantId}.` };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "no_api_key", detail: "Falta ANTHROPIC_API_KEY." };
  }

  const n = Math.min(Math.max(count, 1), 12);
  const estilo = await getEstilo(tenantId);

  const bio = await generateBio(tenantId);
  const temas = pickTemas(ficha, n);
  const drafts: SeedDraft[] = [];
  const errors: string[] = [];

  for (let i = 0; i < temas.length; i++) {
    const t = temas[i];
    try {
      // Caption
      const capResult = await generarCaption({ tenantId, tema: t.tema });
      if (!("ok" in capResult) || !capResult.ok) {
        const det = "ok" in capResult ? "" : (capResult as { detail?: string }).detail;
        errors.push(`Caption "${t.tema}": ${det || "fallo desconocido"}`);
        continue;
      }
      // Imagen
      const seed = `${tenantId}_${t.categoria}_${i}`;
      const baseBuf = await fetchSeedImage(seed);
      const styled = await styleImageForTenant(baseBuf, estilo);
      if (styled.aiError) errors.push(`Imagen IA "${t.tema}": ${styled.aiError} (se usa solo preset sharp)`);
      const imageId = storeImage(styled.bytes, "image/jpeg");
      drafts.push({
        id: `draft_${Date.now()}_${i}`,
        tema: t.tema,
        caption: capResult.caption,
        imageId,
        imageUrl: imageUrlFor(imageId, opts?.baseUrl),
        styleApplied: estilo,
        aiUsed: styled.aiUsed,
      });
    } catch (err) {
      errors.push(`Draft "${t.tema}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { ok: true, bio, drafts, errors };
}
