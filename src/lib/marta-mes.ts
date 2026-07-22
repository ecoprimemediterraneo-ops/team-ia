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
import { getSchedule } from "./marta-schedule";
import { DEFAULT_TENANT_ID } from "./tenants";

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

/** Construye el instante UTC que corresponde a una hora LOCAL de Madrid. */
export function madridToUtc(y: number, month1: number, day: number, hour: number): Date {
  const guess = Date.UTC(y, month1 - 1, day, hour, 0, 0);
  // Dos pasadas: la segunda corrige los días de cambio de hora.
  const off1 = madridOffsetMinutes(new Date(guess));
  const off2 = madridOffsetMinutes(new Date(guess - off1 * 60000));
  return new Date(guess - off2 * 60000);
}

// -----------------------------------------------------------------------------
// Planificación de huecos del mes
// -----------------------------------------------------------------------------

/**
 * Cadencia por defecto: lunes, miércoles y viernes → 3 posts/semana (~13/mes).
 * Extiende la regla que ya existe en marta-schedule (defaultSchedule usa
 * lunes+viernes) hasta la cadencia de 3-4/semana que pide el calendario mensual.
 */
export const DIAS_DEFECTO = [1, 3, 5]; // 0=Domingo … 6=Sábado
const MAX_POSTS_MES = 20; // tope de seguridad (coste de generación)

export type HuecoMes = { fecha: Date; dia: number; hora: number };

/**
 * Devuelve los huecos del mes indicado (solo fechas FUTURAS respecto a `desde`,
 * para no programar en el pasado si se lanza a mitad de mes).
 */
export function planificarMes(opts: {
  year: number;
  month1: number;          // 1-12
  diasSemana?: number[];
  hora?: number;           // hora local Madrid
  desde?: Date;
  max?: number;
}): HuecoMes[] {
  const dias = opts.diasSemana?.length ? opts.diasSemana : DIAS_DEFECTO;
  const hora = opts.hora ?? 10;
  const desde = opts.desde ?? new Date();
  const max = Math.min(opts.max ?? MAX_POSTS_MES, MAX_POSTS_MES);

  const out: HuecoMes[] = [];
  const diasDelMes = new Date(Date.UTC(opts.year, opts.month1, 0)).getUTCDate();
  for (let d = 1; d <= diasDelMes && out.length < max; d++) {
    const dow = new Date(Date.UTC(opts.year, opts.month1 - 1, d)).getUTCDay();
    if (!dias.includes(dow)) continue;
    const fecha = madridToUtc(opts.year, opts.month1, d, hora);
    if (fecha.getTime() <= desde.getTime()) continue; // no programamos en el pasado
    out.push({ fecha, dia: d, hora });
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

// -----------------------------------------------------------------------------
// Imagen con los tokens de marca (reutiliza /api/og/post)
// -----------------------------------------------------------------------------

/**
 * Renderiza la imagen del post con la plantilla de marca que YA existe
 * (/api/og/post: crema, mostaza #F5C518, barras negras, borde grueso) y la
 * guarda en el image-store de Marta para obtener la URL durable que usa el
 * flujo de publicación.
 */
export async function renderImagenMes(opts: {
  frase: string;
  rol: string;
  baseUrl: string;
  color?: string;
}): Promise<{ ok: true; url: string; host: string } | { ok: false; detail: string }> {
  const qs = new URLSearchParams({
    frase: opts.frase,
    color: opts.color ?? "#F5C518", // mostaza de marca
    codename: "AI-TEAM",
    rol: opts.rol.toUpperCase().slice(0, 24),
  });
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

// -----------------------------------------------------------------------------
// Orquestador
// -----------------------------------------------------------------------------

export type PostMes = {
  scheduledAt: string;   // ISO UTC
  tema: string;
  temaLabel: string;
  caption: string;       // completo (texto + hashtags) — es lo que se publica
  texto: string;         // solo el cuerpo, para revisar
  hashtags: string[];    // separados, para revisar
  imageUrl: string;
};

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

  // La hora local sale de la regla que ya tiene el tenant (marta-schedule).
  const regla = await getSchedule(opts.tenantId);
  const hora = opts.hora ?? regla.hour ?? 10;

  const huecos = planificarMes({
    year, month1, diasSemana: opts.diasSemana, hora, desde: now, max: opts.max,
  });
  if (huecos.length === 0) {
    return { ok: false, reason: "sin_huecos", detail: `No quedan fechas futuras en ${mes} con esa cadencia.` };
  }

  const cuentaPropia = opts.cuentaPropia ?? opts.tenantId === DEFAULT_TENANT_ID;
  const temas = temasDelMes(huecos.length, cuentaPropia);
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
      mediaType: "IMAGE" as const,
      scheduledAt: p.scheduledAt,
    })),
  );
  return { ok: true, persistido: true, mes, posts, errores };
}
