// =============================================================================
// Sesión de ruteo de WhatsApp por número.
// =============================================================================
//
// Pablo y Marta (y Rocío) comparten el mismo número de WhatsApp y un único
// webhook. Para que, una vez que un agente abre un flujo con un cliente, sus
// respuestas SIGUIENTES sigan yendo a ESE agente (y no se "escapen" a Pablo si
// el clasificador falla o la propuesta deja de estar pending), guardamos una
// "sesión de ruteo" por número:
//
//   wa-route:<numero>  →  { agent, refId?, openedAt, expiresAt }
//
// El webhook la consulta ANTES de nada: si está activa, el mensaje va directo
// al handler de ese agente. Se abre al mandar/regenerar una propuesta, se
// refresca en cada interacción, y se cierra al publicar / rechazar / por TTL.
//
// Storage: Supabase kv si está configurado; fallback a fichero local
// data/wa-routes.json en dev.
// =============================================================================

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";

export type RouteAgent = "marta" | "rocio";

export type WaRoute = {
  numero: string;
  agent: RouteAgent;
  refId?: string;       // id de la propuesta asociada, si aplica
  openedAt: string;     // ISO
  expiresAt: number;    // epoch ms
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "wa-routes.json");
const DEFAULT_TTL_MIN = 120; // 2 h

function ttlMs(): number {
  const raw = parseInt(process.env.WA_ROUTE_TTL_MIN || "", 10);
  const min = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 24 * 60) : DEFAULT_TTL_MIN;
  return min * 60 * 1000;
}

function kvKey(numero: string): string {
  return `wa-route:${numero}`;
}

// -----------------------------------------------------------------------------
// Backend (Supabase / fichero local)
// -----------------------------------------------------------------------------
async function readLocal(): Promise<Record<string, WaRoute>> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    return raw.trim() ? (JSON.parse(raw) as Record<string, WaRoute>) : {};
  } catch {
    return {};
  }
}

async function writeLocal(map: Record<string, WaRoute>): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(map, null, 2));
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

/** Abre o refresca la sesión de ruteo de un número hacia un agente. */
export async function openRoute(numero: string, agent: RouteAgent, refId?: string): Promise<void> {
  const route: WaRoute = {
    numero,
    agent,
    refId,
    openedAt: new Date().toISOString(),
    expiresAt: Date.now() + ttlMs(),
  };
  if (supabaseEnabled()) {
    await kvSet(kvKey(numero), route);
    return;
  }
  const map = await readLocal();
  map[kvKey(numero)] = route;
  await writeLocal(map);
}

/** Devuelve la sesión activa (no caducada) de un número, o null. */
export async function getRoute(numero: string): Promise<WaRoute | null> {
  let route: WaRoute | null = null;
  if (supabaseEnabled()) {
    route = (await kvGet<WaRoute>(kvKey(numero))) ?? null;
  } else {
    const map = await readLocal();
    route = map[kvKey(numero)] ?? null;
  }
  if (!route) return null;
  if (route.expiresAt < Date.now()) {
    await closeRoute(numero);
    return null;
  }
  return route;
}

/** Refresca el TTL de la sesión activa (si existe) sin cambiar de agente. */
export async function touchRoute(numero: string): Promise<void> {
  const r = await getRoute(numero);
  if (r) await openRoute(numero, r.agent, r.refId);
}

/** Cierra la sesión de ruteo de un número (flujo terminado). */
export async function closeRoute(numero: string): Promise<void> {
  if (supabaseEnabled()) {
    // No hay delete en el wrapper kv; lo marcamos caducado.
    await kvSet(kvKey(numero), {
      numero,
      agent: "marta",
      openedAt: new Date(0).toISOString(),
      expiresAt: 0,
    } satisfies WaRoute);
    return;
  }
  const map = await readLocal();
  delete map[kvKey(numero)];
  await writeLocal(map);
}
