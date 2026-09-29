// Trabajo DESPUÉS de responder. Carmen esperaba 11 s a que agendar_cita
// terminara de mandar el aviso al dueño, el WhatsApp y el email: nada de eso
// hace falta para decirle al cliente "te la he guardado".
//
// `despuesDeResponder` lanza la tarea y la ata a la petición con `after()` de
// Next (en Vercel mantiene viva la función hasta que acaba). Fuera de una
// petición (pruebas, scripts) la tarea sigue como una promesa normal.
//
// Si la tarea falla, NO se pierde: queda en la cola `aviso:pendiente:*` y la
// pasada del cron de recordatorios (`reintentarPendientes`) la vuelve a intentar.
import { after } from "next/server";
import { kvGet, kvSet, kvDelete, kvListByPrefix, supabaseEnabled } from "./supabase";

export type AvisoPendiente = {
  id: string;
  tipo: "avisos_cita_nueva";
  recordId: string;
  baseUrl?: string;
  sinConfirmacionCliente?: boolean;
  /** Qué partes faltan por salir. */
  faltan: { dueno?: boolean; cliente?: boolean };
  intentos: number;
  desde: string;
  ultimoError?: string;
};

const PREFIJO = "aviso:pendiente:";
const locales = new Map<string, AvisoPendiente>(); // sin Supabase (local/pruebas)
const enCurso = new Set<Promise<unknown>>();

export function despuesDeResponder(nombre: string, tarea: () => Promise<void>): void {
  const p = tarea()
    .catch((e) => console.error(`[segundo-plano] ${nombre} falló:`, e instanceof Error ? e.message : e))
    .finally(() => enCurso.delete(p));
  enCurso.add(p);
  try {
    after(() => p);
  } catch {
    // Fuera de una petición de Next: la promesa ya está en marcha.
  }
}

/** Para pruebas: espera a que acaben las tareas lanzadas. */
export async function esperarSegundoPlano(): Promise<void> {
  while (enCurso.size) await Promise.all([...enCurso]);
}

export async function guardarPendiente(a: AvisoPendiente): Promise<void> {
  if (supabaseEnabled()) await kvSet(PREFIJO + a.id, a);
  else locales.set(a.id, a);
}
export async function quitarPendiente(id: string): Promise<void> {
  if (supabaseEnabled()) await kvDelete(PREFIJO + id);
  else locales.delete(id);
}
export async function listarPendientes(): Promise<AvisoPendiente[]> {
  if (!supabaseEnabled()) return [...locales.values()];
  return (await kvListByPrefix<AvisoPendiente>(PREFIJO)).map((r) => r.value);
}
export async function leerPendiente(id: string): Promise<AvisoPendiente | null> {
  return supabaseEnabled() ? kvGet<AvisoPendiente>(PREFIJO + id) : locales.get(id) ?? null;
}
