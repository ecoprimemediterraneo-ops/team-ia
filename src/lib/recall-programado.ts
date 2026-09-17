// "Programar" un aviso de revisión: el dentista decide que a este paciente le
// va a avisar más adelante (una fecha concreta), en vez de ahora mismo. No es
// un envío ni un recordatorio automático — es una nota visible en la propia
// pantalla, para no tener que acordarse de memoria.
//
// Guardado por tenant+clave del paciente, igual que `presupuestos.ts` y el
// resto del proyecto: Supabase si hay, fichero local en `data/` si no.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";

export type ProgramacionRevision = { fecha: string; nota?: string; programadoEn: string };

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "recall-programado.json");
const KV_PREFIX = "recall-programado:";

type Mapa = Record<string, ProgramacionRevision>; // clave del paciente → programación

async function leer(tenantId: string): Promise<Mapa> {
  if (supabaseEnabled()) {
    return (await kvGet<Mapa>(KV_PREFIX + tenantId)) ?? {};
  }
  try {
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    const todo = raw.trim() ? (JSON.parse(raw) as Record<string, Mapa>) : {};
    return todo[tenantId] ?? {};
  } catch {
    return {};
  }
}

async function guardar(tenantId: string, mapa: Mapa): Promise<void> {
  if (supabaseEnabled()) {
    await kvSet(KV_PREFIX + tenantId, mapa);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
  const todo = raw.trim() ? (JSON.parse(raw) as Record<string, Mapa>) : {};
  todo[tenantId] = mapa;
  await fs.writeFile(FILE, JSON.stringify(todo, null, 2));
}

export async function programarAviso(tenantId: string, clave: string, fecha: string, nota?: string): Promise<void> {
  const mapa = await leer(tenantId);
  mapa[clave] = { fecha, nota, programadoEn: new Date().toISOString() };
  await guardar(tenantId, mapa);
}

export async function quitarProgramacion(tenantId: string, clave: string): Promise<void> {
  const mapa = await leer(tenantId);
  delete mapa[clave];
  await guardar(tenantId, mapa);
}

/** Todas las programaciones del tenant, por clave de paciente. */
export async function listarProgramaciones(tenantId: string): Promise<Record<string, ProgramacionRevision>> {
  return leer(tenantId);
}
