// Calendario de publicación de Marta — programa posts/reels/stories en el
// tiempo en vez de publicarlos de golpe.
//
// Cada entrada tiene su `scheduledAt`. Cuando llega su hora, el trigger
// (cron de Vercel o /api/admin/marta-calendar/trigger en local) llama a
// `runDue` que para cada entrada vencida:
//   1. Manda la propuesta al cliente por WhatsApp (createProposal + envío
//      vía sendWhatsAppImage/sendWhatsAppVideo).
//   2. Marca la entrada como `proposed`.
//   3. La aprobación → publicación llega por el interceptor del webhook de
//      Pablo, que llama a markCalendarEntryPublished cuando el cliente
//      aprueba.
//
// Storage: Supabase kv_store (clave `marta-calendar:<tenantId>`) o
// fallback fichero local data/marta-calendar.json. Una lista por tenant.

import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "./supabase";
import type { ProposalMediaType } from "./marta-proposals";

export type CalendarStatus =
  | "scheduled"        // programado, aún no enviado
  | "proposed"         // enviado al cliente, esperando respuesta
  | "published"        // publicado en Instagram
  | "rejected"         // cliente lo descartó
  | "failed"           // error al enviar / publicar
  | "skipped";         // saltado por config

export type CalendarEntry = {
  id: string;
  tenantId: string;
  scheduledAt: string;            // ISO
  mediaType: ProposalMediaType;   // IMAGE | REELS
  imageUrl: string;
  caption: string;
  tema?: string;
  status: CalendarStatus;
  proposedAt?: string;
  publishedAt?: string;
  igMediaId?: string;
  proposalId?: string;            // link a marta-proposals
  errorDetail?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "marta-calendar.json");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

function kvKey(tenantId: string): string {
  return `marta-calendar:${tenantId}`;
}

type LocalMap = Record<string, CalendarEntry[]>;

async function readAll(tenantId: string): Promise<CalendarEntry[]> {
  if (USE_SUPABASE) return (await kvGet<CalendarEntry[]>(kvKey(tenantId))) ?? [];
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    const all = raw.trim() ? (JSON.parse(raw) as LocalMap) : {};
    return all[kvKey(tenantId)] ?? [];
  } catch {
    return [];
  }
}

async function writeAll(tenantId: string, entries: CalendarEntry[]): Promise<void> {
  if (USE_SUPABASE) {
    await kvSet(kvKey(tenantId), entries);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
  const all = raw.trim() ? (JSON.parse(raw) as LocalMap) : {};
  all[kvKey(tenantId)] = entries;
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

// -----------------------------------------------------------------------------
// Distribución de horas
// -----------------------------------------------------------------------------

// Slots razonables (hora local Europa/Madrid asumida): mañana, mediodía y tarde.
const DEFAULT_SLOTS_HOURS = [10, 13, 18];

/**
 * Distribuye N drafts a lo largo de `daySpan` días, máx postsPerDay por día.
 * Empieza HOY o mañana según `startsTomorrow`. Devuelve fechas ISO en UTC
 * (convirtiendo desde la hora local +1h por simplicidad — España no horario
 * de verano: aproximado para el caso de uso).
 */
export function distributeSchedule(
  count: number,
  opts: { startsTomorrow?: boolean; daySpan?: number; postsPerDay?: number; baseDate?: Date } = {},
): Date[] {
  const daySpan = Math.max(1, opts.daySpan ?? 7);
  const slots = (opts.postsPerDay ?? 2) > DEFAULT_SLOTS_HOURS.length
    ? DEFAULT_SLOTS_HOURS
    : DEFAULT_SLOTS_HOURS.slice(0, opts.postsPerDay ?? 2);
  const base = opts.baseDate ? new Date(opts.baseDate.getTime()) : new Date();
  if (opts.startsTomorrow) base.setDate(base.getDate() + 1);
  base.setHours(0, 0, 0, 0);

  const out: Date[] = [];
  let day = 0;
  let slot = 0;
  while (out.length < count) {
    if (day >= daySpan) day = 0; // cíclico (no debería superar daySpan * slots)
    const d = new Date(base.getTime());
    d.setDate(d.getDate() + day);
    d.setHours(slots[slot], 0, 0, 0);
    out.push(d);
    slot++;
    if (slot >= slots.length) {
      slot = 0;
      day++;
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

export async function scheduleBatch(
  tenantId: string,
  drafts: Array<{ caption: string; imageUrl: string; tema?: string; mediaType?: ProposalMediaType }>,
  opts: { daySpan?: number; postsPerDay?: number; startsTomorrow?: boolean } = {},
): Promise<CalendarEntry[]> {
  const dates = distributeSchedule(drafts.length, opts);
  const now = Date.now();
  const entries: CalendarEntry[] = drafts.map((d, i) => ({
    id: `cal_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
    tenantId,
    scheduledAt: dates[i].toISOString(),
    mediaType: d.mediaType ?? "IMAGE",
    imageUrl: d.imageUrl,
    caption: d.caption,
    tema: d.tema,
    status: "scheduled",
  }));
  const current = await readAll(tenantId);
  const merged = [...current, ...entries].sort((a, b) =>
    a.scheduledAt < b.scheduledAt ? -1 : 1,
  );
  await writeAll(tenantId, merged);
  return entries;
}

export async function listCalendar(tenantId: string): Promise<CalendarEntry[]> {
  const arr = await readAll(tenantId);
  return [...arr].sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
}

export async function findEntryById(
  tenantId: string,
  id: string,
): Promise<CalendarEntry | null> {
  const all = await readAll(tenantId);
  return all.find((e) => e.id === id) ?? null;
}

export async function findEntryByProposalId(
  tenantId: string,
  proposalId: string,
): Promise<CalendarEntry | null> {
  const all = await readAll(tenantId);
  return all.find((e) => e.proposalId === proposalId) ?? null;
}

async function updateEntry(
  tenantId: string,
  id: string,
  patch: Partial<CalendarEntry>,
): Promise<CalendarEntry | null> {
  const all = await readAll(tenantId);
  const idx = all.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  await writeAll(tenantId, all);
  return all[idx];
}

export async function markCalendarEntryProposed(
  tenantId: string,
  id: string,
  proposalId: string,
): Promise<CalendarEntry | null> {
  return updateEntry(tenantId, id, {
    status: "proposed",
    proposedAt: new Date().toISOString(),
    proposalId,
  });
}

export async function markCalendarEntryPublished(
  tenantId: string,
  id: string,
  igMediaId: string,
): Promise<CalendarEntry | null> {
  return updateEntry(tenantId, id, {
    status: "published",
    publishedAt: new Date().toISOString(),
    igMediaId,
  });
}

export async function markCalendarEntryRejected(
  tenantId: string,
  id: string,
): Promise<CalendarEntry | null> {
  return updateEntry(tenantId, id, { status: "rejected" });
}

export async function markCalendarEntryFailed(
  tenantId: string,
  id: string,
  detail: string,
): Promise<CalendarEntry | null> {
  return updateEntry(tenantId, id, { status: "failed", errorDetail: detail });
}

/**
 * Devuelve entradas cuyo scheduledAt ya pasó y siguen como `scheduled`.
 */
export async function dueNow(tenantId: string, now: Date = new Date()): Promise<CalendarEntry[]> {
  const all = await readAll(tenantId);
  return all.filter((e) => e.status === "scheduled" && Date.parse(e.scheduledAt) <= now.getTime());
}
