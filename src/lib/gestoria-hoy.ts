// La lista de hoy: lo que el gestor tiene que hacer, en el orden que importa.
//
// NO ES UNA AGENDA. Una agenda enseña lo que apuntaste; esto enseña lo que ha
// entrado solo —un WhatsApp de un cliente, un correo con fecha límite, una
// factura sin dueño, un cargo sin justificar— más lo que Jose apunte a mano.
//
// EL ORDEN ES LO QUE SE VENDE
// ---------------------------
// Manda la FECHA LÍMITE LEGAL, no el orden de llegada. Una plusvalía que vence
// mañana va por encima de un ticket que un cliente pidió la semana pasada para
// una garantía. Eso es exactamente lo que un gestor con cincuenta clientes no
// puede hacer de cabeza, y por lo que paga.
//
// Y por encima del cálculo manda Jose: si dice que algo es urgente, sube. El
// sistema ordena; no discute.
//
// LAS TAREAS NO SE GUARDAN DOS VECES
// ----------------------------------
// Lo que ya vive en otro sitio —el vencimiento de un expediente, la factura sin
// asignar, el cargo sin justificar— se DERIVA en cada lectura, no se copia. Una
// copia se queda vieja: el gestor asigna la factura y la tarea seguiría ahí
// diciéndole que la asigne. Solo se guarda lo que no tiene otro dueño: lo que
// Jose apunta y las marcas de "hecho" y "urgente".

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";
import { listarExpedientes, tramiteById } from "./gestoria";
import { listarFacturas, listarMovimientos } from "./gestoria-facturas";
import { listarClientes } from "./gestoria-clientes";

export type OrigenTarea =
  | "expediente"
  | "factura_sin_asignar"
  | "cargo_sin_justificar"
  | "correo"
  | "whatsapp"
  | "manual";

export type Tarea = {
  id: string;
  titulo: string;
  detalle?: string;
  clienteId?: string | null;
  clienteNombre?: string | null;
  /** "AAAA-MM-DD". Sin fecha = no tiene plazo legal, va al final. */
  vence?: string | null;
  origen: OrigenTarea;
  /** Lo ha marcado Jose. Manda sobre el cálculo. */
  urgente?: boolean;
  hecho?: boolean;
  hechoEn?: string;
  creadoEn: string;
};

/** Lo único que se guarda: lo apuntado a mano y las marcas sobre lo derivado. */
type Estado = {
  manuales: Tarea[];
  hechos: Record<string, string>;   // id → cuándo
  urgentes: Record<string, true>;
};

const CLAVE = (t: string) => `gestoria:tareas:${t}`;
const FICHERO = path.join(process.cwd(), "data", "gestoria-tareas.json");
const VACIO: Estado = { manuales: [], hechos: {}, urgentes: {} };

async function leerEstado(tenantId: string): Promise<Estado> {
  if (supabaseEnabled()) return (await kvGet<Estado>(CLAVE(tenantId))) ?? VACIO;
  try {
    const todo = JSON.parse(await fs.readFile(FICHERO, "utf-8")) as Record<string, Estado>;
    return todo[tenantId] ?? VACIO;
  } catch {
    return VACIO;
  }
}

async function guardarEstado(tenantId: string, e: Estado): Promise<void> {
  if (supabaseEnabled()) { await kvSet(CLAVE(tenantId), e); return; }
  await fs.mkdir(path.dirname(FICHERO), { recursive: true });
  let todo: Record<string, Estado> = {};
  try { todo = JSON.parse(await fs.readFile(FICHERO, "utf-8")); } catch { /* primera vez */ }
  todo[tenantId] = e;
  await fs.writeFile(FICHERO, JSON.stringify(todo, null, 2));
}

// -----------------------------------------------------------------------------
// Fechas. Todo en día natural de Madrid: "vence mañana" no puede depender de la
// hora a la que se mire la pantalla.
// -----------------------------------------------------------------------------

export function hoyMadrid(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

/** Días que faltan. Negativo = ya ha vencido. null = no tiene plazo. */
export function diasHasta(vence?: string | null): number | null {
  if (!vence) return null;
  const a = Date.parse(`${hoyMadrid()}T00:00:00Z`);
  const b = Date.parse(`${vence}T00:00:00Z`);
  if (Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Rojo SOLO lo que vence hoy o mañana y no está hecho —y lo ya vencido—.
 *
 * Al revés de lo que se suele hacer, y a propósito: si todo va en rojo, el rojo
 * deja de significar nada y se deja de mirar la pantalla. El rojo tiene que
 * costar.
 */
export function esRojo(t: Tarea): boolean {
  if (t.hecho) return false;
  const d = diasHasta(t.vence);
  return d !== null && d <= 1;
}

/** A cuántos días avisa: una semana antes, tres días, la víspera y el mismo día. */
export const ESCALONES_AVISO = [7, 3, 1, 0] as const;

export function tocaAvisar(t: Tarea): boolean {
  if (t.hecho) return false;
  const d = diasHasta(t.vence);
  if (d === null) return false;
  // Vencido y sin hacer: se sigue avisando. Un aviso que se calla el día
  // después de vencer es justo el que hacía falta.
  return d < 0 || (ESCALONES_AVISO as readonly number[]).includes(d);
}

// -----------------------------------------------------------------------------
// Las tareas que se derivan de lo que ya hay
// -----------------------------------------------------------------------------

async function derivadas(tenantId: string): Promise<Tarea[]> {
  const out: Tarea[] = [];
  const clientes = await listarClientes(tenantId).catch(() => []);
  const nombreDe = (id?: string | null) => clientes.find((c) => c.id === id)?.nombre ?? null;

  // 1. Expedientes con fecha de vencimiento y sin cerrar.
  for (const e of await listarExpedientes(tenantId).catch(() => [])) {
    if (e.estado === "presentado" || e.estado === "cerrado") continue;
    const tram = tramiteById(e.tramite);
    const faltan = e.documentos.filter((d) => !d.recibido).length;
    out.push({
      id: `exp:${e.id}`,
      titulo: `${tram?.nombre ?? e.tramite}${e.periodo ? ` · ${e.periodo}` : ""}`,
      detalle: faltan ? `Faltan ${faltan} documento(s)` : "En curso",
      clienteId: e.telefono.replace(/\D/g, ""),
      clienteNombre: e.clienteNombre,
      vence: e.vence ?? null,
      origen: "expediente",
      creadoEn: e.creadoEn,
    });
  }

  // 2. Facturas sin dueño. No tienen plazo legal, pero son trabajo parado: hasta
  //    que no se asignan no cuadran con nada.
  for (const f of await listarFacturas(tenantId).catch(() => [])) {
    if (f.estado !== "sin_asignar") continue;
    out.push({
      id: `fac:${f.id}`,
      titulo: `Factura sin asignar: ${f.proveedor ?? f.nombre_original}`,
      detalle: f.remitente ? `Llegó de ${f.remitente}` : undefined,
      clienteId: null,
      clienteNombre: null,
      vence: null,
      origen: "factura_sin_asignar",
      creadoEn: f.fecha_recepcion,
    });
  }

  // 3. Cargos del banco sin justificar, UNA LÍNEA POR CLIENTE.
  //
  // Uno por movimiento ahogaba la lista: en la gestoría de prueba salían 537
  // tareas y las cuatro que tenían fecha legal quedaban sepultadas debajo. Una
  // lista que no se puede leer de un vistazo no es una lista de tareas, es el
  // mismo montón de antes con otro nombre. El detalle movimiento a movimiento
  // ya vive en la pantalla de conciliación, que es donde se trabaja.
  const porCliente = new Map<string, { n: number; suma: number; desde: string }>();
  for (const m of await listarMovimientos(tenantId).catch(() => [])) {
    if (m.signo !== "cargo" || m.estado === "conciliado" || m.estado === "ignorado") continue;
    const k = m.cliente_id ?? "";
    const a = porCliente.get(k) ?? { n: 0, suma: 0, desde: m.fecha };
    porCliente.set(k, {
      n: a.n + 1,
      suma: a.suma + m.importe,
      desde: m.fecha < a.desde ? m.fecha : a.desde,
    });
  }
  for (const [clienteId, d] of porCliente) {
    out.push({
      id: `mov:${clienteId || "sin-cliente"}`,
      titulo: `${d.n} cargo${d.n === 1 ? "" : "s"} del banco sin factura`,
      detalle: `${d.suma.toLocaleString("es-ES", { style: "currency", currency: "EUR" })} en total, desde el ${d.desde}`,
      clienteId: clienteId || null,
      clienteNombre: nombreDe(clienteId) ?? "sin cliente",
      vence: null,
      origen: "cargo_sin_justificar",
      creadoEn: d.desde,
    });
  }

  return out;
}

/**
 * El orden. Lo que decide si esto le sirve a un gestor con cincuenta clientes.
 *
 *   1. Lo que Jose ha marcado urgente.
 *   2. Lo que tiene fecha, por fecha: lo más cercano primero. Lo vencido, antes.
 *   3. Lo que no tiene plazo, al final, y ahí lo más viejo primero.
 *   4. Lo hecho, abajo del todo.
 */
export function ordenar(tareas: Tarea[]): Tarea[] {
  return [...tareas].sort((a, b) => {
    if (!!a.hecho !== !!b.hecho) return a.hecho ? 1 : -1;
    if (!!a.urgente !== !!b.urgente) return a.urgente ? -1 : 1;
    const da = diasHasta(a.vence);
    const db = diasHasta(b.vence);
    if (da === null && db === null) return a.creadoEn.localeCompare(b.creadoEn);
    if (da === null) return 1;
    if (db === null) return -1;
    if (da !== db) return da - db;
    return a.creadoEn.localeCompare(b.creadoEn);
  });
}

export async function listarTareas(tenantId: string): Promise<Tarea[]> {
  const estado = await leerEstado(tenantId);
  const todas = [...(await derivadas(tenantId)), ...estado.manuales];
  return ordenar(
    todas.map((t) => ({
      ...t,
      hecho: !!estado.hechos[t.id] || t.hecho,
      hechoEn: estado.hechos[t.id] ?? t.hechoEn,
      urgente: !!estado.urgentes[t.id] || t.urgente,
    })),
  );
}

/** Lo que obliga a parar: vence hoy o mañana (o ya venció) y sigue sin hacer. */
export async function loQueNoPuedeEsperar(tenantId: string): Promise<Tarea[]> {
  return (await listarTareas(tenantId)).filter(esRojo);
}

export async function apuntarTarea(
  tenantId: string,
  t: { titulo: string; detalle?: string; vence?: string | null; clienteId?: string | null; clienteNombre?: string | null; origen?: OrigenTarea; urgente?: boolean },
): Promise<Tarea> {
  const estado = await leerEstado(tenantId);
  const nueva: Tarea = {
    id: `man:${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    titulo: t.titulo.trim(),
    detalle: t.detalle?.trim() || undefined,
    clienteId: t.clienteId ?? null,
    clienteNombre: t.clienteNombre ?? null,
    vence: t.vence || null,
    origen: t.origen ?? "manual",
    urgente: t.urgente,
    creadoEn: new Date().toISOString(),
  };
  estado.manuales = [...estado.manuales, nueva];
  await guardarEstado(tenantId, estado);
  return nueva;
}

export async function marcarHecho(tenantId: string, id: string, hecho: boolean): Promise<void> {
  const estado = await leerEstado(tenantId);
  if (hecho) estado.hechos[id] = new Date().toISOString();
  else delete estado.hechos[id];
  await guardarEstado(tenantId, estado);
}

export async function marcarUrgente(tenantId: string, id: string, urgente: boolean): Promise<void> {
  const estado = await leerEstado(tenantId);
  if (urgente) estado.urgentes[id] = true;
  else delete estado.urgentes[id];
  await guardarEstado(tenantId, estado);
}

export async function borrarTarea(tenantId: string, id: string): Promise<void> {
  const estado = await leerEstado(tenantId);
  estado.manuales = estado.manuales.filter((t) => t.id !== id);
  delete estado.hechos[id];
  delete estado.urgentes[id];
  await guardarEstado(tenantId, estado);
}

/** Una frase con lo que queda por hacer. Es lo que Pablo le manda por WhatsApp. */
export function resumenDelDia(tareas: Tarea[]): string {
  const vivas = tareas.filter((t) => !t.hecho);
  if (!vivas.length) return "No tienes nada pendiente.";
  const rojas = vivas.filter(esRojo);
  const partes = [`${vivas.length} cosa${vivas.length === 1 ? "" : "s"} pendiente${vivas.length === 1 ? "" : "s"}`];
  if (rojas.length) partes.push(`${rojas.length} para hoy o mañana`);
  return partes.join(", ") + ".";
}
