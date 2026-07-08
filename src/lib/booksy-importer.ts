// =============================================================================
// Importador Booksy → AI-Team.
//
// 1) Descarga la página de Booksy con cabeceras de navegador.
// 2) Booksy renderiza con JS: extraemos los datos del JSON embebido
//    (__NEXT_DATA__ / JSON-LD / estado inicial). Si no hubiera JSON usable,
//    hay un fallback a Playwright headless PREPARADO (opt-in por env), pero la
//    ruta principal es el JSON — no requiere navegador.
// 3) Pasamos el material crudo a Sonnet pidiendo SOLO JSON con el esquema EXACTO
//    de AI-Team (mismo con el que se guardó Bendito Arte).
// 4) Mapeamos categorías/servicios a las familias por defecto (booking-categorias).
//
// Devuelve un SalonDraft = BusinessBooking a medio construir, listo para que el
// dueño lo revise/corrija en pantalla ANTES de crear el salón.
// =============================================================================

import crypto from "node:crypto";
import { anthropic, MODELS } from "./claude";
import { CATEGORIAS_FAMILIA } from "./booking-categorias";
import type { Categoria, BookingService, Horario, DayHours } from "./booking";

// El importador usa el modelo "strong" del repo (Sonnet). Se cambia en un solo
// sitio (MODELS.strong en claude.ts) si se sube de versión.
const IMPORT_MODEL = MODELS.strong;

export type SalonDraft = {
  nombre: string;
  descripcion?: string;
  direccion?: string;
  telefono?: string;
  instagram?: string; // handle sin @
  categorias: Categoria[];
  servicios: BookingService[];
  horario: Horario;
  /** Aviso para el dueño si algo salió a medias (p. ej. no se pudo leer el horario). */
  avisos: string[];
};

// -----------------------------------------------------------------------------
// 1-2) Descarga + extracción del JSON embebido
// -----------------------------------------------------------------------------

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Upgrade-Insecure-Requests": "1",
};

export function esUrlBooksy(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)booksy\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

type Extraccion = { material: string; fuente: "json" | "html" | "playwright" };

/** Descarga la página y extrae el material más rico posible (JSON embebido → texto). */
export async function fetchBooksyMaterial(url: string): Promise<{ ok: true; data: Extraccion } | { ok: false; error: string }> {
  let html = "";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(url, { headers: BROWSER_HEADERS, signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    if (!r.ok) return { ok: false, error: `Booksy respondió ${r.status}. Revisa que la URL sea la de la ficha pública del negocio.` };
    html = await r.text();
  } catch (e) {
    return { ok: false, error: `No se pudo descargar la página: ${e instanceof Error ? e.message : String(e)}` };
  }

  const blobs = extraerJsonEmbebido(html);
  if (blobs.length) {
    // Recorta cada blob y concatena hasta un tope razonable de tokens.
    const material = blobs.join("\n\n---\n\n").slice(0, 120_000);
    return { ok: true, data: { material, fuente: "json" } };
  }

  // Sin JSON usable en el fetch simple. Intento Playwright si está habilitado.
  if (process.env.BOOKSY_USE_PLAYWRIGHT === "1") {
    const pw = await fetchConPlaywright(url).catch(() => null);
    if (pw) return { ok: true, data: { material: pw.slice(0, 120_000), fuente: "playwright" } };
  }

  // Último recurso: texto visible del HTML (por si Booksy sirvió SSR parcial).
  const texto = htmlATexto(html).slice(0, 60_000);
  if (texto.trim().length > 200) return { ok: true, data: { material: texto, fuente: "html" } };
  return { ok: false, error: "La página no traía datos legibles (Booksy los carga con JavaScript). Activa el fallback Playwright (BOOKSY_USE_PLAYWRIGHT=1) o pega los datos a mano." };
}

/** Extrae los blobs JSON relevantes del HTML: __NEXT_DATA__, JSON-LD, y estados window.__*. */
function extraerJsonEmbebido(html: string): string[] {
  const out: string[] = [];

  // __NEXT_DATA__ (Next.js) — el más rico en Booksy.
  const nextMatch = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextMatch?.[1]) out.push(recortarJson(nextMatch[1]));

  // JSON-LD (schema.org LocalBusiness / Service) — direccion, telefono, geo, horario.
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = ldRe.exec(html))) if (m[1]) out.push(m[1].trim());

  // Estados de app: window.__APP_STATE__ / __INITIAL_STATE__ / __PRELOADED_STATE__ = {...};
  const stateRe = /window\.__[A-Z_]+__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/g;
  while ((m = stateRe.exec(html))) if (m[1]) out.push(recortarJson(m[1]));

  return out.filter((s) => s && s.length > 40);
}

/** Si un blob JSON es enorme, intenta quedarse con las ramas útiles (business/services). */
function recortarJson(raw: string): string {
  const s = raw.trim();
  if (s.length <= 120_000) return s;
  // Demasiado grande: nos quedamos con las secciones que mencionan servicios/negocio.
  const keys = ["service", "servic", "business", "categor", "location", "address", "phone", "instagram", "hours", "opening"];
  const lines = s.split(/(?<=[},])/);
  const keep = lines.filter((l) => keys.some((k) => l.toLowerCase().includes(k)));
  const joined = keep.join("");
  return (joined.length > 400 ? joined : s).slice(0, 120_000);
}

/** HTML → texto plano (fallback). Quita scripts/estilos y colapsa espacios. */
function htmlATexto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fallback Playwright headless — PREPARADO pero opt-in. No se importa estáticamente
 * (playwright puede no estar instalado). Solo se usa si BOOKSY_USE_PLAYWRIGHT=1 y el
 * paquete está disponible. La ruta principal (JSON embebido) no lo necesita.
 */
async function fetchConPlaywright(url: string): Promise<string | null> {
  try {
    // import dinámico: si no está instalado, caemos a null sin romper el build.
    const pw = (await import(/* webpackIgnore: true */ "playwright" as string).catch(() => null)) as
      | { chromium: { launch: (o?: unknown) => Promise<{ newPage: () => Promise<{ goto: (u: string, o?: unknown) => Promise<unknown>; content: () => Promise<string> }>; close: () => Promise<void> }> } }
      | null;
    if (!pw?.chromium) return null;
    const browser = await pw.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      const html = await page.content();
      const blobs = extraerJsonEmbebido(html);
      return blobs.length ? blobs.join("\n\n---\n\n") : htmlATexto(html);
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// 3) Extracción estructurada con Sonnet
// -----------------------------------------------------------------------------

type SonnetSalon = {
  nombre?: string;
  descripcion?: string;
  direccion?: string;
  telefono?: string;
  instagram?: string;
  categorias?: string[];
  servicios?: Array<{ nombre?: string; categoria?: string; precio?: number; duracion_min?: number; descripcion?: string }>;
  horario?: Record<string, { abierto?: boolean; franjas?: Array<{ desde?: string; hasta?: string }> }>;
};

const SYSTEM_IMPORT = `Eres un extractor de datos de fichas de negocios de Booksy para AI-Team.
Recibes material crudo (JSON embebido o texto) de la ficha pública de un salón de estética/belleza y devuelves SOLO un objeto JSON válido, sin explicaciones ni markdown, con ESTE esquema EXACTO:

{
  "nombre": string,                 // nombre comercial del salón
  "descripcion": string,            // 1-2 frases (opcional, "" si no hay)
  "direccion": string,              // dirección postal completa ("" si no hay)
  "telefono": string,               // teléfono ("" si no hay)
  "instagram": string,              // handle SIN @ ("" si no hay)
  "categorias": string[],           // los nombres de categoría TAL CUAL aparecen en Booksy (p. ej. "CORTES", "COMBOS", "OTROS"). NO los traduzcas ni los agrupes en familias.
  "servicios": [
    {
      "nombre": string,
      "categoria": string,          // el nombre EXACTO de la categoría de Booksy a la que pertenece (uno de "categorias")
      "precio": number,             // EUR, número (0 si "a consultar")
      "duracion_min": number,       // minutos (estima 30 si no consta)
      "descripcion": string         // "" si no hay
    }
  ],
  "horario": {                      // claves "0"=domingo … "6"=sábado
    "1": { "abierto": true, "franjas": [ { "desde": "09:00", "hasta": "14:00" }, { "desde": "16:00", "hasta": "20:00" } ] },
    "0": { "abierto": false, "franjas": [] }
  }
}

REGLAS:
- Español de España. NO inventes datos: si un campo no aparece, usa "" (texto) o omítelo.
- CATEGORÍAS: conserva los nombres LITERALES que usa el salón en Booksy (CORTES, COMBOS, OTROS, PACKS…). Respeta mayúsculas/minúsculas tal como aparecen. NO los normalices a familias genéricas ni los agrupes.
- Precios y duraciones SIEMPRE numéricos (sin "€" ni "min").
- Extrae TODOS los servicios que encuentres, con su precio y duración reales, y asígnale su categoría literal de Booksy.
- Las horas en formato "HH:MM" 24h. Si no hay horario, devuelve "horario": {}.
- Devuelve ÚNICAMENTE el JSON. Nada más.`;

/** Llama a Sonnet y parsea el JSON. */
async function extraerConSonnet(material: string, url: string): Promise<SonnetSalon> {
  const msg = await anthropic.messages.create({
    model: IMPORT_MODEL,
    max_tokens: 8000,
    temperature: 0, // extracción determinista → mismas categorías/servicios entre runs
    system: SYSTEM_IMPORT,
    messages: [
      {
        role: "user",
        content: `URL de origen: ${url}\n\nMATERIAL CRUDO DE LA FICHA DE BOOKSY:\n\n${material}\n\nDevuelve el JSON del salón con el esquema indicado.`,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  const jsonStr = recortarABloqueJson(text);
  try {
    return JSON.parse(jsonStr) as SonnetSalon;
  } catch {
    throw new Error("El modelo no devolvió un JSON válido. Reintenta o crea el salón a mano.");
  }
}

/** Aísla el objeto JSON de la respuesta (por si viniera con texto o fences). */
function recortarABloqueJson(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  return first >= 0 && last > first ? t.slice(first, last + 1) : t;
}

// -----------------------------------------------------------------------------
// 4) Mapear salida de Sonnet → SalonDraft (categorías a familias por defecto)
// -----------------------------------------------------------------------------

function nuevoId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(4).toString("hex")}`;
}

function normHorario(h: SonnetSalon["horario"]): { horario: Horario; ok: boolean } {
  const out: Horario = {};
  let algo = false;
  for (let d = 0; d <= 6; d++) {
    const src = h?.[String(d)];
    if (src && (src.abierto || (src.franjas && src.franjas.length))) {
      const franjas = (src.franjas || [])
        .filter((f) => /^\d{2}:\d{2}$/.test(f.desde || "") && /^\d{2}:\d{2}$/.test(f.hasta || ""))
        .map((f) => ({ desde: f.desde!, hasta: f.hasta! }));
      out[d] = { abierto: !!src.abierto && franjas.length > 0, franjas } as DayHours;
      if (out[d].abierto) algo = true;
    } else {
      out[d] = { abierto: false, franjas: [] };
    }
  }
  return { horario: out, ok: algo };
}

/** Horario por defecto (L-V partido, sábado mañana) cuando Booksy no lo trae. */
function horarioPorDefecto(): Horario {
  const laborable: DayHours = { abierto: true, franjas: [{ desde: "09:00", hasta: "14:00" }, { desde: "16:00", hasta: "20:00" }] };
  const sabado: DayHours = { abierto: true, franjas: [{ desde: "10:00", hasta: "14:00" }] };
  const cerrado: DayHours = { abierto: false, franjas: [] };
  return { 0: cerrado, 1: laborable, 2: laborable, 3: laborable, 4: laborable, 5: laborable, 6: sabado };
}

/**
 * Normaliza el nombre/marca de glifos Unicode estilizados (𝐁𝐀𝐑𝐁𝐄𝐑…, script,
 * fraktur, fullwidth…) a ASCII limpio. NFKC descompone los "Mathematical
 * Alphanumeric Symbols" a Latin básico y CONSERVA los acentos legítimos
 * (Estética, Málaga). Solo se aplica al nombre, no a descripciones de servicios.
 */
function limpiarNombreMarca(s: string): string {
  return (s || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function limpiarInstagram(ig?: string): string | undefined {
  if (!ig) return undefined;
  let h = ig.trim();
  const m = h.match(/instagram\.com\/([^/?#]+)/i);
  if (m) h = m[1];
  h = h.replace(/^@/, "").trim();
  return h || undefined;
}

/** Convierte la salida cruda de Sonnet en el borrador editable del salón. */
export function mapearASalonDraft(raw: SonnetSalon): SalonDraft {
  const avisos: string[] = [];

  // Categorías: se conservan LITERALES tal como aparecen en Booksy (no se fuerza el
  // mapeo a familias). Cada nombre distinto = una categoría propia con id nuevo. Las
  // familias por defecto siguen disponibles como opción editable en la revisión.
  const catByNombre = new Map<string, Categoria>(); // clave normalizada → categoría final
  const catId = (nombre: string): Categoria => {
    const key = nombre.trim().toLowerCase();
    const found = catByNombre.get(key);
    if (found) return found;
    const cat: Categoria = { id: nuevoId("cat"), nombre: nombre.trim() || "Otros" };
    catByNombre.set(key, cat);
    return cat;
  };

  for (const c of raw.categorias || []) if (c?.trim()) catId(c);

  // Servicios: cada uno con id nuevo y categoriaId por su categoría literal de Booksy.
  // Si un servicio no trae categoría, va a "Otros" (sin forzar familia).
  const servicios: BookingService[] = [];
  for (const s of raw.servicios || []) {
    const nombre = (s?.nombre || "").trim();
    if (!nombre) continue;
    const cat = catId(s.categoria?.trim() || "Otros");
    const durationMin = Number.isFinite(s.duracion_min) && (s.duracion_min || 0) >= 5 ? Math.round(s.duracion_min!) : 30;
    const precioEUR = Number.isFinite(s.precio) && (s.precio || 0) >= 0 ? Number(s.precio) : undefined;
    servicios.push({
      id: nuevoId("svc"),
      nombre,
      descripcion: s.descripcion?.trim() || undefined,
      categoriaId: cat.id,
      durationMin,
      precioEUR,
      activo: true,
    });
  }

  if (servicios.length === 0) avisos.push("No se detectaron servicios: añádelos a mano abajo.");

  // Horario
  const { horario, ok } = normHorario(raw.horario);
  const horarioFinal = ok ? horario : horarioPorDefecto();
  if (!ok) avisos.push("No se pudo leer el horario en Booksy: usamos uno estándar (edítalo).");

  const categorias = [...catByNombre.values()];
  // Si no salió ninguna categoría pero sí servicios, al menos una "General".
  if (categorias.length === 0 && servicios.length) categorias.push({ id: "cat_general", nombre: "General" });

  return {
    nombre: limpiarNombreMarca(raw.nombre || "") || "Salón importado",
    descripcion: raw.descripcion?.trim() || undefined,
    direccion: raw.direccion?.trim() || undefined,
    telefono: raw.telefono?.trim() || undefined,
    instagram: limpiarInstagram(raw.instagram),
    categorias,
    servicios,
    horario: horarioFinal,
    avisos,
  };
}

// -----------------------------------------------------------------------------
// Orquestación pública
// -----------------------------------------------------------------------------

export type ImportarResult =
  | { ok: true; draft: SalonDraft; fuente: Extraccion["fuente"] }
  | { ok: false; error: string };

/** Flujo completo: URL de Booksy → borrador de salón revisable. */
export async function importarDesdeBooksy(url: string): Promise<ImportarResult> {
  if (!esUrlBooksy(url)) return { ok: false, error: "La URL no parece de Booksy (booksy.com). Pega el enlace de la ficha pública del salón." };
  const fetched = await fetchBooksyMaterial(url);
  if (!fetched.ok) return { ok: false, error: fetched.error };
  let raw: SonnetSalon;
  try {
    raw = await extraerConSonnet(fetched.data.material, url);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fallo al extraer los datos." };
  }
  const draft = mapearASalonDraft(raw);
  return { ok: true, draft, fuente: fetched.data.fuente };
}

/** Familias por defecto para el selector del alta (sin keywords). */
export function familiasParaAlta(): Categoria[] {
  return CATEGORIAS_FAMILIA.map((f) => ({ id: f.id, nombre: f.nombre }));
}
