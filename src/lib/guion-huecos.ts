// EL GUION CUANDO LA HORA PEDIDA NO ESTÁ LIBRE.
//
// Regla fija, no criterio del modelo (lo usa Pablo por WhatsApp; Carmen y Marta
// reutilizan la búsqueda de huecos):
//
//   1. Nunca se contesta solo "no tengo". Se ofrecen DOS huecos reales, los más
//      cercanos a la hora pedida (mismo servicio, y la misma profesional si la
//      pidió). Reales = salen de `computeFreeSlots`, la misma función que la
//      página de reservas: lo que se ofrece se puede reservar.
//   2. Si el cliente no quiere ninguno, se le pregunta qué días y horas le van
//      bien, y se busca en TODA la semana con eso.
//   3. A la segunda ronda fallida (rechaza también la segunda oferta, o con lo
//      que dice no hay nada), se le manda el enlace de huecos libres para que
//      elija él.
//
// El estado de la conversación (qué se ofreció, cuántas rondas van) se guarda
// por tenant y contacto y caduca a las 24 h, igual que la memoria de la IA.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";
import {
  getBusinessByTenant, computeFreeSlots, resolverServicio, servicioParaTexto, empleadosDeServicio,
  type BusinessBooking, type BookingService, type Empleado,
} from "./booking";

const REDIRECT = "https://aiteam.marketing/api/lucia/callback";
const TTL_MS = 24 * 3600_000;
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// -----------------------------------------------------------------------------
// Buscar huecos
// -----------------------------------------------------------------------------

function sumarDias(f: string, n: number): string {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const minutosDe = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
const diaDe = (iso: string) => iso.slice(0, 10);
const distancia = (a: string, b: string) =>
  Math.abs((Date.parse(`${diaDe(a)}T12:00:00Z`) - Date.parse(`${diaDe(b)}T12:00:00Z`)) / 60_000 + minutosDe(a) - minutosDe(b));

export type Contexto = { negocio: BusinessBooking; servicio?: BookingService; candidatos: (Empleado | undefined)[] };

/** El servicio y quién lo puede hacer. `motivo` es lo que dijo el cliente ("un corte"). */
export async function contextoHuecos(tenantId: string, motivo: string, empleadoId?: string): Promise<Contexto | null> {
  const negocio = await getBusinessByTenant(tenantId);
  if (!negocio) return null;
  const servicio = servicioParaTexto(negocio, motivo || "");
  const staff = (negocio.empleados || []).filter((e) => e.activo);
  let candidatos: (Empleado | undefined)[] = [undefined];
  if (staff.length) {
    const eleg = servicio ? empleadosDeServicio(negocio, servicio.id) : staff;
    candidatos = empleadoId ? eleg.filter((e) => e.id === empleadoId) : eleg;
    if (!candidatos.length) candidatos = eleg;
  }
  return { negocio, servicio, candidatos };
}

/** Huecos libres de un día (unión de las profesionales posibles), ya pasados fuera. */
async function libresDelDia(c: Contexto, fecha: string): Promise<string[]> {
  if (!c.servicio) return [];
  const sel = resolverServicio(c.servicio, {});
  const set = new Set<string>();
  for (const e of c.candidatos) {
    const r = await computeFreeSlots(c.negocio, sel, fecha, REDIRECT, undefined, e?.id).catch(() => null);
    if (r?.ok) r.slots.forEach((s) => set.add(s.slice(0, 19)));
  }
  return [...set].sort();
}

/**
 * Los `n` huecos libres MÁS CERCANOS a la hora pedida: primero el mismo día y
 * los de al lado, y si no alcanza, hasta una semana vista.
 */
export async function huecosCercanos(tenantId: string, opts: { startIso: string; motivo: string; empleadoId?: string; n?: number }): Promise<string[]> {
  const n = opts.n ?? 2;
  const c = await contextoHuecos(tenantId, opts.motivo, opts.empleadoId);
  if (!c) return [];
  const pedido = opts.startIso.slice(0, 19);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: c.negocio.timezone || "Europe/Madrid" });
  const base = diaDe(pedido) < hoy ? hoy : diaDe(pedido);
  const todos: string[] = [];
  for (let i = 0; i < 8; i++) {
    todos.push(...(await libresDelDia(c, sumarDias(base, i))));
    // Con el mismo día y el siguiente ya hay de sobra para elegir los más cercanos.
    if (i >= 1 && todos.length >= n) break;
  }
  return todos
    .filter((s) => s.slice(0, 16) !== pedido.slice(0, 16))
    .sort((a, b) => distancia(a, pedido) - distancia(b, pedido))
    .slice(0, n)
    .sort();
}

export type Preferencia = { dias: number[]; desdeMin?: number; hastaMin?: number };

/**
 * Lo que el cliente dice que le viene bien, leído con reglas (sin IA):
 * días de la semana, "entre semana", "fin de semana", "por la mañana/tarde",
 * "a partir de las 5", "antes de las 12", "a las 6".
 * Devuelve null si no se reconoce nada.
 */
export function leerPreferencia(texto: string): Preferencia | null {
  const t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const dias = new Set<number>();
  const nombres = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  nombres.forEach((d, i) => { if (new RegExp(`\\b${d}s?\\b`).test(t)) dias.add(i); });
  if (/entre semana|de lunes a viernes|laborables?/.test(t)) [1, 2, 3, 4, 5].forEach((d) => dias.add(d));
  if (/fin(es)? de semana/.test(t)) [6, 0].forEach((d) => dias.add(d));
  let desdeMin: number | undefined;
  let hastaMin: number | undefined;
  const h = (x: string) => { let v = parseInt(x, 10); if (v >= 1 && v <= 8) v += 12; return v * 60; };
  if (/(por|de) la(s)? manana|mananas|a primera hora|temprano/.test(t)) { desdeMin = 0; hastaMin = 14 * 60; }
  if (/(por|de) la(s)? tarde|tardes|despues de comer/.test(t)) { desdeMin = 14 * 60; hastaMin = 24 * 60; }
  let m = t.match(/(?:a partir de|desde|despues de|mas tarde de) las? (\d{1,2})(?::(\d{2}))?/);
  if (m) desdeMin = h(m[1]) + (m[2] ? +m[2] : 0);
  m = t.match(/(?:antes de|hasta) las? (\d{1,2})(?::(\d{2}))?/);
  if (m) hastaMin = h(m[1]) + (m[2] ? +m[2] : 0);
  m = t.match(/\ba las (\d{1,2})(?::(\d{2}))?/);
  if (m && desdeMin === undefined && hastaMin === undefined) { const v = h(m[1]) + (m[2] ? +m[2] : 0); desdeMin = v - 60; hastaMin = v + 60; }
  if (!dias.size && desdeMin === undefined && hastaMin === undefined) return null;
  return { dias: [...dias], desdeMin, hastaMin };
}

/** Busca en los próximos 7 días los huecos que encajan con la preferencia. */
export async function huecosSegunPreferencia(tenantId: string, opts: { motivo: string; empleadoId?: string; pref: Preferencia; n?: number }): Promise<string[]> {
  const n = opts.n ?? 2;
  const c = await contextoHuecos(tenantId, opts.motivo, opts.empleadoId);
  if (!c) return [];
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: c.negocio.timezone || "Europe/Madrid" });
  const out: string[] = [];
  for (let i = 0; i < 8 && out.length < n; i++) {
    const f = sumarDias(hoy, i);
    if (opts.pref.dias.length && !opts.pref.dias.includes(new Date(`${f}T12:00:00Z`).getUTCDay())) continue;
    const libres = (await libresDelDia(c, f)).filter((s) => {
      const m = minutosDe(s);
      return (opts.pref.desdeMin === undefined || m >= opts.pref.desdeMin) && (opts.pref.hastaMin === undefined || m < opts.pref.hastaMin);
    });
    // Dos opciones que sean de verdad distintas: si hay más de una en el día, la
    // primera y otra separada al menos una hora.
    for (const s of libres) {
      if (out.length >= n) break;
      if (!out.length || distancia(s, out[out.length - 1]) >= 60) out.push(s);
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Cómo se dice
// -----------------------------------------------------------------------------

/** "el martes 6 de octubre a las 10:30" (o "mañana a las 10:30", "hoy a las…"). */
export function cuandoHablado(iso: string, tz = "Europe/Madrid"): string {
  const f = iso.slice(0, 10);
  const hora = iso.slice(11, 16);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  if (f === hoy) return `hoy a las ${hora}`;
  if (f === sumarDias(hoy, 1)) return `mañana a las ${hora}`;
  const d = new Date(`${f}T12:00:00Z`);
  return `el ${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} a las ${hora}`;
}

export function listaDeOpciones(huecos: string[]): string {
  const x = huecos.map((h) => cuandoHablado(h));
  if (x.length <= 1) return x.join("");
  return `${x.slice(0, -1).join(", ")} o ${x[x.length - 1]}`;
}

export function urlHuecos(slug: string, motivo?: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_URL || "https://aiteam.marketing").replace(/\/$/, "");
  return `${site}/reservas/${slug}/huecos${motivo ? `?servicio=${encodeURIComponent(motivo)}` : ""}`;
}

// -----------------------------------------------------------------------------
// Estado de la conversación
// -----------------------------------------------------------------------------

export type EstadoGuion = {
  fase: "ofrecido" | "preguntado";
  rondasFallidas: number;
  ofrecidos: string[];
  motivo: string;
  nombre?: string;
  empleadoId?: string;
  /** La hora que pidió y estaba LLENA: se le ofrece apuntarse a la lista de espera. */
  pedido?: string;
  ts: number;
};

const FICHERO = path.join(process.cwd(), "data", "pablo-guion.json");
const clave = (tenantId: string, contacto: string) => `guion:${tenantId}:${contacto}`;

async function leerTodo(): Promise<Record<string, EstadoGuion>> {
  try { return JSON.parse(await fs.readFile(FICHERO, "utf-8")); } catch { return {}; }
}

export async function leerGuion(tenantId: string, contacto: string): Promise<EstadoGuion | null> {
  const k = clave(tenantId, contacto);
  const e = supabaseEnabled() ? await kvGet<EstadoGuion>(k) : (await leerTodo())[k] ?? null;
  if (!e || !e.ts || Date.now() - e.ts > TTL_MS) return null;
  return e;
}

export async function guardarGuion(tenantId: string, contacto: string, e: EstadoGuion | null): Promise<void> {
  const k = clave(tenantId, contacto);
  const valor = e ? { ...e, ts: Date.now() } : null;
  if (supabaseEnabled()) {
    await kvSet(k, valor ?? { ts: 0 });
    return;
  }
  const todo = await leerTodo();
  if (valor) todo[k] = valor; else delete todo[k];
  await fs.mkdir(path.dirname(FICHERO), { recursive: true });
  await fs.writeFile(FICHERO, JSON.stringify(todo, null, 2));
}

// -----------------------------------------------------------------------------
// Qué quiere decir el cliente
// -----------------------------------------------------------------------------

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** ¿Elige una de las opciones ofrecidas? Devuelve cuál, o null. */
export function eligeOpcion(texto: string, ofrecidos: string[]): string | null {
  if (!ofrecidos.length) return null;
  const t = norm(texto);
  if (esRechazo(texto)) return null;
  // Por la hora: "la de las 10:30", "a las 17", "vale 12:15".
  const horas = [...t.matchAll(/\b(\d{1,2})(?:[:.h](\d{2}))?\b/g)].map((m) => `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`);
  for (const h of horas) {
    const x = ofrecidos.find((o) => o.slice(11, 16) === h);
    if (x) return x;
    const pm = ofrecidos.find((o) => Number(o.slice(11, 13)) === Number(h.slice(0, 2)) + 12 && o.slice(14, 16) === h.slice(3));
    if (pm) return pm;
  }
  if (/\b(la )?(primera|1a|1ª|primer)\b|\bla 1\b|opcion 1/.test(t)) return ofrecidos[0];
  if (/\b(la )?(segunda|2a|2ª)\b|\bla 2\b|opcion 2/.test(t)) return ofrecidos[1] ?? null;
  if (/\b(la )?ultima\b/.test(t)) return ofrecidos[ofrecidos.length - 1];
  // Por el día: "la del jueves".
  const dia = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"].findIndex((d) => new RegExp(`\\b${d}\\b`).test(t));
  if (dia >= 0) {
    const del = ofrecidos.filter((o) => new Date(`${o.slice(0, 10)}T12:00:00Z`).getUTCDay() === dia);
    if (del.length === 1) return del[0];
  }
  // Un "sí" a secas con UNA sola opción.
  if (ofrecidos.length === 1 && /^(si|vale|ok|perfecto|genial|de acuerdo|me va bien|me viene bien|esa|esa misma)\b/.test(t)) return ofrecidos[0];
  return null;
}

export function esRechazo(texto: string): boolean {
  const t = norm(texto);
  return /^(no|nop|nada|ninguna|ninguno)\b|\b(ninguna|ninguno|no me (va|viene|encaja|cuadra|sirve)|no puedo|tampoco|imposible|otro dia|otra hora|otro momento|mejor otro|mejor otra)\b/.test(t);
}
