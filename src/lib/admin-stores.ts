// Los dos cajones sueltos del panel de administración: las evaluaciones
// nocturnas y las reservas que llegan por el webhook de Cal.com.
//
// POR QUÉ EXISTE ESTE ARCHIVO
// ---------------------------
// Los dos escribían en `/tmp/aiteam-data/…json`, y cada uno tenía su propia
// copia de la función de leer y escribir. En Vercel `/tmp` vive y muere con la
// función, así que:
//
//   · el evaluador nocturno guardaba sus notas donde nadie las volvía a leer;
//   · una reserva de Cal.com se perdía entre que entraba y alguien abría el
//     panel, y el panel enseñaba una lista vacía sin decir que estaba vacía
//     porque se hubiera borrado.
//
// Ahora los dos van por Supabase, con el fichero local como respaldo de
// desarrollo, y el panel lee por la MISMA puerta por la que se escribe.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";

const DATA_DIR = path.join(process.cwd(), "data");

export type EvalResult = {
  ts: string;
  email: string;
  agent: string;
  userMessage: string;
  agentResponse: string;
  score: number; // 1-10
  reasoning: string;
};

/** La forma que escribe el webhook de Cal.com. No se toca: el panel la pinta así. */
export type CalBooking = {
  uid: string;
  trigger: string;
  receivedAt: string;
  payload: Record<string, unknown>;
};

const MAX_EVALS = 1000;
const MAX_BOOKINGS = 500;

async function leer<T>(kvKey: string, fichero: string): Promise<T[]> {
  if (supabaseEnabled()) return (await kvGet<T[]>(kvKey)) ?? [];
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, fichero), "utf-8")) as T[];
  } catch {
    return [];
  }
}

async function escribir<T>(kvKey: string, fichero: string, filas: T[]): Promise<void> {
  if (supabaseEnabled()) {
    await kvSet(kvKey, filas);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, fichero), JSON.stringify(filas, null, 2));
}

// --- Evaluaciones nocturnas ---------------------------------------------------

export async function leerEvals(): Promise<EvalResult[]> {
  return leer<EvalResult>("evals", "evals.json");
}

export async function anadirEvals(nuevas: EvalResult[]): Promise<void> {
  if (!nuevas.length) return;
  const todas = [...(await leerEvals()), ...nuevas].slice(-MAX_EVALS);
  await escribir("evals", "evals.json", todas);
}

// --- Reservas de Cal.com ------------------------------------------------------

export async function leerCalBookings(): Promise<CalBooking[]> {
  return leer<CalBooking>("calendar:bookings", "calendar-bookings.json");
}

export async function anadirCalBooking(b: CalBooking): Promise<void> {
  const todas = await leerCalBookings();
  // El webhook de Cal.com reintenta; con el uid y el disparador no se apunta
  // dos veces la misma reserva.
  if (b.uid && todas.some((x) => x.uid === b.uid && x.trigger === b.trigger)) return;
  await escribir("calendar:bookings", "calendar-bookings.json", [...todas, b].slice(-MAX_BOOKINGS));
}

export async function guardarCalBookings(filas: CalBooking[]): Promise<void> {
  await escribir("calendar:bookings", "calendar-bookings.json", filas.slice(-MAX_BOOKINGS));
}
