// Presupuestos de tratamiento — el modelo que faltaba.
//
// En una clínica dental se pierde mucho dinero en el hueco entre "el paciente
// dice que sí" y "el tratamiento se hace". Nadie hace ese seguimiento porque no
// había dónde apuntarlo: este es ese sitio.
//
// Ciclo: dado → aceptado → ejecutado. Y dos salidas: descartado (el paciente
// dice que no) o simplemente que se quede parado, que es lo que hay que evitar.
//
// Aislamiento: todo va por `tenantId`. Un presupuesto pertenece a un negocio y a
// uno solo; no hay ninguna función que devuelva presupuestos de varios tenants.

import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";
import { logEvent, makeEventId } from "./event-log";
import { sendWhatsAppTemplate } from "./whatsapp-sender";

export type EstadoPresupuesto = "dado" | "aceptado" | "ejecutado" | "descartado";

export type Presupuesto = {
  id: string;
  tenantId: string;
  paciente: { nombre: string; telefono: string };
  concepto: string;            // "Implante unitario", "Ortodoncia invisible"…
  importeEUR?: number;         // opcional: no todas las clínicas quieren guardarlo
  estado: EstadoPresupuesto;
  creadoEn: string;            // cuando se dio el presupuesto
  aceptadoEn?: string;
  ejecutadoEn?: string;
  descartadoEn?: string;
  nota?: string;
  /** Cuándo se le recordó por última vez, para no agobiar. */
  recordadoEn?: string;
  /** Cuántas veces se le ha recordado. Hay un tope. */
  recordatorios: number;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "presupuestos.json");
const KV_PREFIX = "presupuestos:";

type Mapa = Record<string, Presupuesto[]>;   // tenantId → presupuestos

async function leerTodos(tenantId: string): Promise<Presupuesto[]> {
  if (supabaseEnabled()) {
    return (await kvGet<Presupuesto[]>(KV_PREFIX + tenantId)) ?? [];
  }
  try {
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    const todo = raw.trim() ? (JSON.parse(raw) as Mapa) : {};
    return todo[tenantId] ?? [];
  } catch {
    return [];
  }
}

async function guardarTodos(tenantId: string, lista: Presupuesto[]): Promise<void> {
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

/** Presupuestos de UN tenant. Nunca devuelve los de otro. */
export async function listarPresupuestos(tenantId: string): Promise<Presupuesto[]> {
  const l = await leerTodos(tenantId);
  return [...l].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export async function crearPresupuesto(input: {
  tenantId: string;
  paciente: { nombre: string; telefono: string };
  concepto: string;
  importeEUR?: number;
  nota?: string;
}): Promise<Presupuesto> {
  const p: Presupuesto = {
    id: `pres_${crypto.randomUUID().slice(0, 8)}`,
    tenantId: input.tenantId,
    paciente: input.paciente,
    concepto: input.concepto,
    importeEUR: input.importeEUR,
    nota: input.nota,
    estado: "dado",
    creadoEn: new Date().toISOString(),
    recordatorios: 0,
  };
  const lista = await leerTodos(input.tenantId);
  lista.push(p);
  await guardarTodos(input.tenantId, lista);

  await logEvent(input.tenantId, {
    id: makeEventId("presupuesto_creado", p.id),
    type: "presupuesto_creado",
    channel: "dashboard",
    senderId: p.paciente.telefono,
    meta: { presupuestoId: p.id, concepto: p.concepto, importeEUR: p.importeEUR },
  }).catch(() => {});

  return p;
}

/** Cambia el estado y deja el evento correspondiente. Devuelve null si no existe. */
export async function cambiarEstado(
  tenantId: string,
  id: string,
  estado: EstadoPresupuesto,
): Promise<Presupuesto | null> {
  const lista = await leerTodos(tenantId);
  const p = lista.find((x) => x.id === id);
  if (!p) return null;

  const ahora = new Date().toISOString();
  p.estado = estado;
  if (estado === "aceptado") p.aceptadoEn = ahora;
  if (estado === "ejecutado") p.ejecutadoEn = ahora;
  if (estado === "descartado") p.descartadoEn = ahora;
  await guardarTodos(tenantId, lista);

  const tipo =
    estado === "aceptado" ? "presupuesto_aceptado"
    : estado === "ejecutado" ? "presupuesto_ejecutado"
    : null;
  if (tipo) {
    await logEvent(tenantId, {
      id: makeEventId(tipo, p.id),
      type: tipo,
      channel: "dashboard",
      senderId: p.paciente.telefono,
      meta: { presupuestoId: p.id, concepto: p.concepto, importeEUR: p.importeEUR },
    }).catch(() => {});
  }
  return p;
}

export async function borrarPresupuesto(tenantId: string, id: string): Promise<boolean> {
  const lista = await leerTodos(tenantId);
  const fuera = lista.filter((x) => x.id !== id);
  if (fuera.length === lista.length) return false;
  await guardarTodos(tenantId, fuera);
  return true;
}

/** Marca que se le ha recordado (para no repetir antes de tiempo). */
export async function marcarRecordado(tenantId: string, id: string): Promise<void> {
  const lista = await leerTodos(tenantId);
  const p = lista.find((x) => x.id === id);
  if (!p) return;
  p.recordadoEn = new Date().toISOString();
  p.recordatorios += 1;
  await guardarTodos(tenantId, lista);
  await logEvent(tenantId, {
    id: makeEventId("presupuesto_recordado", p.id, String(p.recordatorios)),
    type: "presupuesto_recordado",
    channel: "pablo",
    senderId: p.paciente.telefono,
    meta: { presupuestoId: p.id, intento: p.recordatorios },
  }).catch(() => {});
}

// -----------------------------------------------------------------------------
// A quién toca recordarle
// -----------------------------------------------------------------------------

/** Días desde una fecha ISO. */
function diasDesde(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

export const DIAS_PARA_RECORDAR = 15;   // desde que se dio, si no ha respondido
export const DIAS_ENTRE_RECORDATORIOS = 30;
export const MAX_RECORDATORIOS = 2;     // dos y se para: más es acoso

export type PresupuestoPendiente = Presupuesto & { diasDesdeQueSeDio: number };

// -----------------------------------------------------------------------------
// El recordatorio por WhatsApp
// -----------------------------------------------------------------------------

/** OFF por defecto: se calcula y se ve en el panel, pero no escribe a nadie. */
export function presupuestosSendEnabled(): boolean {
  return (process.env.PRESUPUESTOS_SEND_ENABLED || "").toLowerCase() === "true";
}

/**
 * Igual que en el recall: un recordatorio de presupuesto llega semanas después,
 * o sea SIEMPRE fuera de la ventana de 24 h de WhatsApp, y ahí Meta solo deja
 * pasar plantillas aprobadas. Sin `PRESUPUESTOS_TEMPLATE` no se intenta enviar
 * texto libre que Meta va a rechazar: se devuelve `sin_plantilla` y se ve tal
 * cual en el panel.
 */
function plantillaPresupuesto(): string | null {
  return process.env.PRESUPUESTOS_TEMPLATE || null;
}

export type ResultadoRecordatorio = {
  id: string;
  telefono: string;
  enviado: boolean;
  modo: "enviado" | "flag_off" | "sin_plantilla" | "sin_credenciales" | "sin_telefono" | "error";
  detalle?: string;
};

/** Texto del recordatorio. Se ofrece fecha, no se presiona. */
export function textoRecordatorio(p: Presupuesto, negocio: string): string {
  const nombre = p.paciente.nombre ? p.paciente.nombre.split(" ")[0] : "";
  const saludo = nombre ? `Hola ${nombre}` : "Hola";
  return (
    `${saludo}, te escribimos de ${negocio}. ` +
    `Tienes pendiente el presupuesto de ${p.concepto}. ` +
    `Si quieres que le busquemos fecha, dime qué días te vienen bien. ` +
    `Y si prefieres dejarlo, dínoslo también y no te molestamos más.`
  );
}

/**
 * Recuerda un presupuesto y lo marca. Solo marca si el mensaje SALIÓ: si no,
 * el paciente seguirá saliendo mañana como pendiente, que es lo correcto.
 */
export async function avisarPresupuesto(
  tenantId: string,
  p: Presupuesto,
  negocio: string,
): Promise<ResultadoRecordatorio> {
  const base = { id: p.id, telefono: p.paciente.telefono };
  if (!p.paciente.telefono) return { ...base, enviado: false, modo: "sin_telefono" };
  if (!presupuestosSendEnabled()) return { ...base, enviado: false, modo: "flag_off" };

  const plantilla = plantillaPresupuesto();
  if (!plantilla) {
    return {
      ...base,
      enviado: false,
      modo: "sin_plantilla",
      detalle: "Falta PRESUPUESTOS_TEMPLATE: fuera de la ventana de 24 h WhatsApp exige plantilla aprobada.",
    };
  }

  try {
    const r = await sendWhatsAppTemplate(
      p.paciente.telefono,
      plantilla,
      process.env.PRESUPUESTOS_TEMPLATE_LANG || "es",
      [p.paciente.nombre || "hola", negocio, p.concepto],
    );
    if (!r.ok) {
      return {
        ...base,
        enviado: false,
        modo: r.reason === "missing_credentials" ? "sin_credenciales" : "error",
        detalle: r.detail,
      };
    }
  } catch (e) {
    return { ...base, enviado: false, modo: "error", detalle: e instanceof Error ? e.message : "error" };
  }

  await marcarRecordado(tenantId, p.id);
  return { ...base, enviado: true, modo: "enviado" };
}

// -----------------------------------------------------------------------------
// El KPI: presupuestos convertidos
// -----------------------------------------------------------------------------

/**
 * Cuántos de los presupuestos aceptados se han llegado a hacer.
 *
 * Devuelve null si la clínica todavía no ha apuntado ningún presupuesto: ahí no
 * es que no convierta, es que no hay nada que medir.
 */
export async function conversionPresupuestos(
  tenantId: string,
): Promise<{ ejecutados: number; total: number; pendientes: number } | null> {
  const lista = await listarPresupuestos(tenantId);
  if (!lista.length) return null;
  const vivos = lista.filter((p) => p.estado !== "descartado");
  if (!vivos.length) return null;
  return {
    ejecutados: vivos.filter((p) => p.estado === "ejecutado").length,
    total: vivos.length,
    pendientes: vivos.filter((p) => p.estado === "dado" || p.estado === "aceptado").length,
  };
}

/**
 * Presupuestos que merecen un recordatorio hoy.
 *
 * Se recuerda al que sigue en "dado" (ni aceptado ni descartado) pasados
 * DIAS_PARA_RECORDAR, y al "aceptado" que no se ha ejecutado. Nunca más de
 * MAX_RECORDATORIOS veces ni antes de DIAS_ENTRE_RECORDATORIOS desde el último.
 */
export async function presupuestosPendientes(tenantId: string): Promise<PresupuestoPendiente[]> {
  const lista = await listarPresupuestos(tenantId);
  return lista
    .filter((p) => {
      if (p.estado === "ejecutado" || p.estado === "descartado") return false;
      if (p.recordatorios >= MAX_RECORDATORIOS) return false;
      if (p.recordadoEn && diasDesde(p.recordadoEn) < DIAS_ENTRE_RECORDATORIOS) return false;
      const referencia = p.estado === "aceptado" ? p.aceptadoEn || p.creadoEn : p.creadoEn;
      return diasDesde(referencia) >= DIAS_PARA_RECORDAR;
    })
    .map((p) => ({ ...p, diasDesdeQueSeDio: diasDesde(p.creadoEn) }));
}
