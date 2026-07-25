// =============================================================================
// Marta Nivel 3 — orquestador del MES completo.
// =============================================================================
//
// Una sola llamada genera el calendario del mes entero: para cada hueco
// planificado crea imagen + caption (con hashtags) y lo deja PROGRAMADO en el
// store que Marta ya usa (marta-calendar, status "scheduled"), de modo que el
// bucle existente que consume dueNow() lo recoja a su hora. Aquí NO se publica
// nada: publicar es responsabilidad del flujo existente (marta-publish-flow).
//
// Qué reutiliza (nada de esto se reimplementa):
//   · generarCaption()  (marta-caption)      → texto + línea de hashtags
//   · MARTA_TOPICS      (marta-topics)       → rotación de temas
//   · /api/og/post                           → imagen con los tokens de marca
//   · storeImage/imageUrlFor (marta-image-store) → URL durable que ya usa el publish
//   · scheduleAtDates() (marta-calendar)     → mismo store y mismo status
//   · getSchedule()     (marta-schedule)     → hora local de la regla existente
//
// Interruptor: MARTA_AUTO_ENABLED (default false). Mientras esté apagado, la
// generación automática NO persiste nada (mismo patrón que la waitlist).

import "server-only";
import { generarCaption } from "./marta-caption";
import { MARTA_TOPICS, type MartaTopic } from "./marta-topics";
import { storeImageDurable } from "./marta-image-store";
import { scheduleAtDates } from "./marta-calendar";
import { DEFAULT_TENANT_ID, getPautaPublicacion, PAUTA_DEFECTO, getMarcaVisual, MARCA_DEFECTO, getTenant, type PautaDia, type MarcaVisual } from "./tenants";
import type { PostMes } from "./marta-mes-types";

export type { PostMes } from "./marta-mes-types";

/** Interruptor general de la automatización mensual. Default: APAGADO. */
export function martaAutoEnabled(): boolean {
  return process.env.MARTA_AUTO_ENABLED === "true";
}

// -----------------------------------------------------------------------------
// Europe/Madrid ↔ UTC (exacto, con horario de verano)
// -----------------------------------------------------------------------------

/** Offset de Europe/Madrid (en minutos) en un instante dado. */
function madridOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  let hour = get("hour");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return (asUtc - at.getTime()) / 60000;
}

/** Construye el instante UTC que corresponde a una hora:minuto LOCAL de Madrid. */
export function madridToUtc(y: number, month1: number, day: number, hour: number, minute = 0): Date {
  const guess = Date.UTC(y, month1 - 1, day, hour, minute, 0);
  // Dos pasadas: la segunda corrige los días de cambio de hora.
  const off1 = madridOffsetMinutes(new Date(guess));
  const off2 = madridOffsetMinutes(new Date(guess - off1 * 60000));
  return new Date(guess - off2 * 60000);
}

/**
 * Inverso de madridToUtc: dado un instante UTC, devuelve la fecha y hora LOCAL de
 * Madrid como cadenas listas para <input type="date"> y <input type="time">.
 */
export function utcToMadridFields(d: Date): { fecha: string; hora: string } {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  let hh = get("hour");
  if (hh === "24") hh = "00";
  return { fecha: `${get("year")}-${get("month")}-${get("day")}`, hora: `${hh}:${get("minute")}` };
}

/** Convierte "YYYY-MM-DD" + "HH:MM" (hora local Madrid) al instante UTC. */
export function madridInputsToUtc(fecha: string, hora: string): Date | null {
  const md = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const mh = hora.match(/^(\d{1,2}):(\d{2})$/);
  if (!md || !mh) return null;
  const [, y, mo, d] = md.map(Number);
  const [, h, mi] = mh.map(Number);
  if (h > 23 || mi > 59) return null;
  return madridToUtc(y, mo, d, h, mi);
}

// -----------------------------------------------------------------------------
// Planificación de huecos del mes
// -----------------------------------------------------------------------------

const MAX_POSTS_MES = 20; // tope de seguridad (coste de generación)

export type HuecoMes = { fecha: Date; dia: number; hora: number };

/**
 * Devuelve los huecos del mes según la pauta (una hora concreta por día de la
 * semana). Solo fechas FUTURAS respecto a `desde` y como máximo `max` (el total
 * del mes se reparte entre las fechas que toquen, en orden cronológico).
 */
export function planificarMes(opts: {
  year: number;
  month1: number;          // 1-12
  dias: PautaDia[];        // días activos, cada uno con su hora
  desde?: Date;
  max?: number;
}): HuecoMes[] {
  const porDow = new Map<number, PautaDia>();
  for (const d of opts.dias) porDow.set(d.dow, d);
  if (porDow.size === 0) for (const d of PAUTA_DEFECTO.dias) porDow.set(d.dow, d);

  const desde = opts.desde ?? new Date();
  const max = Math.min(opts.max ?? MAX_POSTS_MES, MAX_POSTS_MES);

  const out: HuecoMes[] = [];
  const diasDelMes = new Date(Date.UTC(opts.year, opts.month1, 0)).getUTCDate();
  for (let d = 1; d <= diasDelMes && out.length < max; d++) {
    const dow = new Date(Date.UTC(opts.year, opts.month1 - 1, d)).getUTCDay();
    const pd = porDow.get(dow);
    if (!pd) continue;
    const fecha = madridToUtc(opts.year, opts.month1, d, pd.hora, pd.minuto);
    if (fecha.getTime() <= desde.getTime()) continue; // no programamos en el pasado
    out.push({ fecha, dia: d, hora: pd.hora });
  }
  return out;
}

// -----------------------------------------------------------------------------
// Caption ↔ hashtags
// -----------------------------------------------------------------------------

/**
 * generarCaption() ya devuelve los hashtags como ÚLTIMA línea del caption.
 * Aquí los separamos SOLO para poder revisarlos por separado en la página de
 * calendario; lo que se guarda y se publica sigue siendo el caption completo.
 */
export function separarHashtags(caption: string): { texto: string; hashtags: string[] } {
  const lineas = caption.trim().split(/\r?\n/);
  for (let i = lineas.length - 1; i >= 0; i--) {
    const l = lineas[i].trim();
    if (!l) continue;
    const tags = l.match(/#[\p{L}\p{N}_]+/gu);
    // Es la línea de hashtags si casi todo lo que hay en ella son hashtags.
    if (tags && tags.length >= 2 && tags.join(" ").length >= l.length * 0.6) {
      return { texto: lineas.slice(0, i).join("\n").trim(), hashtags: tags };
    }
    break; // solo miramos la última línea con contenido
  }
  return { texto: caption.trim(), hashtags: [] };
}

/** Gancho corto para el titular de la imagen (primera línea del caption). */
function ganchoDe(caption: string, max = 58): string {
  const primera = caption.trim().split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const limpia = primera.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+/g, " ").trim();
  if (limpia.length <= max) return limpia;
  const corte = limpia.slice(0, max);
  const sp = corte.lastIndexOf(" ");
  return (sp > 20 ? corte.slice(0, sp) : corte).replace(/[,;:.\-–]$/, "");
}

/** Recorta a `max` sin partir palabras (para la barra superior de la imagen). */
function recortePorPalabras(s: string, max: number): string {
  const limpio = s.replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max);
  const sp = corte.lastIndexOf(" ");
  return (sp > 8 ? corte.slice(0, sp) : corte).replace(/[,;:.\-–]$/, "");
}

// -----------------------------------------------------------------------------
// Imagen con los tokens de marca (reutiliza /api/og/post)
// -----------------------------------------------------------------------------

/**
 * Renderiza la imagen del post con la plantilla /api/og/post usando los tokens
 * de marca del NEGOCIO (colores + logo + nombre) y la guarda en el image-store
 * para obtener la URL durable que usa el flujo de publicación.
 *
 * Sin `marca` usa MARCA_DEFECTO (los tokens de AI-Team); sin `nombre`/`handle`
 * el renderizador usa sus valores por defecto → AI-Team se ve idéntico.
 */
export async function renderImagenMes(opts: {
  frase: string;
  rol: string;
  baseUrl: string;
  marca?: MarcaVisual;   // colores + logo del tenant
  nombre?: string;       // nombre de marca (arriba a la derecha)
  handle?: string;       // texto de la caja central
}): Promise<{ ok: true; url: string; host: string } | { ok: false; detail: string }> {
  const marca = opts.marca ?? MARCA_DEFECTO;
  const qs = new URLSearchParams({
    frase: opts.frase,
    bg: marca.fondo,
    acento: marca.acento,
    texto: marca.texto,
    // Nombre del negocio arriba a la izquierda; "AI-TEAM" solo para la cuenta propia.
    codename: opts.nombre ? opts.nombre.toUpperCase().slice(0, 22) : "AI-TEAM",
    rol: opts.rol.toUpperCase().slice(0, 24),
  });
  if (opts.nombre) qs.set("marca", opts.nombre.toUpperCase().slice(0, 22));
  if (opts.handle) qs.set("handle", opts.handle.toUpperCase().slice(0, 26));
  if (marca.logoUrl) qs.set("logo", marca.logoUrl);
  qs.set("plantilla", marca.plantilla);
  qs.set("cta", marca.cta); // presente aunque sea "" → og respeta el vacío (sin CTA)
  try {
    const r = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/api/og/post?${qs}`, { cache: "no-store" });
    if (!r.ok) return { ok: false, detail: `og/post -> ${r.status}` };
    const buf = Buffer.from(await r.arrayBuffer());
    // DURABLE: estas imágenes se publican hasta 30 días después, así que no
    // pueden ir al almacén efímero. storeImageDurable usa Vercel Blob (URL
    // permanente) y, si no está configurado, el store con TTL de 45 días.
    const img = await storeImageDurable(buf, "image/png", opts.baseUrl);
    return { ok: true, url: img.url, host: img.host };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Regenera SOLO la imagen de un post ya existente (mismo caption/tema), con la
 * marca visual + plantilla del tenant, y devuelve la URL DURABLE. Es el MISMO
 * camino que usa generarMes (marca + gancho + renderImagenMes → storeImageDurable),
 * así que la nueva imagen sigue viva semanas después igual que las originales.
 */
export async function regenerarImagenPost(opts: {
  tenantId: string;
  caption: string;
  tema?: string;
  /** Etiqueta corta de la barra superior. Si falta (entradas antiguas), se
   *  recorta `tema` por palabras enteras en vez de partirlo a mitad. */
  temaLabel?: string;
  baseUrl: string;
}): Promise<{ ok: true; url: string } | { ok: false; detail: string }> {
  const cuentaPropia = opts.tenantId === DEFAULT_TENANT_ID;
  const marca = await getMarcaVisual(opts.tenantId);
  let nombre: string | undefined;
  let handle: string | undefined;
  if (!cuentaPropia) {
    const t = await getTenant(opts.tenantId);
    const nom = (t?.ficha?.nombreNegocio || t?.name || "").trim();
    if (nom) { nombre = nom; handle = nom; }
  }
  const img = await renderImagenMes({
    frase: ganchoDe(opts.caption),
    rol: opts.temaLabel?.trim() || recortePorPalabras(opts.tema || "post", 24),
    baseUrl: opts.baseUrl,
    marca,
    nombre,
    handle,
  });
  return img.ok ? { ok: true, url: img.url } : { ok: false, detail: img.detail };
}

// -----------------------------------------------------------------------------
// Orquestador
// -----------------------------------------------------------------------------

export type GenerarMesResult =
  | { ok: true; persistido: boolean; mes: string; posts: PostMes[]; errores: string[]; skipped?: never }
  | { ok: true; persistido: false; mes: string; posts: []; errores: []; skipped: "auto_disabled" }
  | { ok: false; reason: "sin_huecos" | "sin_posts"; detail: string };

/**
 * Temas para la CUENTA PROPIA de AI-Team: hablan del problema del dueño de una
 * PYME de servicios, no de tecnología. (Para tenants cliente se rota el
 * catálogo genérico MARTA_TOPICS, que ya existe.)
 */
const TEMAS_AITEAM: Array<{ label: string; captionTema: string }> = [
  { label: "Llamadas perdidas", captionTema: "Cuántos clientes se pierden cuando nadie coge el teléfono porque estás atendiendo" },
  { label: "WhatsApp 24/7", captionTema: "Responder los WhatsApp de madrugada y fines de semana sin estar tú delante" },
  { label: "Agenda que se llena sola", captionTema: "Reservas online que entran solas en tu agenda, sin llamadas ni idas y venidas" },
  { label: "Reseñas de Google", captionTema: "Reseñas de Google sin contestar y lo que eso transmite a quien te busca" },
  { label: "Instagram sin tiempo", captionTema: "Mantener Instagram vivo cuando no tienes tiempo de publicar" },
  { label: "Clientas dormidas", captionTema: "Clientes que hace meses que no vuelven y a los que nadie ha escrito" },
  { label: "Plantones", captionTema: "Citas que no se presentan y el hueco que dejan en la agenda" },
  { label: "Respuesta rápida", captionTema: "Por qué quien contesta primero se lleva el cliente" },
  { label: "Caso de uso", captionTema: "Un día normal en una peluquería o centro de estética y dónde se escapa el dinero" },
  { label: "Qué no hacemos", captionTema: "Transparencia: qué no hacemos y para qué negocios no encajamos" },
];

type TemaMes = { label: string; captionTema: string; imageBrief?: string };

/** Temas del mes: rota el catálogo correspondiente para dar variedad. */
function temasDelMes(n: number, cuentaPropia: boolean): TemaMes[] {
  const pool: TemaMes[] = cuentaPropia
    ? TEMAS_AITEAM
    : (MARTA_TOPICS.filter((t) => t.key !== "auto") as MartaTopic[]).map((t) => ({
        label: t.label,
        captionTema: t.captionTema,
        imageBrief: t.imageBrief,
      }));
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
}

/**
 * Genera el calendario del mes entero y lo deja programado.
 *
 * `preview: true` → genera y devuelve SIN guardar nada (para revisar).
 * Si MARTA_AUTO_ENABLED != "true" y no es preview, no hace nada.
 */
export async function generarMes(opts: {
  tenantId: string;
  baseUrl: string;
  preview?: boolean;
  year?: number;
  month1?: number;
  /** Override de la pauta (si no, se usa la del tenant). */
  dias?: PautaDia[];
  /** Atajos de compat con el cron: días uniformes a una hora. */
  diasSemana?: number[];
  hora?: number;
  max?: number;
  now?: Date;
  /** Cuenta propia de AI-Team. Por defecto se deduce del tenant. */
  cuentaPropia?: boolean;
  /**
   * Salta el interruptor MARTA_AUTO_ENABLED. SOLO para el botón manual del
   * panel (acción humana explícita del fundador). La generación AUTOMÁTICA
   * por n8n nunca pasa `forzar`, así que sigue bloqueada hasta activar el flag.
   * Programar no publica: publicar es del flujo existente.
   */
  forzar?: boolean;
}): Promise<GenerarMesResult> {
  const now = opts.now ?? new Date();
  const year = opts.year ?? now.getUTCFullYear();
  const month1 = opts.month1 ?? now.getUTCMonth() + 1;
  const mes = `${year}-${String(month1).padStart(2, "0")}`;

  if (!opts.preview && !opts.forzar && !martaAutoEnabled()) {
    return { ok: true, persistido: false, mes, posts: [], errores: [], skipped: "auto_disabled" };
  }

  // Los días (cada uno con su hora) salen de la PAUTA por negocio (guardada en
  // el tenant). Si el tenant no tiene pauta, getPautaPublicacion devuelve la de
  // por defecto (L-X-V 10:00). El cron puede sobreescribir con ?dias/?hora
  // (días uniformes a una hora); el override explícito `dias` manda sobre todo.
  let dias: PautaDia[];
  if (opts.dias?.length) {
    dias = opts.dias;
  } else if (opts.diasSemana?.length) {
    const hora = opts.hora ?? 10;
    dias = opts.diasSemana.map((dow) => ({ dow, hora, minuto: 0 }));
  } else {
    dias = (await getPautaPublicacion(opts.tenantId)).dias;
  }

  const huecos = planificarMes({ year, month1, dias, desde: now, max: opts.max });
  if (huecos.length === 0) {
    return { ok: false, reason: "sin_huecos", detail: `No quedan fechas futuras en ${mes} con esa cadencia.` };
  }

  const cuentaPropia = opts.cuentaPropia ?? opts.tenantId === DEFAULT_TENANT_ID;
  const temas = temasDelMes(huecos.length, cuentaPropia);

  // Identidad visual del negocio para las imágenes. Para la cuenta propia de
  // AI-Team NO pasamos nombre/handle → el renderizador usa sus valores por
  // defecto ("AI-TEAM" / "AITEAM.MARKETING") y todo se ve idéntico a hoy.
  const marca = await getMarcaVisual(opts.tenantId);
  let nombre: string | undefined;
  let handle: string | undefined;
  if (!cuentaPropia) {
    const t = await getTenant(opts.tenantId);
    const nom = (t?.ficha?.nombreNegocio || t?.name || "").trim();
    if (nom) { nombre = nom; handle = nom; }
  }

  const posts: PostMes[] = [];
  const errores: string[] = [];

  for (let i = 0; i < huecos.length; i++) {
    const hueco = huecos[i];
    const topic = temas[i];
    try {
      const cap = await generarCaption({
        tenantId: opts.tenantId,
        tema: topic.captionTema || undefined,
        contexto: topic.imageBrief || undefined,
        cuentaPropia,
      });
      if (!cap.ok) {
        errores.push(`Día ${hueco.dia} (${topic.label}): caption [${cap.reason}] ${cap.detail}`);
        continue;
      }
      const { texto, hashtags } = separarHashtags(cap.caption);
      const img = await renderImagenMes({
        frase: ganchoDe(cap.caption),
        rol: topic.label,
        baseUrl: opts.baseUrl,
        marca,
        nombre,
        handle,
      });
      if (!img.ok) {
        errores.push(`Día ${hueco.dia} (${topic.label}): imagen ${img.detail}`);
        continue;
      }
      posts.push({
        scheduledAt: hueco.fecha.toISOString(),
        tema: cap.tema || topic.captionTema || topic.label,
        temaLabel: topic.label,
        caption: cap.caption,
        texto,
        hashtags,
        imageUrl: img.url,
      });
    } catch (err) {
      errores.push(`Día ${hueco.dia}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (posts.length === 0) {
    return { ok: false, reason: "sin_posts", detail: errores.join(" | ") || "No se generó ningún post." };
  }

  // Preview: NO tocamos el store.
  if (opts.preview) {
    return { ok: true, persistido: false, mes, posts, errores };
  }

  await scheduleAtDates(
    opts.tenantId,
    posts.map((p) => ({
      caption: p.caption,
      imageUrl: p.imageUrl,
      tema: p.tema,
      temaLabel: p.temaLabel, // etiqueta corta de la barra de la imagen (para regenerarla igual)
      mediaType: "IMAGE" as const,
      scheduledAt: p.scheduledAt,
    })),
  );
  return { ok: true, persistido: true, mes, posts, errores };
}
