// Leads de una clínica ESTÉTICA — el modelo que en dental no hace falta.
//
// La diferencia de fondo con dental: allí el paciente ya sabe que viene y lo
// único que falta es ponerle hora. Aquí no. Aquí alguien pregunta por
// Instagram o por WhatsApp, hay que CUALIFICARLE (qué tratamiento, para
// cuándo, si ya se ha informado en otro sitio) y llevarle a una valoración
// presencial, que es donde se decide de verdad. Ese recorrido —de "ha
// preguntado" a "tiene valoración puesta"— no vivía en ninguna parte: se
// perdía en el hilo del chat.
//
// ESTO NO ES `pipeline.ts`. Aquel es el CRM comercial de AI-Team para captar
// clientes de AI-Team (etapas "client"/"lost", leads de la web). Esto son los
// leads DEL NEGOCIO DEL CLIENTE, por tenant, y no se mezclan nunca.
//
// Aislamiento: todo va por `tenantId`. No hay ninguna función que devuelva
// leads de varios tenants a la vez.

import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, kvTryLock, kvUnlock, supabaseEnabled } from "./supabase";
import { logEvent, makeEventId } from "./event-log";

// Los estados y sus rótulos viven en un módulo PURO aparte porque la cola de
// leads (componente de cliente) los necesita y este fichero es `server-only`.
// Se reexportan para que quien ya importa de aquí no tenga que cambiar.
export { ESTADOS_LEAD, ETIQUETA_ESTADO } from "./estetica-leads-tipos";
export type { EstadoLead } from "./estetica-leads-tipos";
import type { EstadoLead } from "./estetica-leads-tipos";

export type Lead = {
  id: string;
  tenantId: string;
  nombre: string;
  telefono: string;
  /** @usuario de Instagram, si vino por ahí. Un lead de IG puede no tener teléfono. */
  instagram?: string;
  tratamientoInteres?: string;
  estado: EstadoLead;
  /** Tratamiento concreto + plazo cercano: lo que hay que coger HOY. */
  caliente: boolean;
  motivoCaliente?: string;
  creadoEn: string;
  /** Última vez que se le escribió o se le llamó DESDE la clínica. */
  ultimoContactoEn?: string;
  nota?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "estetica-leads.json");
const KV_PREFIX = "estetica-leads:";

type Mapa = Record<string, Lead[]>; // tenantId → leads

async function leerCrudos(tenantId: string): Promise<Lead[]> {
  if (supabaseEnabled()) {
    return (await kvGet<Lead[]>(KV_PREFIX + tenantId)) ?? [];
  }
  try {
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    const todo = raw.trim() ? (JSON.parse(raw) as Mapa) : {};
    return todo[tenantId] ?? [];
  } catch {
    return [];
  }
}

async function guardarTodos(tenantId: string, lista: Lead[]): Promise<void> {
  if (supabaseEnabled()) {
    await kvSet(KV_PREFIX + tenantId, lista);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
  const todo = raw.trim() ? (JSON.parse(raw) as Mapa) : {};
  todo[tenantId] = lista;
  await fs.writeFile(FILE, JSON.stringify(todo, null, 2));
}

// -----------------------------------------------------------------------------
// Bloqueo por tenant — DESDE EL PRIMER DÍA, no "ya lo añadiremos"
// -----------------------------------------------------------------------------
// Este módulo guarda "todos los leads del tenant" en una sola clave, así que
// cada escritura es leer-todo → modificar → guardar-todo. Sin candado, dos
// peticiones cercanas (el webhook de Pablo apuntando un lead mientras el dueño
// le cambia el estado desde el chat del panel) se pisan: la segunda relee lo de
// ANTES y su guardado se lleva por delante lo que acababa de entrar. Es
// exactamente la escritura perdida que ya se cazó en `presupuestos.ts`, y este
// módulo nace con el mismo remedio: mutex en memoria (sirve dentro de esta
// instancia) + `kvTryLock`/`kvUnlock` como candado distribuido best-effort,
// igual que `withSlotMutex` en `orchestrator.ts`.
const inflight = new Map<string, Promise<unknown>>();

function withTenantMutex<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  const key = `estetica-leads:${tenantId}`;
  const prev = inflight.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  inflight.set(key, run.catch(() => undefined));
  run.catch(() => undefined).finally(() => {
    if (inflight.get(key) === undefined) inflight.delete(key);
  });
  return run;
}

async function conBloqueo<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return withTenantMutex(tenantId, async () => {
    const lockKey = `lock:estetica-leads:${tenantId}`;
    let tengoLock = await kvTryLock(lockKey, 5_000, "estetica-leads");
    if (!tengoLock) {
      await new Promise((r) => setTimeout(r, 250));
      tengoLock = await kvTryLock(lockKey, 5_000, "estetica-leads");
    }
    try {
      return await fn();
    } finally {
      if (tengoLock) await kvUnlock(lockKey);
    }
  });
}

// El mutex es una COLA, no reentrante: la versión sin candado propio es la que
// se llama desde dentro de un `conBloqueo(...)` ya abierto. Llamar a `leerTodos`
// dentro de otro `conBloqueo` del mismo tenant bloquearía para siempre.
async function leerTodosInterno(tenantId: string): Promise<Lead[]> {
  return leerCrudos(tenantId);
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}
function horasDesde(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 3_600_000);
}

/** Un caliente al que no se le ha contestado en este tiempo sigue contando como sin contestar. */
export const HORAS_SIN_CONTESTAR = 24;

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/** La clave por la que se reconoce a alguien que ya escribió: teléfono, o @usuario. */
function claveDe(l: { telefono?: string; instagram?: string }): string {
  const tel = (l.telefono || "").replace(/\D/g, "");
  if (tel) return `tel:${tel}`;
  const ig = norm(l.instagram || "");
  return ig ? `ig:${ig}` : "";
}

// -----------------------------------------------------------------------------
// Lectura
// -----------------------------------------------------------------------------

/** Leads de UN tenant, el más reciente primero. Nunca devuelve los de otro. */
export async function listarLeads(tenantId: string): Promise<Lead[]> {
  const lista = await conBloqueo(tenantId, () => leerTodosInterno(tenantId));
  return [...lista].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export async function obtenerLead(tenantId: string, id: string): Promise<Lead | null> {
  const lista = await listarLeads(tenantId);
  return lista.find((l) => l.id === id) ?? null;
}

/** Busca por nombre, teléfono o @usuario, para el chat: "el lead de Marta". */
export async function buscarLeads(tenantId: string, texto: string): Promise<Lead[]> {
  const q = norm(texto);
  if (!q) return [];
  const digitos = (texto || "").replace(/\D/g, "");
  const lista = await listarLeads(tenantId);
  return lista.filter(
    (l) =>
      norm(l.nombre).includes(q) ||
      norm(l.instagram || "").includes(q) ||
      norm(l.tratamientoInteres || "").includes(q) ||
      (!!digitos && l.telefono.replace(/\D/g, "").includes(digitos)),
  );
}

export type LeadCaliente = Lead & { horasEsperando: number };

/**
 * A quién hay que contestar YA: leads marcados como calientes que siguen sin
 * respuesta — nunca contactados, o contactados hace más de un día sin que la
 * cosa se haya movido de sitio.
 *
 * Los que ya tienen valoración puesta y los descartados NO salen: ahí ya hay
 * respuesta, o ya se decidió que no la va a haber.
 */
export async function leadsCalientesSinContestar(tenantId: string): Promise<LeadCaliente[]> {
  const lista = await listarLeads(tenantId);
  return lista
    .filter((l) => {
      if (!l.caliente) return false;
      if (l.estado === "cita_puesta" || l.estado === "descartado") return false;
      if (!l.ultimoContactoEn) return true;
      return horasDesde(l.ultimoContactoEn) >= HORAS_SIN_CONTESTAR;
    })
    .map((l) => ({ ...l, horasEsperando: horasDesde(l.ultimoContactoEn || l.creadoEn) }))
    .sort((a, b) => b.horasEsperando - a.horasEsperando);
}

// -----------------------------------------------------------------------------
// Escritura
// -----------------------------------------------------------------------------

export type EntradaLead = {
  tenantId: string;
  nombre?: string;
  telefono?: string;
  instagram?: string;
  tratamientoInteres?: string;
  caliente?: boolean;
  motivoCaliente?: string;
  nota?: string;
  estado?: EstadoLead;
};

/**
 * Apunta un lead. Si ya existe alguien con el mismo teléfono (o el mismo
 * @usuario), NO se duplica: se completa lo que faltaba y se sube la
 * temperatura si ahora está caliente. Una persona que escribe tres veces es un
 * lead, no tres.
 *
 * Devuelve el lead y si era nuevo, para que quien llama sepa si avisar.
 */
export async function registrarLead(entrada: EntradaLead): Promise<{ lead: Lead; nuevo: boolean }> {
  const ahora = new Date().toISOString();
  const clave = claveDe(entrada);

  const r = await conBloqueo(entrada.tenantId, async () => {
    const lista = await leerTodosInterno(entrada.tenantId);
    const existente = clave ? lista.find((l) => claveDe(l) === clave) : undefined;

    if (existente) {
      if (entrada.nombre?.trim() && !existente.nombre.trim()) existente.nombre = entrada.nombre.trim();
      if (entrada.telefono?.trim() && !existente.telefono.trim()) existente.telefono = entrada.telefono.trim();
      if (entrada.instagram?.trim() && !existente.instagram) existente.instagram = entrada.instagram.trim();
      if (entrada.tratamientoInteres?.trim()) existente.tratamientoInteres = entrada.tratamientoInteres.trim();
      if (entrada.nota?.trim()) existente.nota = entrada.nota.trim();
      // La temperatura solo sube sola. Enfriar un lead es una decisión del
      // dueño (cambiarle el estado), no algo que decida un mensaje suelto.
      if (entrada.caliente) {
        existente.caliente = true;
        if (entrada.motivoCaliente?.trim()) existente.motivoCaliente = entrada.motivoCaliente.trim();
      }
      if (entrada.estado) existente.estado = entrada.estado;
      await guardarTodos(entrada.tenantId, lista);
      return { lead: existente, nuevo: false };
    }

    const lead: Lead = {
      id: `lead_${crypto.randomUUID().slice(0, 8)}`,
      tenantId: entrada.tenantId,
      nombre: entrada.nombre?.trim() || "",
      telefono: entrada.telefono?.trim() || "",
      instagram: entrada.instagram?.trim() || undefined,
      tratamientoInteres: entrada.tratamientoInteres?.trim() || undefined,
      estado: entrada.estado ?? "nuevo",
      caliente: !!entrada.caliente,
      motivoCaliente: entrada.motivoCaliente?.trim() || undefined,
      creadoEn: ahora,
      nota: entrada.nota?.trim() || undefined,
    };
    lista.push(lead);
    await guardarTodos(entrada.tenantId, lista);
    return { lead, nuevo: true };
  });

  if (r.nuevo) {
    await logEvent(entrada.tenantId, {
      id: makeEventId("lead_estetica_creado", r.lead.id),
      type: "lead_estetica_creado",
      channel: "dashboard",
      senderId: r.lead.telefono || r.lead.instagram,
      meta: { leadId: r.lead.id, tratamiento: r.lead.tratamientoInteres, caliente: r.lead.caliente },
    }).catch(() => {});
  }
  return r;
}

/** Cambia el estado de un lead. Devuelve null si no existe en ESTE tenant. */
export async function cambiarEstadoLead(
  tenantId: string,
  id: string,
  estado: EstadoLead,
): Promise<Lead | null> {
  const lead = await conBloqueo(tenantId, async () => {
    const lista = await leerTodosInterno(tenantId);
    const encontrado = lista.find((l) => l.id === id);
    if (!encontrado) return null;
    encontrado.estado = estado;
    // Cualquier movimiento a mano cuenta como contacto: el dueño ha hecho algo
    // con este lead, así que deja de estar "sin contestar".
    if (estado !== "nuevo") encontrado.ultimoContactoEn = new Date().toISOString();
    await guardarTodos(tenantId, lista);
    return encontrado;
  });
  if (!lead) return null;

  await logEvent(tenantId, {
    id: makeEventId("lead_estetica_estado", lead.id, estado),
    type: "lead_estetica_estado",
    channel: "dashboard",
    senderId: lead.telefono || lead.instagram,
    meta: { leadId: lead.id, estado },
  }).catch(() => {});
  return lead;
}

/** Deja constancia de que se le ha escrito/llamado. No cambia el estado. */
export async function marcarContactado(tenantId: string, id: string): Promise<Lead | null> {
  return conBloqueo(tenantId, async () => {
    const lista = await leerTodosInterno(tenantId);
    const encontrado = lista.find((l) => l.id === id);
    if (!encontrado) return null;
    encontrado.ultimoContactoEn = new Date().toISOString();
    if (encontrado.estado === "nuevo") encontrado.estado = "contactado";
    await guardarTodos(tenantId, lista);
    return encontrado;
  });
}

export async function borrarLead(tenantId: string, id: string): Promise<boolean> {
  return conBloqueo(tenantId, async () => {
    const lista = await leerTodosInterno(tenantId);
    const fuera = lista.filter((l) => l.id !== id);
    if (fuera.length === lista.length) return false;
    await guardarTodos(tenantId, fuera);
    return true;
  });
}

// -----------------------------------------------------------------------------
// Los dos KPIs de estética
// -----------------------------------------------------------------------------

/**
 * Leads nuevos de ESTE mes natural.
 *
 * Devuelve null si la clínica no tiene ni un lead apuntado: ahí no es que no
 * lleguen, es que todavía no hay nada que medir, y un cero diría "no funciona".
 * En cuanto hay uno —aunque sea de otro mes— el KPI empieza a contar de verdad,
 * aunque el mes en curso vaya a 0.
 */
export async function leadsDelMes(tenantId: string): Promise<number | null> {
  const lista = await listarLeads(tenantId);
  if (!lista.length) return null;
  const mes = new Date().toISOString().slice(0, 7);
  return lista.filter((l) => l.creadoEn.slice(0, 7) === mes).length;
}

/**
 * Cuántos de los leads captados llegan a valoración: "4 de 17".
 *
 * Los descartados SIGUEN contando en el total a propósito: son leads que
 * llegaron y no cuajaron, y esconderlos inflaría la conversión.
 */
export async function conversionAValoracion(
  tenantId: string,
): Promise<{ conValoracion: number; total: number } | null> {
  const lista = await listarLeads(tenantId);
  if (!lista.length) return null;
  return {
    conValoracion: lista.filter((l) => l.estado === "cita_puesta").length,
    total: lista.length,
  };
}

/**
 * Leads todavía en juego: ni descartados ni con la valoración ya puesta. Es el
 * KPI "En seguimiento".
 *
 * Null si no hay ninguno apuntado, por el mismo motivo que los otros dos: un
 * cero diría "se han caído todos" y lo que pasa es que no ha empezado.
 */
export async function leadsAbiertos(tenantId: string): Promise<number | null> {
  const lista = await listarLeads(tenantId);
  if (!lista.length) return null;
  return lista.filter((l) => l.estado === "nuevo" || l.estado === "contactado").length;
}

/** Días que lleva abierto un lead, para pintarlo en la cola. */
export function diasAbierto(l: Lead): number {
  return diasDesde(l.creadoEn);
}

// -----------------------------------------------------------------------------
// El enganche con los agentes
// -----------------------------------------------------------------------------

/**
 * El marcador que Pablo y Marta ya insertan al final de su respuesta cuando
 * detectan un lead cualificado: `[🎯 Lead cualificado: {resumen}]` (ver el
 * prompt en `claude.ts`). Estaba escrito desde el principio y NADIE lo leía:
 * se enviaba al cliente final dentro del mensaje y se perdía.
 */
const PATRON_MARCADOR = /\[\s*🎯?\s*Lead cualificado\s*:\s*([^\]]*)\]/i;

/** ¿La respuesta del agente trae el marcador? Devuelve el resumen si sí. */
export function detectarLeadCualificado(respuesta: string): string | null {
  const m = PATRON_MARCADOR.exec(respuesta || "");
  if (!m) return null;
  return (m[1] || "").trim() || "Lead cualificado";
}

/**
 * Quita el marcador del texto que de verdad llega al cliente. Es de uso
 * interno: el prompt se lo pide al modelo, pero nadie fuera de la clínica
 * tiene que verlo escrito en su WhatsApp.
 */
export function quitarMarcadorLeadCualificado(respuesta: string): string {
  return (respuesta || "").replace(PATRON_MARCADOR, "").trim();
}

/**
 * Apunta (o actualiza) el lead que acaba de detectar un agente. NO interrumpe
 * nada: el agente sigue su conversación igual, esto solo deja constancia para
 * que la pestaña "Leads y valoraciones" y el chat del panel puedan enseñar a
 * quién hay que coger hoy. Mismo criterio que `marcarUrgencia` en dental.
 */
export async function marcarLeadCualificado(
  tenantId: string,
  input: { telefono?: string; instagram?: string; nombre?: string; resumen: string; canal: "pablo" | "marta" },
): Promise<void> {
  if (!input.telefono && !input.instagram) return;
  const { lead } = await registrarLead({
    tenantId,
    nombre: input.nombre,
    telefono: input.telefono,
    instagram: input.instagram,
    caliente: true,
    motivoCaliente: input.resumen.slice(0, 300),
  });
  await logEvent(tenantId, {
    id: makeEventId("lead_estetica_cualificado", lead.id, new Date().toISOString().slice(0, 13)),
    type: "lead_estetica_cualificado",
    channel: input.canal,
    senderId: input.telefono || input.instagram,
    meta: { leadId: lead.id, resumen: input.resumen.slice(0, 300) },
  }).catch(() => {});
}
