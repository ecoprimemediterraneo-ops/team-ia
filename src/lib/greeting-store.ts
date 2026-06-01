// Flag "greeted" por canal + sender, para que Pablo y Marta solo saluden
// en el PRIMER mensaje de cada interlocutor.
//
// Reutiliza el mismo patrón que store.ts:
//   - Supabase kv_store si SUPABASE_URL + SUPABASE_SERVICE_KEY están definidos.
//   - Fallback a fichero local (data/greeted.json) en desarrollo.
//
// Estructura guardada bajo la clave "greeted":
//   { "pablo:34600...": "2026-05-29T...", "marta:178414...": "..." }

import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "./supabase";

export type GreetingChannel = "pablo" | "marta";

const KV_KEY = "greeted";
const DATA_DIR = path.join(process.cwd(), "data");
const GREETED_FILE = path.join(DATA_DIR, "greeted.json");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

type GreetedMap = Record<string, string>; // "channel:senderId" -> ISO timestamp

function makeKey(channel: GreetingChannel, senderId: string): string {
  return `${channel}:${senderId}`;
}

async function readAll(): Promise<GreetedMap> {
  if (USE_SUPABASE) {
    return (await kvGet<GreetedMap>(KV_KEY)) ?? {};
  }
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(GREETED_FILE, "utf-8").catch(() => "{}");
    return raw.trim() ? (JSON.parse(raw) as GreetedMap) : {};
  } catch {
    return {};
  }
}

async function writeAll(map: GreetedMap): Promise<void> {
  if (USE_SUPABASE) {
    await kvSet(KV_KEY, map);
  } else {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(GREETED_FILE, JSON.stringify(map, null, 2));
  }
}

/** Devuelve true si este sender YA fue saludado antes en este canal. */
export async function hasGreeted(channel: GreetingChannel, senderId: string): Promise<boolean> {
  if (!senderId) return false;
  const all = await readAll();
  return !!all[makeKey(channel, senderId)];
}

/** Marca a este sender como ya saludado (idempotente). */
export async function markGreeted(channel: GreetingChannel, senderId: string): Promise<void> {
  if (!senderId) return;
  const all = await readAll();
  const key = makeKey(channel, senderId);
  if (all[key]) return; // ya estaba
  all[key] = new Date().toISOString();
  await writeAll(all);
}
