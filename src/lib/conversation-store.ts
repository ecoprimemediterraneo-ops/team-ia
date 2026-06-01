// Memoria de conversación por interlocutor para Pablo (WhatsApp) y Marta (Instagram).
//
// Reutiliza la capa de store usada en greeting-store:
//   - Supabase kv_store si SUPABASE_URL + SUPABASE_SERVICE_KEY están definidos (prod).
//   - Fallback a fichero local data/conversations.json (dev).
//
// Modelo:
//   Una entrada por conversación, clave kv_store:
//     "conv:pablo:34600123456"
//     "conv:marta:17841405793187041"
//   En modo fichero local, todas viven en un único JSON
//     { "conv:pablo:34600...": Conversation, ... }
//   para no crear cientos de ficheros en dev.
//
// Configuración:
//   CONVERSATION_WINDOW   — nº de turnos máximo en memoria (default 10)
//   CONVERSATION_TTL_HRS  — horas tras las que la conversación se considera "stale"
//                           y se resetea (default 24)
//   CONVERSATION_MAX_CHARS — máximo de caracteres por turno (default 500)

import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "./supabase";

export type ConversationChannel = "pablo" | "marta";
export type TurnRole = "user" | "assistant";

export type ConversationTurn = {
  role: TurnRole;
  text: string;
  ts: string; // ISO
};

export type Conversation = {
  channel: ConversationChannel;
  senderId: string;
  name?: string;
  turns: ConversationTurn[];
  updatedAt: string; // ISO
};

const DATA_DIR = path.join(process.cwd(), "data");
const CONV_FILE = path.join(DATA_DIR, "conversations.json");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

const WINDOW = clampInt(process.env.CONVERSATION_WINDOW, 10, 1, 50);
const TTL_HOURS = clampInt(process.env.CONVERSATION_TTL_HRS, 24, 1, 24 * 30);
const MAX_CHARS = clampInt(process.env.CONVERSATION_MAX_CHARS, 500, 50, 4000);

function clampInt(raw: string | undefined, def: number, min: number, max: number): number {
  const n = raw ? parseInt(raw, 10) : def;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function key(channel: ConversationChannel, senderId: string): string {
  return `conv:${channel}:${senderId}`;
}

function isStale(updatedAt: string): boolean {
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return true;
  const ageMs = Date.now() - t;
  return ageMs > TTL_HOURS * 60 * 60 * 1000;
}

function truncate(text: string): string {
  if (!text) return "";
  if (text.length <= MAX_CHARS) return text;
  return text.slice(0, MAX_CHARS - 1) + "…";
}

// -----------------------------------------------------------------------------
// Backend: Supabase (una clave por conversación)
// -----------------------------------------------------------------------------
async function readOneSupabase(k: string): Promise<Conversation | null> {
  return (await kvGet<Conversation>(k)) ?? null;
}

async function writeOneSupabase(k: string, conv: Conversation): Promise<void> {
  await kvSet(k, conv);
}

async function deleteOneSupabase(k: string): Promise<void> {
  // No tenemos delete en el helper; sobrescribir con conversación vacía equivale a reset
  // (los lectores con isStale lo limpian igualmente). Para evitar dependencias nuevas,
  // simplemente sobrescribimos con un objeto mínimo y updatedAt antiguo.
  await kvSet(k, {
    channel: k.split(":")[1] as ConversationChannel,
    senderId: k.split(":").slice(2).join(":"),
    turns: [],
    updatedAt: new Date(0).toISOString(),
  } satisfies Conversation);
}

// -----------------------------------------------------------------------------
// Backend: fichero local (un JSON con todas las conversaciones)
// -----------------------------------------------------------------------------
type LocalMap = Record<string, Conversation>;

async function readAllLocal(): Promise<LocalMap> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(CONV_FILE, "utf-8").catch(() => "{}");
    return raw.trim() ? (JSON.parse(raw) as LocalMap) : {};
  } catch {
    return {};
  }
}

async function writeAllLocal(map: LocalMap): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONV_FILE, JSON.stringify(map, null, 2));
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

/**
 * Devuelve la conversación actual de este sender. Si está stale (más de
 * TTL_HOURS sin actualizar) la limpia on-read y devuelve null.
 */
export async function getConversation(
  channel: ConversationChannel,
  senderId: string,
): Promise<Conversation | null> {
  if (!senderId) return null;
  const k = key(channel, senderId);

  let conv: Conversation | null = null;
  if (USE_SUPABASE) {
    conv = await readOneSupabase(k);
  } else {
    const all = await readAllLocal();
    conv = all[k] ?? null;
  }

  if (!conv || !conv.turns) return null;
  if (isStale(conv.updatedAt)) {
    // Limpieza on-read: dejar la clave en estado "vacío" para que el siguiente
    // appendTurn parta de cero.
    await resetConversation(channel, senderId);
    return null;
  }
  return conv;
}

/**
 * Empuja un turno a la conversación, recortando texto a MAX_CHARS y la
 * ventana a WINDOW (los más antiguos se eliminan). Devuelve la conversación
 * actualizada. Idempotente respecto a `name` (solo lo actualiza si llega uno).
 */
export async function appendTurn(
  channel: ConversationChannel,
  senderId: string,
  role: TurnRole,
  text: string,
  name?: string,
): Promise<Conversation> {
  if (!senderId) {
    return {
      channel,
      senderId: "",
      turns: [],
      updatedAt: new Date().toISOString(),
    };
  }
  const k = key(channel, senderId);

  let conv: Conversation | null;
  if (USE_SUPABASE) {
    conv = await readOneSupabase(k);
  } else {
    const all = await readAllLocal();
    conv = all[k] ?? null;
  }

  // Si está stale, partir de cero
  if (conv && isStale(conv.updatedAt)) conv = null;

  const base: Conversation = conv ?? {
    channel,
    senderId,
    turns: [],
    updatedAt: new Date().toISOString(),
  };

  const next: Conversation = {
    ...base,
    name: name || base.name,
    turns: [
      ...base.turns,
      { role, text: truncate(text), ts: new Date().toISOString() },
    ].slice(-WINDOW),
    updatedAt: new Date().toISOString(),
  };

  if (USE_SUPABASE) {
    await writeOneSupabase(k, next);
  } else {
    const all = await readAllLocal();
    all[k] = next;
    await writeAllLocal(all);
  }
  return next;
}

/**
 * Borra la conversación de este sender (útil para tests / reset manual).
 */
export async function resetConversation(
  channel: ConversationChannel,
  senderId: string,
): Promise<void> {
  if (!senderId) return;
  const k = key(channel, senderId);
  if (USE_SUPABASE) {
    await deleteOneSupabase(k);
  } else {
    const all = await readAllLocal();
    delete all[k];
    await writeAllLocal(all);
  }
}

/**
 * Helpers de introspección (no usado por los webhooks, útil para tests/debug).
 */
export const __config = { WINDOW, TTL_HOURS, MAX_CHARS };
