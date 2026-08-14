// Remitentes importantes: qué correos saltan a la vista en una gestoría.
//
// LA REGLA QUE MANDA SOBRE TODO LO DEMÁS: aquí NO se decide qué es importante
// leyendo el correo. Se decide MIRANDO QUIÉN LO MANDA, contra una lista que el
// gestor ve y edita. Un modelo que "interpreta" urgencia falla en silencio y no
// hay forma de auditarlo; una lista de remitentes se abre, se lee y se corrige.
//
// Y la segunda regla, igual de dura: esto MARCA y ORDENA. No borra, no archiva,
// no oculta y no filtra. Un correo que no casa con nada sigue en la bandeja,
// exactamente donde estaba.

import "server-only";
import path from "path";
import { promises as fs } from "fs";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";

export type NivelAviso = "critico" | "importante";

export type RemitenteImportante = {
  id: string;
  /** Dominio (`agenciatributaria.es`) o dirección exacta (`avisos@banco.es`). */
  patron: string;
  /** Lo que se pinta en la etiqueta: "Hacienda", "Juzgados", "Banco"… */
  etiqueta: string;
  nivel: NivelAviso;
  /** true = vino de la precarga. El gestor lo puede borrar igual. */
  oficial?: boolean;
};

// -----------------------------------------------------------------------------
// Precarga
// -----------------------------------------------------------------------------
//
// Solo administración pública española, y solo dominios de los que hay
// certeza. NO se precargan bancos a propósito: cada oficina notifica desde un
// dominio distinto y meter `banco.es` a ciegas marcaría como importante toda su
// publicidad. Esos los añade el gestor, que sabe cuál es el suyo.
//
// Es un PUNTO DE PARTIDA, no una verdad: la pantalla de gestión dice
// claramente que se puede quitar y añadir lo que se quiera.

export const REMITENTES_OFICIALES: Omit<RemitenteImportante, "id">[] = [
  // Crítico: lo que abre un plazo o un procedimiento contra el cliente.
  { patron: "agenciatributaria.es", etiqueta: "Hacienda", nivel: "critico", oficial: true },
  { patron: "agenciatributaria.gob.es", etiqueta: "Hacienda", nivel: "critico", oficial: true },
  { patron: "seg-social.es", etiqueta: "Seguridad Social", nivel: "critico", oficial: true },
  { patron: "seg-social.gob.es", etiqueta: "Seguridad Social", nivel: "critico", oficial: true },
  { patron: "justicia.es", etiqueta: "Juzgados", nivel: "critico", oficial: true },
  { patron: "poderjudicial.es", etiqueta: "Juzgados", nivel: "critico", oficial: true },
  { patron: "dehu.redsara.es", etiqueta: "Notificaciones oficiales", nivel: "critico", oficial: true },
  { patron: "notificaciones.060.es", etiqueta: "Notificaciones oficiales", nivel: "critico", oficial: true },
  // Importante: administración que conviene no perder de vista.
  { patron: "administracion.gob.es", etiqueta: "Administración", nivel: "importante", oficial: true },
  { patron: "sepe.es", etiqueta: "SEPE", nivel: "importante", oficial: true },
  { patron: "mites.gob.es", etiqueta: "Trabajo", nivel: "importante", oficial: true },
  { patron: "sedecatastro.gob.es", etiqueta: "Catastro", nivel: "importante", oficial: true },
  { patron: "catastro.meh.es", etiqueta: "Catastro", nivel: "importante", oficial: true },
  { patron: "registradores.org", etiqueta: "Registro Mercantil", nivel: "importante", oficial: true },
  { patron: "boe.es", etiqueta: "BOE", nivel: "importante", oficial: true },
];

// -----------------------------------------------------------------------------
// Almacén — una clave por tenant, como el resto del sistema
// -----------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const FICHERO = path.join(DATA_DIR, "lucia-remitentes.json");
const KEY = (t: string) => `lucia:remitentes:${t}`;

async function leerLocal(tenantId: string): Promise<RemitenteImportante[] | null> {
  try {
    const raw = await fs.readFile(FICHERO, "utf-8").catch(() => "");
    if (!raw.trim()) return null;
    const all = JSON.parse(raw) as Record<string, RemitenteImportante[]>;
    return all[tenantId] ?? null;
  } catch {
    return null;
  }
}

async function escribirLocal(tenantId: string, lista: RemitenteImportante[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(FICHERO, "utf-8").catch(() => "");
  const all = raw.trim() ? (JSON.parse(raw) as Record<string, RemitenteImportante[]>) : {};
  all[tenantId] = lista;
  await fs.writeFile(FICHERO, JSON.stringify(all, null, 2));
}

const nuevoId = () => `rem_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Normaliza un patrón: minúsculas, sin espacios, sin `@` suelto ni `www.`. */
export function normalizarPatron(p: string): string {
  const limpio = (p || "").trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  return limpio.startsWith("@") ? limpio.slice(1) : limpio;
}

/**
 * La lista del tenant. Si nunca se ha tocado, devuelve la precarga oficial —
 * pero SIN guardarla: así, el día que se añada un dominio nuevo a la precarga,
 * los tenants que no han editado nada lo reciben.
 */
export async function listarRemitentes(tenantId: string): Promise<RemitenteImportante[]> {
  const guardada = supabaseEnabled()
    ? await kvGet<RemitenteImportante[]>(KEY(tenantId))
    : await leerLocal(tenantId);
  if (guardada) return guardada;
  return REMITENTES_OFICIALES.map((r, i) => ({ ...r, id: `oficial_${i}` }));
}

async function guardar(tenantId: string, lista: RemitenteImportante[]): Promise<void> {
  if (supabaseEnabled()) return kvSet(KEY(tenantId), lista);
  return escribirLocal(tenantId, lista);
}

export async function anadirRemitente(
  tenantId: string,
  datos: { patron: string; etiqueta: string; nivel: NivelAviso },
): Promise<RemitenteImportante[]> {
  const patron = normalizarPatron(datos.patron);
  if (!patron) throw new Error("Falta el dominio o la dirección");
  const lista = await listarRemitentes(tenantId);
  // Repetir un patrón no rompe nada, pero pintaría dos etiquetas iguales.
  if (lista.some((r) => r.patron === patron)) return lista;
  const siguiente = [
    ...lista,
    {
      id: nuevoId(),
      patron,
      etiqueta: (datos.etiqueta || "").trim() || "Importante",
      nivel: datos.nivel === "critico" ? "critico" : "importante",
    } as RemitenteImportante,
  ];
  await guardar(tenantId, siguiente);
  return siguiente;
}

export async function editarRemitente(
  tenantId: string,
  id: string,
  cambios: { etiqueta?: string; nivel?: NivelAviso; patron?: string },
): Promise<RemitenteImportante[]> {
  const lista = await listarRemitentes(tenantId);
  const siguiente = lista.map((r) =>
    r.id !== id
      ? r
      : {
          ...r,
          patron: cambios.patron !== undefined ? normalizarPatron(cambios.patron) || r.patron : r.patron,
          etiqueta: cambios.etiqueta !== undefined ? cambios.etiqueta.trim() || r.etiqueta : r.etiqueta,
          nivel: cambios.nivel ?? r.nivel,
        },
  );
  await guardar(tenantId, siguiente);
  return siguiente;
}

export async function borrarRemitente(tenantId: string, id: string): Promise<RemitenteImportante[]> {
  const lista = await listarRemitentes(tenantId);
  const siguiente = lista.filter((r) => r.id !== id);
  await guardar(tenantId, siguiente);
  return siguiente;
}

/** Vuelve a la precarga oficial, por si el gestor se lía borrando. */
export async function restaurarOficiales(tenantId: string): Promise<RemitenteImportante[]> {
  const lista = REMITENTES_OFICIALES.map((r, i) => ({ ...r, id: `oficial_${i}` }));
  await guardar(tenantId, lista);
  return lista;
}

// -----------------------------------------------------------------------------
// Marcado
// -----------------------------------------------------------------------------

/** Saca `pepe@dominio.es` de `Pepe <pepe@dominio.es>`. */
export function direccionDe(from: string): string {
  const m = (from || "").match(/<([^>]+)>/);
  return (m ? m[1] : from || "").trim().toLowerCase();
}

const dominioDe = (dir: string) => dir.split("@")[1] ?? "";

/**
 * ¿Casa este remitente con esta entrada?
 *
 * Con `@` se compara la dirección entera; sin `@`, el dominio y TODOS sus
 * subdominios (`notificaciones.agenciatributaria.es` casa con
 * `agenciatributaria.es`). El sufijo se compara con el punto delante para que
 * `noagenciatributaria.es` no cuele.
 */
export function casaCon(from: string, patron: string): boolean {
  const dir = direccionDe(from);
  if (!dir) return false;
  const p = normalizarPatron(patron);
  if (!p) return false;
  if (p.includes("@")) return dir === p;
  const dom = dominioDe(dir);
  return dom === p || dom.endsWith(`.${p}`);
}

export type Marca = { etiqueta: string; nivel: NivelAviso; patron: string };

/**
 * Devuelve la marca del remitente, o null si no está en la lista.
 *
 * Si casan varias entradas gana la crítica, y a igualdad el patrón más largo
 * (el más específico): una dirección exacta debe poder pisar a su dominio.
 */
export function clasificarRemitente(from: string, lista: RemitenteImportante[]): Marca | null {
  const candidatas = lista.filter((r) => casaCon(from, r.patron));
  if (!candidatas.length) return null;
  const mejor = candidatas.sort((a, b) => {
    if (a.nivel !== b.nivel) return a.nivel === "critico" ? -1 : 1;
    return b.patron.length - a.patron.length;
  })[0];
  return { etiqueta: mejor.etiqueta, nivel: mejor.nivel, patron: mejor.patron };
}

/**
 * Ordena: críticos, importantes y después el resto.
 *
 * NO quita nada. La lista que entra y la que sale tienen los mismos correos,
 * y dentro de cada grupo se respeta el orden original de Gmail (por fecha).
 */
export function ordenarPorAviso<T extends { marca?: Marca | null }>(mensajes: T[]): T[] {
  const peso = (m: T) => (m.marca?.nivel === "critico" ? 0 : m.marca?.nivel === "importante" ? 1 : 2);
  return mensajes
    .map((m, i) => ({ m, i }))
    .sort((a, b) => peso(a.m) - peso(b.m) || a.i - b.i)
    .map((x) => x.m);
}

/** Los patrones críticos, para preguntarle a Gmail solo por ellos. */
export const patronesCriticos = (lista: RemitenteImportante[]): string[] =>
  lista.filter((r) => r.nivel === "critico").map((r) => r.patron);
