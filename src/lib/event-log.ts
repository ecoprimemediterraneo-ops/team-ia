// Log append-only de eventos del informe mensual por cliente (tenant).
//
// Una clave por (tenant, mes): "events:<tenantId>:<YYYY-MM>" — Event[].
// Mantener una clave por mes facilita generar el informe mensual con una sola
// lectura, y limita el tamaño de cada clave (cabe holgadamente en kv_store).
//
// Storage:
//   - Supabase kv_store si SUPABASE_URL + SUPABASE_SERVICE_KEY (prod).
//   - Fallback a data/events.json en dev. Estructura {"events:tenantX:2026-06": [...]}.
//
// Idempotencia: appendEvent evita duplicados con el mismo `event.id`.

import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "./supabase";

export type EventType =
  | "message_in"
  | "message_out"
  | "lead_captured"
  | "appointment_set"
  | "sale"
  | "handoff_human";

export type EventChannel =
  | "pablo"
  | "marta"
  | "carmen"
  | "eva"
  | "lucia"
  | "rocio"
  | "sergio"
  | "dashboard"
  | "system";

export type AnalyticsEvent = {
  id: string;
  ts: string;            // ISO
  tenantId: string;
  type: EventType;
  channel: EventChannel;
  senderId?: string;     // identificador del cliente final (wa number / IGSID)
  meta?: {
    latencyMs?: number;
    sector?: string;
    valueEUR?: number;
    stageFrom?: string;
    stageTo?: string;
    [k: string]: unknown;
  };
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "events.json");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

function monthKey(d: Date | string = new Date()): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function kvKey(tenantId: string, month: string): string {
  return `events:${tenantId}:${month}`;
}

// -----------------------------------------------------------------------------
// Backends
// -----------------------------------------------------------------------------
async function readBucket(tenantId: string, month: string): Promise<AnalyticsEvent[]> {
  const k = kvKey(tenantId, month);
  if (USE_SUPABASE) {
    return (await kvGet<AnalyticsEvent[]>(k)) ?? [];
  }
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    const all = raw.trim() ? (JSON.parse(raw) as Record<string, AnalyticsEvent[]>) : {};
    return all[k] ?? [];
  } catch {
    return [];
  }
}

async function writeBucket(tenantId: string, month: string, events: AnalyticsEvent[]): Promise<void> {
  const k = kvKey(tenantId, month);
  if (USE_SUPABASE) {
    await kvSet(k, events);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
  const all = raw.trim() ? (JSON.parse(raw) as Record<string, AnalyticsEvent[]>) : {};
  all[k] = events;
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

/**
 * Genera un id estable a partir de partes determinísticas. Útil cuando se
 * quiere idempotencia (p.ej. un mismo message_id de Meta no debe generar
 * dos eventos message_in si el webhook se reentrega).
 */
export function makeEventId(...parts: (string | number | undefined)[]): string {
  return parts.filter((p) => p !== undefined && p !== null && p !== "").join(":");
}

/**
 * Escribe un evento en el bucket del mes correspondiente. Idempotente:
 * si ya existe un evento con el mismo id en ese bucket, no lo duplica.
 *
 * Atajos / valores por defecto:
 *  - id: si no se pasa, se genera con tipo+ts+random.
 *  - ts: si no se pasa, usa Date.now().
 */
export async function logEvent(
  tenantId: string,
  evt: Omit<AnalyticsEvent, "id" | "ts" | "tenantId"> & {
    id?: string;
    ts?: string;
  },
): Promise<AnalyticsEvent> {
  const ts = evt.ts ?? new Date().toISOString();
  const id =
    evt.id ??
    makeEventId(evt.type, ts, Math.random().toString(36).slice(2, 8));

  const event: AnalyticsEvent = {
    id,
    ts,
    tenantId,
    type: evt.type,
    channel: evt.channel,
    senderId: evt.senderId,
    meta: evt.meta,
  };

  const month = monthKey(ts);
  const bucket = await readBucket(tenantId, month);
  if (bucket.some((e) => e.id === id)) return event; // dedup
  bucket.push(event);
  await writeBucket(tenantId, month, bucket);
  return event;
}

/** Devuelve TODOS los eventos del tenant en el mes pedido ("YYYY-MM"). */
export async function getMonthEvents(
  tenantId: string,
  month: string,
): Promise<AnalyticsEvent[]> {
  return readBucket(tenantId, month);
}

/** Helper para el render de informes — agrupa por tipo. */
export async function getMonthCounts(
  tenantId: string,
  month: string,
): Promise<Record<EventType, number>> {
  const events = await getMonthEvents(tenantId, month);
  const out: Record<EventType, number> = {
    message_in: 0,
    message_out: 0,
    lead_captured: 0,
    appointment_set: 0,
    sale: 0,
    handoff_human: 0,
  };
  for (const e of events) {
    out[e.type] = (out[e.type] ?? 0) + 1;
  }
  return out;
}

export { monthKey };
