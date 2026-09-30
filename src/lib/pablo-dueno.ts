// ÓRDENES DE LA DUEÑA A PABLO POR WHATSAPP.
//
// Solo desde SU número (`ownerWhatsapp` del tenant). Cualquier otro número que
// escriba "para todo" es una clienta más: nunca se le obedece.
//
//   «para con Laura» / «para con 600111222» → Pablo deja de contestar a esa
//       clienta hasta «sigue con Laura» o 24 h.
//   «para todo» → Pablo no contesta a nadie hasta «sigue» o 24 h.
//   «sigue» / «sigue con …» → vuelve.
//   «mueve la cita de Laura al jueves a las 12» → pregunta antes («¿la muevo…?
//       contesta sí o no») y solo al «sí» la mueve con el motor de siempre.
//
// Mientras está en pausa, los mensajes de la clienta se siguen guardando en el
// panel: la dueña los ve y contesta ella.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";
import { getTenant } from "./tenants";
import { getBusinessByTenant, listRecords, reprogramarRecord, getRecord, type BookingRecord } from "./booking";
import { normalizarFecha, PASADO } from "./fecha-es";
import { esSi, esNo } from "./chat-honesto";
import { cuandoHablado } from "./guion-huecos";

const REDIRECT = "https://aiteam.marketing/api/lucia/callback";
const DIA_MS = 24 * 3600_000;
const cola9 = (t: string) => (t || "").replace(/\D/g, "").slice(-9);
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

type Estado = {
  global?: number; // hasta cuándo (epoch ms)
  clientes: Record<string, { hasta: number; nombre?: string }>; // cola9 → pausa
  mover?: { recordId: string; nuevoIso: string; ts: number };
};

const FICHERO = path.join(process.cwd(), "data", "pablo-pausas.json");
const clave = (t: string) => `pablo-pausas:${t}`;
async function leer(tenantId: string): Promise<Estado> {
  let e: Estado | null = null;
  if (supabaseEnabled()) e = await kvGet<Estado>(clave(tenantId));
  else { try { e = (JSON.parse(await fs.readFile(FICHERO, "utf-8")) as Record<string, Estado>)[clave(tenantId)] ?? null; } catch { e = null; } }
  return e ?? { clientes: {} };
}
async function guardar(tenantId: string, e: Estado): Promise<void> {
  if (supabaseEnabled()) { await kvSet(clave(tenantId), e); return; }
  let m: Record<string, Estado> = {};
  try { m = JSON.parse(await fs.readFile(FICHERO, "utf-8")); } catch { /* vacío */ }
  m[clave(tenantId)] = e;
  await fs.mkdir(path.dirname(FICHERO), { recursive: true });
  const tmp = `${FICHERO}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(m, null, 2));
  await fs.rename(tmp, FICHERO);
}

/** ¿Este número es el de la dueña de este negocio? Comparación exacta por los 9 últimos dígitos. */
export async function esDuena(tenantId: string, from: string): Promise<boolean> {
  const t = await getTenant(tenantId);
  const o = cola9(t?.ownerWhatsapp || "");
  return o.length === 9 && o === cola9(from);
}

/** ¿Tiene Pablo que callarse con este número ahora? */
export async function pabloEnPausa(tenantId: string, from: string, ahora = Date.now()): Promise<boolean> {
  const e = await leer(tenantId);
  if (e.global && e.global > ahora) return true;
  const c = e.clientes[cola9(from)];
  return !!c && c.hasta > ahora;
}

/** Clientas (por teléfono) que encajan con "Laura" o "600111222" en la agenda del negocio. */
async function buscarClienta(tenantId: string, quien: string): Promise<{ telefono: string; nombre: string }[]> {
  const q = norm(quien);
  const dig = q.replace(/\D/g, "");
  if (dig.length >= 9) return [{ telefono: dig, nombre: quien }];
  const neg = await getBusinessByTenant(tenantId);
  if (!neg) return [];
  const vistas = new Map<string, string>();
  for (const r of await listRecords()) {
    if (r.slug !== neg.slug || r.tipo === "bloqueo" || !r.cliente?.telefono) continue;
    const n = norm(r.cliente.nombre || "");
    if (n && (n === q || n.split(/\s+/)[0] === q || n.includes(q))) vistas.set(cola9(r.cliente.telefono), r.cliente.nombre);
  }
  return [...vistas].map(([telefono, nombre]) => ({ telefono, nombre }));
}

async function citaFuturaDe(tenantId: string, quien: string): Promise<BookingRecord[]> {
  const neg = await getBusinessByTenant(tenantId);
  if (!neg) return [];
  const q = norm(quien);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: neg.timezone || "Europe/Madrid" });
  return (await listRecords())
    .filter((r) => r.slug === neg.slug && r.tipo !== "bloqueo" && (r.estado === "confirmada" || r.estado === "pendiente") && r.startIso.slice(0, 10) >= hoy)
    .filter((r) => { const n = norm(r.cliente?.nombre || ""); return n === q || n.split(/\s+/)[0] === q || n.includes(q) || (q.replace(/\D/g, "").length >= 9 && cola9(r.cliente.telefono) === cola9(q)); })
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}

/**
 * Si el mensaje de la dueña es una orden, la cumple y devuelve la respuesta.
 * Si no es una orden, null (y Pablo le contesta como siempre).
 */
export async function ordenDeLaDuena(tenantId: string, texto: string, ahora = Date.now()): Promise<string | null> {
  const t = norm(texto);
  const e = await leer(tenantId);

  // Confirmación pendiente de «mueve la cita…»
  if (e.mover && ahora - e.mover.ts < DIA_MS && (esSi(texto) || esNo(texto))) {
    const m = e.mover;
    delete e.mover;
    await guardar(tenantId, e);
    if (esNo(texto)) return "Vale, no la muevo.";
    const r = await getRecord(m.recordId);
    if (!r) return "No encuentro esa cita.";
    const res = await reprogramarRecord(m.recordId, m.nuevoIso, undefined, REDIRECT, r.slug);
    if (res.ok) return `Hecho: la cita de ${r.cliente.nombre} ya está ${cuandoHablado(m.nuevoIso)}.`;
    return res.reason === "slot_taken" ? `No la he movido: ${cuandoHablado(m.nuevoIso)} está ocupado.` : "No la he podido mover ahora mismo.";
  }

  if (/^para todo\b|^pausa todo\b|^parate\b|^para$/.test(t)) {
    e.global = ahora + DIA_MS;
    await guardar(tenantId, e);
    return "Vale, dejo de contestar a todo el mundo. Escríbeme «sigue» para volver (si no, vuelvo solo en 24 h).";
  }
  if (/^sigue$|^sigue todo\b|^vuelve\b|^reanuda\b/.test(t)) {
    e.global = undefined;
    e.clientes = {};
    await guardar(tenantId, e);
    return "Vuelvo a contestar a todo el mundo.";
  }
  let m = t.match(/^para con (.+)$/);
  if (m) {
    const qs = await buscarClienta(tenantId, m[1]);
    if (!qs.length) return `No encuentro a «${m[1]}» en la agenda. Dime su teléfono.`;
    if (qs.length > 1) return `Hay varias: ${qs.map((c) => `${c.nombre} (…${c.telefono.slice(-3)})`).join(", ")}. Dime el teléfono.`;
    e.clientes[cola9(qs[0].telefono)] = { hasta: ahora + DIA_MS, nombre: qs[0].nombre };
    await guardar(tenantId, e);
    return `Vale, no contesto a ${qs[0].nombre} hasta que me digas «sigue con ${m[1]}» (o en 24 h).`;
  }
  m = t.match(/^sigue con (.+)$/);
  if (m) {
    const qs = await buscarClienta(tenantId, m[1]);
    for (const c of qs) delete e.clientes[cola9(c.telefono)];
    await guardar(tenantId, e);
    return qs.length ? `Vuelvo a contestar a ${qs[0].nombre}.` : `No tenía en pausa a «${m[1]}».`;
  }
  m = texto.match(/^\s*mueve la cita de\s+(.+?)\s+(?:a|al|para)\s+(.+)$/i);
  if (m) {
    const citas = await citaFuturaDe(tenantId, m[1]);
    if (!citas.length) return `No veo ninguna cita futura de «${m[1]}».`;
    if (citas.length > 1) return `${m[1]} tiene ${citas.length} citas; dime cuál (fecha) o muévela desde la agenda.`;
    const r = citas[0];
    const nuevo = normalizarFecha(m[2], { fechaBase: r.startIso });
    if (nuevo === PASADO || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(nuevo)) return "No entiendo el día y la hora nuevos. Dímelo así: «mueve la cita de Laura al jueves a las 12».";
    e.mover = { recordId: r.id, nuevoIso: nuevo.slice(0, 19), ts: ahora };
    await guardar(tenantId, e);
    return `¿Muevo la cita de ${r.cliente.nombre} (${r.servicioNombre}, ${cuandoHablado(r.startIso)}) a ${cuandoHablado(nuevo)}? Contesta sí o no.`;
  }
  return null;
}
