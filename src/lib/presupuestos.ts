// Presupuestos de tratamiento — el modelo que faltaba.
//
// En una clínica dental se pierde mucho dinero en el hueco entre "el paciente
// dice que sí" y "el tratamiento se hace". Nadie hace ese seguimiento porque no
// había dónde apuntarlo: este es ese sitio.
//
// Estados: pendiente → aceptado | rechazado. Y uno pasivo, caducado: un
// pendiente que lleva demasiado tiempo sin respuesta deja de contar como
// "en marcha" — no es que se haya rechazado, es que nadie ha dicho nada, y
// esas dos cosas no pueden sonar igual en el panel.
//
// Aislamiento: todo va por `tenantId`. Un presupuesto pertenece a un negocio y a
// uno solo; no hay ninguna función que devuelva presupuestos de varios tenants.

import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, kvTryLock, kvUnlock, supabaseEnabled } from "./supabase";
import { logEvent, makeEventId } from "./event-log";
import { sendWhatsAppTemplate } from "./whatsapp-sender";

export type EstadoPresupuesto = "pendiente" | "aceptado" | "rechazado" | "caducado";
export const ESTADOS_PRESUPUESTO: EstadoPresupuesto[] = ["pendiente", "aceptado", "rechazado", "caducado"];

export type Presupuesto = {
  id: string;
  tenantId: string;
  paciente: { nombre: string; telefono: string };
  concepto: string;            // "Implante unitario", "Ortodoncia invisible"…
  importeEUR?: number;         // opcional: no todas las clínicas quieren guardarlo
  estado: EstadoPresupuesto;
  creadoEn: string;            // cuando se dio el presupuesto
  aceptadoEn?: string;
  rechazadoEn?: string;
  caducadoEn?: string;
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

async function leerCrudos(tenantId: string): Promise<Presupuesto[]> {
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

// -----------------------------------------------------------------------------
// Bloqueo por tenant — sin esto, "leer todos → modificar → guardar todos" es una
// escritura perdida en cuanto dos peticiones caen cerca (el chat confirmando un
// presupuesto a la vez que el panel refresca, o dos mensajes seguidos): la
// segunda relee el fichero de ANTES de que la primera escribiera, y su guardado
// se lleva por delante lo que acababa de entrar. Así se perdió de verdad un
// presupuesto en pruebas (creadoEn con id incluido en la respuesta del chat,
// "Hecho", pero nunca llegó a `data/presupuestos.json`). Mismo patrón que
// `withSlotMutex` en `orchestrator.ts`: mutex en memoria (sirve solo dentro de
// esta instancia) + `kvTryLock`/`kvUnlock` como candado distribuido best-effort
// para cuando hay Supabase detrás y puede haber más de una instancia.
const inflight = new Map<string, Promise<unknown>>();

function withTenantMutex<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  const key = `presupuestos:${tenantId}`;
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
    const lockKey = `lock:presupuestos:${tenantId}`;
    let tengoLockDistribuido = await kvTryLock(lockKey, 5_000, "presupuestos");
    // Best-effort: si otra instancia lo tiene, se espera un poco y se sigue de
    // todas formas — perder la escritura es peor que una carrera rarísima entre
    // dos instancias distintas en el mismo segundo.
    if (!tengoLockDistribuido) {
      await new Promise((r) => setTimeout(r, 250));
      tengoLockDistribuido = await kvTryLock(lockKey, 5_000, "presupuestos");
    }
    try {
      return await fn();
    } finally {
      if (tengoLockDistribuido) await kvUnlock(lockKey);
    }
  });
}

/** Días desde una fecha ISO. */
function diasDesde(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

/** Un pendiente sin respuesta pasados estos días deja de contar como "en marcha". */
export const DIAS_PARA_CADUCAR = 45;

/**
 * Caduca en memoria (y persiste si algo cambió) los pendientes que llevan
 * demasiado tiempo sin respuesta. Se hace AL LEER, no con un cron aparte: es
 * el mismo criterio de "limpieza on-read" que ya usa `conversation-store.ts`
 * en este proyecto — no hace falta un job en segundo plano para un dato que
 * de todas formas nadie mira hasta que abre el panel o el chat pregunta.
 */
// Versión SIN bloqueo propio: solo se llama desde dentro de un `conBloqueo(...)`
// ya abierto (el de una lectura suelta, o el de una de las funciones que
// escriben más abajo). Llamarla dos veces anidadas con el mismo tenant
// bloquearía para siempre — el mutex en memoria es una cola, no reentrante.
async function leerTodosInterno(tenantId: string): Promise<Presupuesto[]> {
  const lista = await leerCrudos(tenantId);
  let tocado = false;
  const ahora = new Date().toISOString();
  for (const p of lista) {
    if (p.estado === "pendiente" && diasDesde(p.creadoEn) >= DIAS_PARA_CADUCAR) {
      p.estado = "caducado";
      p.caducadoEn = ahora;
      tocado = true;
    }
  }
  if (tocado) await guardarTodos(tenantId, lista);
  return lista;
}

async function leerTodos(tenantId: string): Promise<Presupuesto[]> {
  return conBloqueo(tenantId, () => leerTodosInterno(tenantId));
}

/** Presupuestos de UN tenant. Nunca devuelve los de otro. */
export async function listarPresupuestos(tenantId: string): Promise<Presupuesto[]> {
  const l = await leerTodos(tenantId);
  return [...l].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export async function obtenerPresupuesto(tenantId: string, id: string): Promise<Presupuesto | null> {
  const lista = await leerTodos(tenantId);
  return lista.find((p) => p.id === id) ?? null;
}

/** Busca por nombre o teléfono, para el chat: "el presupuesto de María". */
export async function buscarPresupuestos(tenantId: string, texto: string): Promise<Presupuesto[]> {
  const q = texto.trim().toLowerCase();
  if (!q) return [];
  const lista = await leerTodos(tenantId);
  return lista.filter(
    (p) => p.paciente.nombre.toLowerCase().includes(q) || p.paciente.telefono.includes(q) || p.concepto.toLowerCase().includes(q),
  );
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
    estado: "pendiente",
    creadoEn: new Date().toISOString(),
    recordatorios: 0,
  };
  await conBloqueo(input.tenantId, async () => {
    const lista = await leerTodosInterno(input.tenantId);
    lista.push(p);
    await guardarTodos(input.tenantId, lista);
  });

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
  const p = await conBloqueo(tenantId, async () => {
    const lista = await leerTodosInterno(tenantId);
    const encontrado = lista.find((x) => x.id === id);
    if (!encontrado) return null;

    const ahora = new Date().toISOString();
    encontrado.estado = estado;
    if (estado === "aceptado") encontrado.aceptadoEn = ahora;
    if (estado === "rechazado") encontrado.rechazadoEn = ahora;
    if (estado === "caducado") encontrado.caducadoEn = ahora;
    await guardarTodos(tenantId, lista);
    return encontrado;
  });
  if (!p) return null;

  const tipo = estado === "aceptado" ? "presupuesto_aceptado" : estado === "rechazado" ? "presupuesto_rechazado" : null;
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
  return conBloqueo(tenantId, async () => {
    const lista = await leerTodosInterno(tenantId);
    const fuera = lista.filter((x) => x.id !== id);
    if (fuera.length === lista.length) return false;
    await guardarTodos(tenantId, fuera);
    return true;
  });
}

/** Marca que se le ha recordado (para no repetir antes de tiempo). */
export async function marcarRecordado(tenantId: string, id: string): Promise<void> {
  const p = await conBloqueo(tenantId, async () => {
    const lista = await leerTodosInterno(tenantId);
    const encontrado = lista.find((x) => x.id === id);
    if (!encontrado) return null;
    encontrado.recordadoEn = new Date().toISOString();
    encontrado.recordatorios += 1;
    await guardarTodos(tenantId, lista);
    return encontrado;
  });
  if (!p) return;
  await logEvent(tenantId, {
    id: makeEventId("presupuesto_recordado", p.id, String(p.recordatorios)),
    type: "presupuesto_recordado",
    channel: "pablo",
    senderId: p.paciente.telefono,
    meta: { presupuestoId: p.id, intento: p.recordatorios },
  }).catch(() => {});
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
 * Cuántos de los presupuestos dados se han llegado a aceptar.
 *
 * Devuelve null si la clínica todavía no ha apuntado ningún presupuesto: ahí no
 * es que no convierta, es que no hay nada que medir. En cuanto hay uno —aunque
 * siga "pendiente"— el KPI deja de salir con guion y empieza a contar de
 * verdad, aunque sea 0 de 1.
 */
export async function conversionPresupuestos(
  tenantId: string,
): Promise<{ aceptados: number; total: number; pendientes: number } | null> {
  const lista = await listarPresupuestos(tenantId);
  if (!lista.length) return null;
  return {
    aceptados: lista.filter((p) => p.estado === "aceptado").length,
    total: lista.length,
    pendientes: lista.filter((p) => p.estado === "pendiente").length,
  };
}

/**
 * Presupuestos que merecen un recordatorio hoy.
 *
 * Se recuerda al que sigue "pendiente" pasados DIAS_PARA_RECORDAR. Nunca más
 * de MAX_RECORDATORIOS veces ni antes de DIAS_ENTRE_RECORDATORIOS desde el
 * último. Aceptados, rechazados y caducados no se recuerdan: ya hay
 * respuesta, o ya no la va a haber a tiempo.
 */
export async function presupuestosPendientes(tenantId: string): Promise<PresupuestoPendiente[]> {
  const lista = await listarPresupuestos(tenantId);
  return lista
    .filter((p) => {
      if (p.estado !== "pendiente") return false;
      if (p.recordatorios >= MAX_RECORDATORIOS) return false;
      if (p.recordadoEn && diasDesde(p.recordadoEn) < DIAS_ENTRE_RECORDATORIOS) return false;
      return diasDesde(p.creadoEn) >= DIAS_PARA_RECORDAR;
    })
    .map((p) => ({ ...p, diasDesdeQueSeDio: diasDesde(p.creadoEn) }));
}
