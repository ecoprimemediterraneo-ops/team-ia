// =============================================================================
// Marta · VÍDEOS para Reels e historias (motion graphics sobre fotos del cliente)
// =============================================================================
//
// NO es vídeo generado por IA (deforma caras): son tres plantillas de Remotion
// (render-video/) con texto animado a ritmo de música propia, sobre fotos REALES
// del banco del cliente. La IA solo escribe los textos cortos.
//
//   oferta        → servicio, precio y fecha límite sobre 2-3 fotos
//   antes_despues → cortinilla entre dos fotos + frase
//   hueco_libre   → hora y servicio LIBRES HOY sacados de la agenda real + botón WhatsApp
//
// Dónde se renderiza: servicio propio (render-video/servidor.mjs). En el VPS
// (contenedor aiteam-render) en producción; en local, http://localhost:3900.
// Vercel no puede: Remotion necesita Chrome + ffmpeg y minutos de CPU; la única
// vía en Vercel es Vercel Sandbox, que se paga por uso.
//
// Frenos (todos fail-closed):
//   · MARTA_VIDEO_ENABLED=true  → sin él no se renderiza nada.
//   · MARTA_VIDEO_MAX_MES (10)  → vídeos por tenant y mes (cuenta los eventos
//     `video_rendered` del event-log, que es también donde queda el coste).
//   · Publicar sigue detrás de MARTA_PUBLISH_ENABLED, como las imágenes.
// =============================================================================

import "server-only";
import { anthropic, MODELS } from "./claude";
import { getMarcaVisual, getTenant, type MarcaVisual, type TipografiaMarca } from "./tenants";
import { getBusinessByTenant, getBusinessBySlug, computeFreeSlots, resolverServicio, empleadosDeServicio, type BusinessBooking, type BookingService } from "./booking";
import { storeImage, imageUrlFor, putPublicBlob } from "./marta-image-store";
import { logEvent, getMonthEvents, monthKey } from "./event-log";
import { generarCaption } from "./marta-caption";
import { listCalendar } from "./marta-calendar";
import { PRECIOS } from "./gestoria-coste";

// ─── Contrato con el render (espejo de render-video/src/tipos.ts) ────────────
export type PlantillaVideo = "oferta" | "antes_despues" | "hueco_libre";
export type FormatoVideo = "reel" | "historia";
export type MarcaVideo = { nombre: string; fondo: string; acento: string; texto: string; tipografia: TipografiaMarca; logoUrl?: string };
export type TextosOferta = { gancho: string; servicio: string; precio: string; precioAntes?: string; hasta: string; cta: string };
export type TextosAntesDespues = { gancho: string; frase: string; servicio: string; cta: string };
export type TextosHueco = { gancho: string; hora: string; dia: string; servicio: string; profesional?: string; cta: string; telefono?: string };
export type PropsVideo = {
  plantilla: PlantillaVideo;
  marca: MarcaVideo;
  fotos: string[];
  formato?: FormatoVideo;
  textos: TextosOferta | TextosAntesDespues | TextosHueco;
};

/** Lo que se guarda en la propuesta / entrada del calendario para poder rehacerlo. */
export type VideoSpec = {
  plantilla: PlantillaVideo;
  formato: FormatoVideo;
  slug?: string;
  servicioId?: string;
  indicaciones?: string;
  precioOferta?: number;
  hasta?: string;
  props: PropsVideo;
};

export const PLANTILLAS_VIDEO: { id: PlantillaVideo; nombre: string; descripcion: string }[] = [
  { id: "oferta", nombre: "Oferta", descripcion: "Servicio, precio y fecha límite a golpe de música sobre 2-3 fotos." },
  { id: "antes_despues", nombre: "Antes y después", descripcion: "Cortinilla que desliza entre dos fotos + una frase." },
  { id: "hueco_libre", nombre: "Hueco libre hoy", descripcion: "La primera hora libre de hoy, sacada de la agenda, con botón de WhatsApp." },
];

// ─── Frenos ─────────────────────────────────────────────────────────────────
export const martaVideoEnabled = (): boolean => (process.env.MARTA_VIDEO_ENABLED || "").toLowerCase() === "true";
export function limiteVideosMes(): number {
  const n = parseInt(process.env.MARTA_VIDEO_MAX_MES || "10", 10);
  return Number.isFinite(n) && n >= 0 ? n : 10;
}
export async function videosDelMes(tenantId: string, ahora = new Date()): Promise<number> {
  return (await getMonthEvents(tenantId, monthKey(ahora.toISOString()))).filter((e) => e.type === "video_rendered").length;
}
/** Vídeos por negocio y DÍA (hora de España). Por defecto 3. */
export function limiteVideosDia(): number {
  const n = parseInt(process.env.MARTA_VIDEO_MAX_DIA || "3", 10);
  return Number.isFinite(n) && n >= 0 ? n : 3;
}
export async function videosDeHoy(tenantId: string, ahora = new Date()): Promise<number> {
  const dia = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const hoy = dia(ahora);
  return (await getMonthEvents(tenantId, monthKey(ahora.toISOString()))).filter((e) => e.type === "video_rendered" && dia(new Date(e.ts)) === hoy).length;
}
/**
 * Tiempo TOTAL que se espera al render, reintentos incluidos. Si se pasa, Marta
 * lo dice en el panel y sigue: nunca se queda colgada esperando (un render normal
 * en el VPS son 60-90 s; la función de Vercel tiene 300).
 */
export const PLAZO_RENDER_MS = 200_000;
const renderUrl = () => (process.env.MARTA_RENDER_URL || "http://localhost:3900").replace(/\/$/, "");

// ─── Coste ──────────────────────────────────────────────────────────────────
/** Caption con Haiku: no devuelve uso, se estima con un post típico (1.500 in / 400 out). */
const CAPTION_ESTIMADO_USD = (1500 * 1 + 400 * 5) / 1e6;
/** Vercel Blob: almacenamiento 0,023 $/GB-mes + transferencia 0,05 $/GB (Meta y WhatsApp lo bajan ~3 veces). */
const blobUSD = (bytes: number) => (bytes / 1e9) * (0.023 + 0.05 * 3);
const usd = (modelo: string, entrada: number, salida: number) => {
  const p = PRECIOS[modelo] || PRECIOS["claude-haiku-4-5"];
  return (entrada * p.entrada + salida * p.salida) / 1e6;
};

// ─── Marca y fotos ──────────────────────────────────────────────────────────
/** ¿El render corre en esta misma máquina? Si no (VPS), no ve nada de localhost. */
const renderEsLocal = () => /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(renderUrl());
const SITIO_PUBLICO = "https://aiteam.marketing";
/**
 * URL absoluta que el RENDER pueda abrir. Con el render en el VPS y la app en
 * local, "http://localhost:3000/img/logo.svg" no existe para él: los ficheros
 * públicos del repo (/img/…) se piden a la web publicada, y lo que solo vive en
 * el almacén local (/api/admin/marta-image/…) se descarta.
 */
function absoluta(u: string | undefined, baseUrl: string): string | undefined {
  if (!u) return undefined;
  let abs: string;
  if (/^https?:\/\//.test(u)) abs = u;
  else if (u.startsWith("/")) abs = `${baseUrl.replace(/\/$/, "")}${u}`;
  else return undefined;
  if (renderEsLocal()) return abs;
  const x = new URL(abs);
  if (!/^(localhost|127\.0\.0\.1)$/.test(x.hostname)) return abs;
  if (x.pathname.startsWith("/api/")) return undefined;
  return `${SITIO_PUBLICO}${x.pathname}${x.search}`;
}
/** Fotos de Unsplash a tamaño vertical; el resto tal cual. */
function aVertical(u: string): string {
  try {
    const url = new URL(u);
    if (url.hostname === "images.unsplash.com") {
      url.searchParams.set("w", "1080"); url.searchParams.set("h", "1920");
      url.searchParams.set("fit", "crop"); url.searchParams.set("q", "80");
      return url.toString();
    }
  } catch { /* no es URL */ }
  return u;
}

/**
 * Marca del vídeo: la identidad visual del tenant, con el logo y los colores
 * PROPIOS del negocio si los tiene (una cuenta puede tener varios negocios —
 * Salón Bella vive en la cuenta de AI-Team y no se viste de AI-Team).
 */
export async function marcaDelVideo(tenantId: string, negocio: BusinessBooking | null, baseUrl: string): Promise<MarcaVideo> {
  const m: MarcaVisual = await getMarcaVisual(tenantId);
  const t = await getTenant(tenantId);
  const propia = negocio?.marca;
  const tipografia = propia?.tipografia || m.tipografia || (m.plantilla === "marcada" ? "impacto" : "elegante");
  return {
    nombre: negocio?.nombre || t?.ficha?.nombreNegocio || t?.name || "",
    fondo: propia?.fondo || m.fondo,
    acento: propia?.acento || m.acento,
    texto: propia?.texto || m.texto,
    tipografia,
    logoUrl: absoluta(negocio?.logoUrl || m.logoUrl, baseUrl),
  };
}

/**
 * Banco de fotos del cliente: portada y galería de su mini-web, fotos de los
 * servicios y las fotos que ha subido a mano al calendario de Marta. Todas son
 * SUYAS: nada de bancos de imágenes genéricos ni generadas por IA.
 */
export async function fotosDelBanco(tenantId: string, negocio: BusinessBooking | null, baseUrl: string): Promise<string[]> {
  const out: string[] = [];
  const vistas = new Set<string>();
  // La misma foto de Unsplash llega con parámetros distintos (portada y galería): se compara sin ellos.
  const clave = (u: string) => { try { const x = new URL(u); return x.hostname === "images.unsplash.com" ? x.origin + x.pathname : u; } catch { return u; } };
  const add = (u?: string) => { const a = absoluta(u, baseUrl); if (!a || vistas.has(clave(a))) return; vistas.add(clave(a)); out.push(aVertical(a)); };
  for (const s of negocio?.servicios || []) if (s.activo) add(s.fotoUrl);
  add(negocio?.heroImageUrl);
  for (const g of negocio?.galeria || []) add(g);
  // Fotos subidas a mano al calendario: solo si la cuenta tiene UN negocio (si
  // tiene varios no se sabe de cuál son) y solo si siguen existiendo.
  try {
    const { listBusinesses } = await import("./booking");
    const suyos = (await listBusinesses()).filter((b) => b.tenantId === tenantId).length;
    if (suyos <= 1) {
      const { getStoredImage } = await import("./marta-image-store");
      for (const e of await listCalendar(tenantId)) {
        if (e.tema !== "Subido a mano" || e.mediaType !== "IMAGE") continue;
        const id = /\/api\/admin\/marta-image\/([\w-]+)/.exec(e.imageUrl)?.[1];
        if (id && !(await getStoredImage(id))) continue;
        add(e.imageUrl);
      }
    }
  } catch { /* sin calendario */ }
  return out;
}

/** Elige `n` fotos del banco, rotando para no repetir siempre las mismas. */
function elegirFotos(banco: string[], n: number, semilla: number): string[] {
  if (!banco.length) return [];
  const off = semilla % banco.length;
  return Array.from({ length: Math.min(n, Math.max(banco.length, 1)) }, (_, i) => banco[(off + i) % banco.length]);
}

// ─── Agenda real: el primer hueco libre de hoy ──────────────────────────────
function redirectDe(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/lucia/callback`;
}
const precioDe = (s: BookingService): number | undefined => s.precioEUR ?? s.variantes?.[0]?.precioEUR;

export async function primerHuecoDeHoy(negocio: BusinessBooking, opts: { servicioId?: string; baseUrl: string; ahora?: Date }): Promise<
  { ok: true; startIso: string; hora: string; servicio: BookingService; profesional?: string } | { ok: false; detail: string }
> {
  const tz = negocio.timezone || "Europe/Madrid";
  const hoy = (opts.ahora ?? new Date()).toLocaleDateString("en-CA", { timeZone: tz });
  const servicios = negocio.servicios.filter((s) => s.activo && (!opts.servicioId || s.id === opts.servicioId));
  if (!servicios.length) return { ok: false, detail: "Ese servicio no existe o no está activo." };
  let mejor: { startIso: string; servicio: BookingService; profesional?: string } | null = null;
  for (const s of servicios.slice(0, opts.servicioId ? 1 : 8)) {
    const sel = resolverServicio(s, {});
    const quienes = empleadosDeServicio(negocio, s.id);
    for (const e of quienes.length ? quienes : [undefined]) {
      const r = await computeFreeSlots(negocio, sel, hoy, redirectDe(opts.baseUrl), undefined, e?.id);
      if (!r.ok || !r.slots.length) continue;
      const primero = r.slots[0];
      if (!mejor || primero < mejor.startIso) mejor = { startIso: primero, servicio: s, profesional: e?.nombre };
    }
  }
  if (!mejor) return { ok: false, detail: "Hoy no queda ningún hueco libre en la agenda. No se hace un vídeo de hueco libre sin hueco." };
  const hhmm = /T(\d{2}:\d{2})/.exec(mejor.startIso)?.[1] || new Date(mejor.startIso).toLocaleTimeString("es-ES", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  return { ok: true, startIso: mejor.startIso, hora: hhmm, servicio: mejor.servicio, profesional: mejor.profesional };
}

// ─── Textos: los escribe Marta (Haiku), el código pone los datos ─────────────
type EntradaTextos = {
  plantilla: PlantillaVideo;
  negocio: string;
  servicio: string;
  indicaciones?: string;
  datos: Record<string, string | undefined>;
};

const PROMPTS: Record<PlantillaVideo, string> = {
  oferta: `Devuelve SOLO JSON: {"gancho": "..."}
- gancho: 2-4 palabras que abran el vídeo a golpe (p. ej. "Solo este mes", "Tu momento"). Sin precio ni cifras.`,
  antes_despues: `Devuelve SOLO JSON: {"gancho": "...", "frase": "...", "servicio": "..."}
- gancho: 2-4 palabras que inviten a mirar el cambio (p. ej. "Mira el cambio").
- frase: 5-9 palabras sobre el RESULTADO, concreta y creíble. Sin promesas médicas ni superlativos vacíos.
- servicio: nombre del servicio + duración si la sabes (p. ej. "Laminado de cejas · 45 min").`,
  hueco_libre: `Devuelve SOLO JSON: {"gancho": "..."}
- gancho: 2-4 palabras que acompañen a "HOY" y digan que queda un hueco (p. ej. "queda un hueco", "te guardo sitio"). En minúscula.`,
};

async function textosConIA(e: EntradaTextos): Promise<{ textos: Record<string, string>; usd: number }> {
  if (!process.env.ANTHROPIC_API_KEY) return { textos: {}, usd: 0 };
  const prompt = `Eres Marta, community manager de ${e.negocio}. Escribes los textos CORTOS de un vídeo vertical de Instagram (texto animado grande).
Castellano de España, tuteo, cero emojis, sin comillas, sin hashtags. Cada texto se lee en menos de un segundo.
Servicio: ${e.servicio}.
${Object.entries(e.datos).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n")}
${e.indicaciones ? `Indicaciones del negocio: ${e.indicaciones}` : ""}
${PROMPTS[e.plantilla]}`;
  try {
    const ai = await anthropic.messages.create({ model: MODELS.fast, max_tokens: 300, messages: [{ role: "user", content: prompt }] });
    const raw = ai.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Record<string, unknown>;
    const textos: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) if (typeof v === "string" && v.trim()) textos[k] = v.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim().slice(0, 80);
    return { textos, usd: usd(String(MODELS.fast), ai.usage?.input_tokens ?? 0, ai.usage?.output_tokens ?? 0) };
  } catch (err) {
    console.warn("[marta-video] textos con IA fallaron, uso los de reserva:", err instanceof Error ? err.message : err);
    return { textos: {}, usd: 0 };
  }
}

/** "688998767" / "+34688998767" → "+34 688 99 87 67". */
export function telefonoLegible(t: string): string {
  const d = t.replace(/\D/g, "");
  const n = d.length === 11 && d.startsWith("34") ? d.slice(2) : d.length === 9 ? d : "";
  if (!n) return t.trim();
  return `+34 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
}
const eur = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")} €`;
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function hastaTexto(fechaIso: string): string {
  const d = new Date(`${fechaIso}T12:00:00Z`);
  return `Hasta el ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}
function finDeMes(ahora = new Date()): string {
  const d = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 0));
  return d.toISOString().slice(0, 10);
}

// ─── Preparar (sin render): props completas y listas ────────────────────────
export type PrepararInput = {
  tenantId: string;
  plantilla: PlantillaVideo;
  formato?: FormatoVideo;
  slug?: string;
  servicioId?: string;
  /** Oferta: precio de oferta (€) y último día (YYYY-MM-DD). */
  precioOferta?: number;
  hasta?: string;
  /** Antes/después o cualquiera: fotos elegidas a mano (URLs del banco). */
  fotos?: string[];
  indicaciones?: string;
  baseUrl: string;
  ahora?: Date;
  /** Cambia qué fotos del banco salen (para "otra foto"). */
  semilla?: number;
};
export type PrepararResult = { ok: true; props: PropsVideo; servicio?: string; usdTextos: number; nota?: string } | { ok: false; detail: string };

export async function prepararVideo(i: PrepararInput): Promise<PrepararResult> {
  const negocio = i.slug ? await getBusinessBySlug(i.slug) : await getBusinessByTenant(i.tenantId);
  if (negocio && negocio.tenantId !== i.tenantId) return { ok: false, detail: "Ese negocio no es de esta cuenta." };
  const marca = await marcaDelVideo(i.tenantId, negocio, i.baseUrl);
  const banco = await fotosDelBanco(i.tenantId, negocio, i.baseUrl);
  const ahora = i.ahora ?? new Date();
  const semilla = i.semilla ?? Math.floor(ahora.getTime() / 3_600_000);
  const cta = "Reserva por WhatsApp";
  const elegidas = (i.fotos || []).filter((u) => /^https?:\/\//.test(u));
  const servicios = (negocio?.servicios || []).filter((s) => s.activo);
  let servicio = servicios.find((s) => s.id === i.servicioId);

  if (i.plantilla === "hueco_libre") {
    if (!negocio) return { ok: false, detail: "Hace falta la agenda del negocio para saber qué hueco queda hoy." };
    const h = await primerHuecoDeHoy(negocio, { servicioId: i.servicioId, baseUrl: i.baseUrl, ahora });
    if (!h.ok) return { ok: false, detail: h.detail };
    servicio = h.servicio;
    const ia = await textosConIA({ plantilla: "hueco_libre", negocio: marca.nombre, servicio: h.servicio.nombre, indicaciones: i.indicaciones, datos: { hora: h.hora } });
    const dNombre = DIAS[new Date(`${h.startIso.slice(0, 10)}T12:00:00Z`).getUTCDay()];
    const fotosH = elegidas.length ? elegidas : elegirFotos([...(servicio.fotoUrl ? [aVertical(absoluta(servicio.fotoUrl, i.baseUrl) || "")] : []), ...banco].filter(Boolean), 2, semilla);
    return {
      ok: true, servicio: h.servicio.nombre, usdTextos: ia.usd,
      props: {
        plantilla: "hueco_libre", marca, fotos: fotosH, formato: i.formato || "reel",
        textos: {
          gancho: ia.textos.gancho || "queda un hueco",
          hora: h.hora,
          dia: `Hoy · ${dNombre} ${Number(h.startIso.slice(8, 10))}`,
          servicio: h.servicio.nombre,
          ...(h.profesional ? { profesional: `con ${h.profesional}` } : {}),
          cta,
          ...(negocio.telefono ? { telefono: telefonoLegible(negocio.telefono) } : {}),
        },
      },
    };
  }

  if (!servicio) servicio = servicios.find((s) => precioDe(s) !== undefined) || servicios[0];
  const nombreServicio = servicio?.nombre || "tu tratamiento";

  if (i.plantilla === "oferta") {
    const normal = servicio ? precioDe(servicio) : undefined;
    const oferta = i.precioOferta && i.precioOferta > 0 ? i.precioOferta : normal;
    if (oferta === undefined) return { ok: false, detail: "Pon el precio de la oferta: el servicio no tiene precio en la agenda." };
    const hasta = hastaTexto(i.hasta && /^\d{4}-\d{2}-\d{2}$/.test(i.hasta) ? i.hasta : finDeMes(ahora));
    const ia = await textosConIA({ plantilla: "oferta", negocio: marca.nombre, servicio: nombreServicio, indicaciones: i.indicaciones, datos: { precio: eur(oferta), hasta } });
    return {
      ok: true, servicio: nombreServicio, usdTextos: ia.usd,
      props: {
        plantilla: "oferta", marca, formato: i.formato || "reel",
        fotos: elegidas.length ? elegidas : elegirFotos(banco, 3, semilla),
        textos: {
          gancho: ia.textos.gancho || "Solo este mes",
          // El nombre del servicio lo pone la agenda, no la IA (se inventaba "Manicura 15 euros").
          servicio: nombreServicio,
          precio: eur(oferta),
          // El precio tachado SOLO si de verdad baja: nunca se inventa un descuento.
          ...(normal !== undefined && oferta < normal ? { precioAntes: eur(normal) } : {}),
          hasta, cta,
        },
      },
    };
  }

  // antes_despues
  const fotosAD = elegidas.length >= 2 ? elegidas.slice(0, 2) : elegirFotos(banco, 2, semilla);
  if (fotosAD.length < 2) return { ok: false, detail: "Para un antes y después hacen falta dos fotos en el banco del negocio." };
  const dur = servicio ? resolverServicio(servicio, {}).durationMin : undefined;
  const ia = await textosConIA({ plantilla: "antes_despues", negocio: marca.nombre, servicio: nombreServicio, indicaciones: i.indicaciones, datos: { duracion: dur ? `${dur} min` : undefined } });
  return {
    ok: true, servicio: nombreServicio, usdTextos: ia.usd,
    nota: elegidas.length >= 2 ? undefined : "Fotos elegidas del banco: revisa que la primera sea el ANTES.",
    props: {
      plantilla: "antes_despues", marca, formato: i.formato || "reel", fotos: fotosAD,
      textos: {
        gancho: ia.textos.gancho || "Mira el cambio",
        frase: ia.textos.frase || `${nombreServicio}, resultado real`,
        servicio: dur ? `${nombreServicio} · ${dur} min` : nombreServicio,
        cta,
      },
    },
  };
}

// ─── Render ─────────────────────────────────────────────────────────────────
export async function renderizar(props: PropsVideo, plazoMs = PLAZO_RENDER_MS): Promise<{ ok: true; bytes: Buffer; renderMs: number; duracionS: number; urlPublica?: string } | { ok: false; detail: string }> {
  const secreto = process.env.MARTA_RENDER_SECRET || "";
  const fin = Date.now() + plazoMs;
  let ultimo = "";
  for (let intento = 1; intento <= 3; intento++) {
    const queda = fin - Date.now();
    if (queda < 1_000) { ultimo = ultimo || `el render ha tardado más de ${Math.round(plazoMs / 1000)} s`; break; }
    try {
      const r = await fetch(`${renderUrl()}/render`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(secreto ? { authorization: `Bearer ${secreto}` } : {}) },
        body: JSON.stringify(props),
        signal: AbortSignal.timeout(queda),
      });
      if (r.ok) {
        return {
          ok: true, bytes: Buffer.from(await r.arrayBuffer()), renderMs: Number(r.headers.get("x-render-ms") || 0),
          duracionS: Number(r.headers.get("x-duracion-s") || 0), urlPublica: r.headers.get("x-video-url") || undefined,
        };
      }
      ultimo = `render ${r.status}: ${(await r.text()).slice(0, 200)}`;
      // 503 = cola llena: se espera y se reintenta. Un 4xx no se arregla reintentando.
      if (r.status !== 503 && r.status < 500) break;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      ultimo = e.name === "TimeoutError" || e.name === "AbortError"
        ? `el render ha tardado más de ${Math.round(plazoMs / 1000)} s`
        : `servicio de render no responde (${renderUrl()}): ${e.message}`;
    }
    if (intento < 3 && fin - Date.now() > 10_000) await new Promise((res) => setTimeout(res, Math.min(5_000 * intento, fin - Date.now() - 5_000)));
  }
  return { ok: false, detail: ultimo };
}

async function guardarMp4(bytes: Buffer, baseUrl: string, urlPublica?: string): Promise<{ url: string; host: "vercel-blob" | "render-vps" | "marta-image-store" }> {
  const blob = await putPublicBlob(bytes, "video/mp4", "marta-video").catch((e) => { console.error("[marta-video] Blob:", e); return null; });
  if (blob) return { url: blob, host: "vercel-blob" };
  // El Blob del proyecto es privado (no da URLs públicas): se usa la copia que
  // guarda el propio servicio de render, servida por HTTPS 45 días.
  if (urlPublica && /^https:\/\//.test(urlPublica)) return { url: urlPublica, host: "render-vps" };
  const id = await storeImage(bytes, "video/mp4");
  return { url: imageUrlFor(id, baseUrl), host: "marta-image-store" };
}

// ─── Todo junto ─────────────────────────────────────────────────────────────
export type GenerarVideoResult =
  | { ok: true; url: string; caption: string; spec: VideoSpec; costeUSD: number; renderMs: number; duracionS: number; nota?: string; usados: number; limite: number }
  | { ok: false; kind: "disabled" | "limite" | "datos" | "render"; detail: string };

export async function generarVideo(i: PrepararInput & { conCaption?: boolean }): Promise<GenerarVideoResult> {
  if (!martaVideoEnabled()) return { ok: false, kind: "disabled", detail: "Los vídeos de Marta están apagados (MARTA_VIDEO_ENABLED)." };
  const limite = limiteVideosMes();
  const usados = await videosDelMes(i.tenantId, i.ahora);
  if (usados >= limite) return { ok: false, kind: "limite", detail: `Ya se han hecho ${usados} vídeos este mes (límite ${limite}).` };
  const limiteDia = limiteVideosDia();
  const hoy = await videosDeHoy(i.tenantId, i.ahora);
  if (hoy >= limiteDia) return { ok: false, kind: "limite", detail: `Ya se han hecho ${hoy} vídeos hoy (límite ${limiteDia} al día). Mañana puedes hacer más.` };

  const prep = await prepararVideo(i);
  if (!prep.ok) return { ok: false, kind: "datos", detail: prep.detail };
  const r = await renderizar(prep.props);
  if (!r.ok) return { ok: false, kind: "render", detail: r.detail };
  const mp4 = await guardarMp4(r.bytes, i.baseUrl, r.urlPublica);

  let caption = "";
  let usdCaption = 0;
  if (i.conCaption !== false) {
    const t = prep.props.textos as Record<string, string>;
    const cap = await generarCaption({
      tenantId: i.tenantId,
      tema: `${PLANTILLAS_VIDEO.find((p) => p.id === i.plantilla)?.nombre}: ${prep.servicio || ""}`,
      contexto: [Object.values(t).join(" · "), "Es un Reel: el texto del vídeo ya dice lo esencial; el caption lo remata y termina con cómo reservar.", i.indicaciones].filter(Boolean).join("\n"),
    });
    if (cap.ok) { caption = cap.caption; usdCaption = CAPTION_ESTIMADO_USD; }
    else caption = Object.values(t).filter(Boolean).join(" · ");
  }
  const desglose = { textosUSD: prep.usdTextos, captionUSD_estimado: usdCaption, renderUSD: 0, blobUSD: blobUSD(r.bytes.length) };
  const costeUSD = Object.values(desglose).reduce((a, b) => a + b, 0);
  const spec: VideoSpec = { plantilla: i.plantilla, formato: i.formato || "reel", slug: i.slug, servicioId: i.servicioId, indicaciones: i.indicaciones, precioOferta: i.precioOferta, hasta: i.hasta, props: prep.props };
  try {
    await logEvent(i.tenantId, {
      type: "video_rendered",
      channel: "marta",
      meta: { plantilla: i.plantilla, formato: spec.formato, url: mp4.url, host: mp4.host, renderMs: r.renderMs, duracionS: r.duracionS, bytes: r.bytes.length, costeUSD: Number(costeUSD.toFixed(6)), desglose, render: renderUrl().includes("localhost") ? "local" : "vps" },
    });
  } catch (err) {
    // FAIL-CLOSED: el registro ES el contador del límite. Un vídeo que no se
    // apunta no cuenta, y así se saltaba el límite en silencio (pasó en local el
    // 30/09/2026 con data/events.json roto: 7 vídeos, 0 apuntados).
    console.error("[marta-video] no se pudo registrar video_rendered:", err);
    return { ok: false, kind: "render", detail: "El vídeo se ha hecho pero no se ha podido apuntar en el registro (que es el que cuenta el límite del mes), así que no se entrega. Revisa el registro de eventos." };
  }
  return { ok: true, url: mp4.url, caption, spec, costeUSD, renderMs: r.renderMs, duracionS: r.duracionS, nota: prep.nota, usados: usados + 1, limite };
}

/**
 * Rehacer un vídeo con lo que pide el cliente ("otra foto", "pon 15 €"…):
 * mismas opciones + sus indicaciones, fotos rotadas. Cuenta para el límite.
 */
export async function rehacerVideo(spec: VideoSpec, o: { tenantId: string; feedback?: string; baseUrl: string }): Promise<GenerarVideoResult> {
  return generarVideo({
    tenantId: o.tenantId, plantilla: spec.plantilla, formato: spec.formato, slug: spec.slug, servicioId: spec.servicioId,
    precioOferta: spec.precioOferta, hasta: spec.hasta,
    indicaciones: [spec.indicaciones, o.feedback].filter(Boolean).join(". "),
    baseUrl: o.baseUrl, semilla: Math.floor(Date.now() / 1000),
  });
}

export const mediaTypeDe = (f: FormatoVideo) => (f === "historia" ? ("STORIES_VIDEO" as const) : ("REELS" as const));
