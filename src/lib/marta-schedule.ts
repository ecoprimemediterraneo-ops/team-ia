// Programación automática de Marta — regla de recurrencia por tenant.
//
// Una regla por tenant define en QUÉ días (de la semana) y a qué HORA local
// (Europe/Madrid) Marta genera un post automáticamente. Modo de aprobación:
//   - "avisar"  → genera el post y crea una PROPUESTA PENDIENTE (se aprueba en
//                 la app con un clic, y opcionalmente avisa por WhatsApp).
//   - "directo" → publicaría sin pedir permiso. DESACTIVADO por ahora
//                 (DIRECT_PUBLISH_ENABLED=false) hasta confirmar el permiso
//                 instagram_content_publish con Meta.
//
// El cron horario (/api/cron/marta-publicar) llama a runDueSchedules(): para
// cada regla activa cuya hora local coincide con AHORA y que no se haya
// ejecutado ya hoy, genera los posts y crea las propuestas.
//
// Storage: Supabase kv_store (clave `marta-schedule:<tenantId>`) o fallback
// fichero local data/marta-schedule.json.

import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, kvListByPrefix } from "./supabase";
import { createProposal } from "./marta-proposals";
import { generatePostImage } from "./marta-image-gen";
import { generarCaption } from "./marta-caption";
import { resolveTopic } from "./marta-topics";

// Modo "directo" preparado pero DESACTIVADO hasta confirmar permiso de Meta
// (instagram_content_publish). Mientras esté en false, cualquier regla en
// modo "directo" se trata como "avisar" (se crea propuesta pendiente).
export const DIRECT_PUBLISH_ENABLED = false;

export type ApprovalMode = "avisar" | "directo";

export type MartaSchedule = {
  tenantId: string;
  enabled: boolean;
  daysOfWeek: number[]; // convención JS: 0=Domingo … 6=Sábado
  hour: number; // 0-23, hora local Europe/Madrid
  mode: ApprovalMode;
  postsPerRun: number; // posts a generar por ejecución (1-3)
  tema: string; // key de marta-topics ("auto" = elige Marta)
  lastRunDate?: string; // "YYYY-MM-DD" local — guarda anti-duplicado
  updatedAt?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "marta-schedule.json");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

function kvKey(tenantId: string): string {
  return `marta-schedule:${tenantId}`;
}

export function defaultSchedule(tenantId: string): MartaSchedule {
  return {
    tenantId,
    enabled: false,
    daysOfWeek: [1, 5], // lunes y viernes
    hour: 10,
    mode: "avisar",
    postsPerRun: 1,
    tema: "auto",
  };
}

type LocalMap = Record<string, MartaSchedule>;

// -----------------------------------------------------------------------------
// Storage
// -----------------------------------------------------------------------------

export async function getSchedule(tenantId: string): Promise<MartaSchedule> {
  if (USE_SUPABASE) {
    const s = await kvGet<MartaSchedule>(kvKey(tenantId));
    return s ?? defaultSchedule(tenantId);
  }
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    const all = raw.trim() ? (JSON.parse(raw) as LocalMap) : {};
    return all[kvKey(tenantId)] ?? defaultSchedule(tenantId);
  } catch {
    return defaultSchedule(tenantId);
  }
}

export async function saveSchedule(
  tenantId: string,
  patch: Partial<MartaSchedule>,
): Promise<MartaSchedule> {
  const current = await getSchedule(tenantId);
  const next: MartaSchedule = {
    ...current,
    ...patch,
    tenantId,
    updatedAt: new Date().toISOString(),
  };
  await writeSchedule(next);
  return next;
}

async function writeSchedule(sched: MartaSchedule): Promise<void> {
  if (USE_SUPABASE) {
    await kvSet(kvKey(sched.tenantId), sched);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
  const all = raw.trim() ? (JSON.parse(raw) as LocalMap) : {};
  all[kvKey(sched.tenantId)] = sched;
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

async function listSchedules(): Promise<MartaSchedule[]> {
  if (USE_SUPABASE) {
    const rows = await kvListByPrefix<MartaSchedule>("marta-schedule:");
    return rows.map((r) => r.value).filter(Boolean);
  }
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    const all = raw.trim() ? (JSON.parse(raw) as LocalMap) : {};
    return Object.values(all);
  } catch {
    return [];
  }
}

// -----------------------------------------------------------------------------
// Zona horaria (Europe/Madrid) — exacta, con cambio de hora (CET/CEST)
// -----------------------------------------------------------------------------

/**
 * Descompone un instante UTC en hora LOCAL de Europe/Madrid usando Intl
 * (respeta el horario de verano automáticamente). Devuelve:
 *   dateStr "YYYY-MM-DD", hour 0-23, dow 0=Domingo..6=Sábado.
 */
export function madridParts(now: Date): { dateStr: string; hour: number; dow: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // algunos entornos devuelven '24' a medianoche
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // getUTCDay sobre la fecha civil da el día de la semana correcto e invariante.
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { dateStr, hour, dow };
}

/** ¿Debe ejecutarse esta regla AHORA (día + hora local, no ejecutada hoy)? */
export function isDue(sched: MartaSchedule, now: Date): boolean {
  if (!sched.enabled) return false;
  const { dateStr, hour, dow } = madridParts(now);
  if (!sched.daysOfWeek.includes(dow)) return false;
  if (hour !== sched.hour) return false;
  if (sched.lastRunDate === dateStr) return false; // ya corrió hoy
  return true;
}

// -----------------------------------------------------------------------------
// Ejecución
// -----------------------------------------------------------------------------

export type RunResult = {
  ok: boolean;
  tenantId: string;
  mode: ApprovalMode;
  effectiveMode: ApprovalMode; // lo que de verdad se hizo (directo→avisar si gated)
  created: number; // propuestas pendientes creadas
  details: string[];
  skipped?: string;
};

/**
 * Genera los posts de una regla y crea las propuestas pendientes (modo avisar).
 * `force` ignora el reloj/anti-duplicado (para el botón "Ejecutar ahora").
 */
export async function runSchedule(
  tenantId: string,
  opts: { baseUrl: string; force?: boolean; now?: Date } = { baseUrl: "" },
): Promise<RunResult> {
  const now = opts.now ?? new Date();
  const sched = await getSchedule(tenantId);

  if (!opts.force && !isDue(sched, now)) {
    return {
      ok: true,
      tenantId,
      mode: sched.mode,
      effectiveMode: sched.mode,
      created: 0,
      details: [],
      skipped: "not_due",
    };
  }

  // "directo" sigue desactivado: cae a "avisar" (propuesta pendiente).
  const effectiveMode: ApprovalMode =
    sched.mode === "directo" && !DIRECT_PUBLISH_ENABLED ? "avisar" : sched.mode;

  const topic = resolveTopic(sched.tema || "auto");
  const details: string[] = [];
  let created = 0;
  const n = Math.min(Math.max(sched.postsPerRun || 1, 1), 3);

  if (sched.mode === "directo" && !DIRECT_PUBLISH_ENABLED) {
    details.push(
      'Modo "directo" desactivado (falta confirmar instagram_content_publish) → se crea propuesta para aprobar.',
    );
  }

  for (let i = 0; i < n; i++) {
    try {
      const gen = await generatePostImage({
        tenantId,
        tema: topic.captionTema || undefined,
        contexto: topic.imageBrief || undefined,
        mediaType: "IMAGE",
        baseUrl: opts.baseUrl,
      });
      if (!gen.ok) {
        details.push(`Post ${i + 1}: no se pudo generar la imagen [${gen.reason}] ${gen.detail}`);
        continue;
      }
      const cap = await generarCaption({
        tenantId,
        tema: topic.captionTema || undefined,
      });
      if (!cap.ok) {
        details.push(`Post ${i + 1}: no se pudo generar el texto [${cap.reason}] ${cap.detail}`);
        continue;
      }

      const proposal = await createProposal({
        tenantId,
        recipientWhatsapp: "", // aprobación solo en la app (sin WhatsApp)
        imageUrl: gen.url,
        caption: cap.caption,
        mediaType: "IMAGE",
        imageSource: "generada_ia",
        imagePrompt: gen.prompt,
        tema: topic.captionTema || undefined,
        fotoBrief: topic.imageBrief || undefined,
        regenCount: 0,
      });
      created++;
      details.push(`Post ${i + 1}: propuesta ${proposal.id} lista para revisar en la app.`);
    } catch (err) {
      details.push(`Post ${i + 1}: error ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Marca como ejecutada hoy (solo si no es force, para no bloquear la real).
  if (!opts.force) {
    const { dateStr } = madridParts(now);
    await saveSchedule(tenantId, { lastRunDate: dateStr });
  }

  return { ok: true, tenantId, mode: sched.mode, effectiveMode, created, details };
}

/** Recorre todas las reglas y ejecuta las que tocan ahora. Para el cron. */
export async function runDueSchedules(baseUrl: string, now: Date = new Date()): Promise<RunResult[]> {
  const all = await listSchedules();
  const out: RunResult[] = [];
  for (const sched of all) {
    if (!isDue(sched, now)) continue;
    out.push(await runSchedule(sched.tenantId, { baseUrl, now }));
  }
  return out;
}
