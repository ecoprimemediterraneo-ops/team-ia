// =============================================================================
// AI-Team Booking — reservas online (consumidor final) estilo Booksy, SIN
// comisiones, sobre Google Calendar. INTERFAZ por encima del motor central que
// ya usan Lucía y Carmen: NO reinventa la agenda.
//
// Reutiliza: reservarSlot() (disponibilidad+lock+crea cita+loguea appointment_set
// con agenteOrigen "booking"), freeBusyQuery() (ocupado real de Google),
// deleteEvent() (cancelación), getTenant() (multi-cliente → calendario).
//
// Modelo Booksy: categorías, servicios (con descripción/foto/categoría),
// VARIANTES (opciones de duración/precio), ADD-ONS (extras que suman),
// PADDING TIME (prep/limpieza bloqueada antes/después en la agenda).
//
// MULTI-CLIENTE: cada negocio = un BusinessBooking con su `slug` (URL pública
// /reservas/<slug>) y su `tenantId`. El calendario de Google se resuelve por
// `calendarEmail` (override) o por `tenant.email`. Funciona de entrada con el
// fundador (tenant_aiteam → FOUNDER_EMAIL); para otro negocio basta crear su
// BusinessBooking apuntando a su tenant/cuenta Google.
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { kvGet, kvSet, kvListByPrefix, supabaseEnabled } from "./supabase";
import { getTenant, DEFAULT_TENANT_ID } from "./tenants";
import { freeBusyQuery, deleteEvent } from "./calendar";
import { reservarSlotBooking } from "./booking-orchestrator";
import { benditoArteSeed } from "./booking-seed-bendito";
import { configRestaurante, estadoInicialReserva } from "./restaurante";

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------

export type Categoria = { id: string; nombre: string };

/** Opción de un servicio (p. ej. láser: axilas 15min / piernas 45min). */
export type Variante = { id: string; nombre: string; durationMin: number; precioEUR: number };

/** Extra que se suma a un servicio principal (tiempo + precio). */
export type AddOn = { id: string; nombre: string; durationMin: number; precioEUR: number; activo: boolean };

export type BookingService = {
  id: string;
  nombre: string;
  descripcion?: string;
  fotoUrl?: string;
  categoriaId?: string;
  // Duración/precio base (se usan si NO hay variantes).
  durationMin: number;
  precioEUR?: number;
  // Padding: minutos bloqueados en la agenda antes/después (prep/limpieza).
  paddingBeforeMin?: number;
  paddingAfterMin?: number;
  variantes?: Variante[];
  addons?: AddOn[];
  activo: boolean;
};

export type Franja = { desde: string; hasta: string }; // "09:00" – "14:00"
export type DayHours = { abierto: boolean; franjas: Franja[] };
export type Horario = Record<number, DayHours>; // 0=domingo … 6=sábado

/** Profesional del negocio (staff). Modelo B: seguimiento interno (no requiere que conecte su Google). */
export type Empleado = {
  id: string;
  nombre: string;
  color?: string; // para la agenda (columna/etiqueta)
  activo: boolean;
  horario?: Horario; // turno propio; si ausente, usa el horario del negocio (lo usará la Fase 2b)
  serviceIds?: string[]; // servicios que realiza; vacío/ausente = todos
};

export type BusinessBooking = {
  slug: string;
  tenantId: string;
  nombre: string;
  descripcion?: string;
  logoUrl?: string; // logo del negocio (mini-web); si falta se muestra el nombre en Anton
  heroImageUrl?: string; // foto de portada/hero a todo el ancho; si falta se usa una de stock
  galeria?: string[]; // URLs de fotos (mini-web)
  direccion?: string; // dirección física (ficha + mapa)
  lat?: number; // coordenadas (para el mapa OSM); se autocompletan al guardar la dirección
  lng?: number;
  telefono?: string; // teléfono de contacto público
  instagram?: string; // handle de Instagram (sin @); enlace en la ficha
  /**
   * Enlace DIRECTO para dejar reseña en Google. Se configura por negocio porque
   * cada ficha de Google tiene el suyo y no hay forma de deducirlo. Sin él, la
   * petición de reseña por WhatsApp no se manda (ver `resena-whatsapp.ts`).
   */
  resenaUrl?: string;
  calendarEmail?: string; // enganche multi-cliente al calendario Google
  timezone: string; // "Europe/Madrid"
  categorias: Categoria[];
  servicios: BookingService[];
  empleados?: Empleado[]; // staff (modelo B). 0 = negocio mono-agenda (compat); ≥1 = con personal
  horario: Horario;
  slotStepMin: number; // granularidad de la rejilla (default 15 min)
  leadTimeMin: number; // antelación mínima para reservar (default 60 min)
  cancelAntelacionMin: number; // antelación mínima para cancelar/reprogramar (default 120)
  /**
   * Config del sector RESTAURANTE: turnos, duración de mesa, zonas y modo de
   * trabajo. Opcional y solo la usan los negocios de ese sector; el resto ni la
   * miran. Los valores por defecto y los tipos viven en `restaurante.ts`, que es
   * quien manda aquí — este campo es solo dónde se guarda.
   */
  restaurante?: {
    modo?: "captacion" | "gestion";
    duracionMesaMin?: number;
    cortesiaMin?: number;
    turnos?: Array<{ id: string; nombre: string; desde: string; hasta: string; dias: number[] }>;
    confirmacionAutomatica?: boolean;
    zonas?: { terraza?: boolean; interior?: boolean };
    /** Hueco previsto para el plano de sala editable, que se construye aparte. */
    plano?: { mesas?: unknown[]; version?: number };
  };
  actualizadoEn?: string;
};

/** Máquina de estados de una cita (estilo Booksy). */
export type EstadoCita = "pendiente" | "confirmada" | "completada" | "cancelada" | "no_show";
/** Origen: flujo público online vs. creada a mano por el dueño (walk-in/teléfono). */
export type OrigenCita = "online" | "manual";
/** Un registro es una CITA de cliente o un BLOQUEO de tiempo (descanso/vacaciones). */
export type TipoRegistro = "cita" | "bloqueo";

export type BookingRecord = {
  id: string;
  token: string; // para cancelar/reprogramar sin login
  slug: string;
  tenantId: string;
  serviceId: string;
  servicioNombre: string;
  variantId?: string;
  varianteNombre?: string;
  addonIds?: string[];
  addonsNombres?: string[];
  durationMin: number; // duración TOTAL del servicio (variante + add-ons) que ve el cliente
  paddingBeforeMin?: number;
  paddingAfterMin?: number;
  precioEUR?: number; // precio total
  startIso: string; // "YYYY-MM-DDTHH:mm:ss" hora de INICIO del servicio (Europe/Madrid)
  cliente: { nombre: string; telefono: string; email?: string };
  empleadoId?: string; // profesional asignado (staff). Ausente = sin asignar
  empleadoNombre?: string; // denormalizado para mostrar en agenda/email
  eventId?: string;
  htmlLink?: string;
  estado: EstadoCita;
  origen?: OrigenCita; // ausente = "online" (compat con reservas previas)
  tipo?: TipoRegistro; // ausente = "cita"
  nota?: string; // nota interna del dueño / motivo del bloqueo
  /**
   * RESTAURANTE. Cuántos se sientan y dónde. Opcionales porque en los otros
   * cuatro sectores no existen: una cita de peluquería no tiene comensales.
   * "indiferente" es una respuesta válida del cliente, no un campo sin rellenar.
   */
  comensales?: number;
  zona?: "terraza" | "interior" | "indiferente";
  creadaEn: string;
  canceladaEn?: string;
  reprogramadaEn?: string; // última vez que se movió/reprogramó (para la campanita)
  recordatorioEnviado?: boolean;
};

/** Transiciones válidas de la máquina de estados. */
export const TRANSICIONES: Record<EstadoCita, EstadoCita[]> = {
  pendiente: ["confirmada", "cancelada", "no_show"],
  confirmada: ["completada", "cancelada", "no_show"],
  completada: [],
  cancelada: [],
  no_show: [],
};

export function puedeTransicionar(de: EstadoCita, a: EstadoCita): boolean {
  return TRANSICIONES[de]?.includes(a) ?? false;
}

// -----------------------------------------------------------------------------
// Zona horaria — helpers (DST-correcto, cualquier zona)
// -----------------------------------------------------------------------------

/** Estados de cita/bloqueo que RESERVAN hueco en la agenda (bloquean disponibilidad). */
function ocupaAgenda(estado: string): boolean {
  return estado === "pendiente" || estado === "confirmada";
}

function offsetMinutesAt(utc: Date, timeZone: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(utc).reduce((a, x) => ((a[x.type] = x.value), a), {} as Record<string, string>);
  const hh = p.hour === "24" ? 0 : +p.hour;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, hh, +p.minute, +p.second);
  return (asUTC - utc.getTime()) / 60000;
}

/** epoch ms de una hora local "YYYY-MM-DDTHH:mm(:ss)" del negocio (DST-correcto). */
export function localToEpoch(localIso: string, timezone: string): number {
  const naive = Date.parse(`${localIso.length === 16 ? localIso + ":00" : localIso}Z`);
  let off = offsetMinutesAt(new Date(naive), timezone);
  const epoch = naive - off * 60000;
  off = offsetMinutesAt(new Date(epoch), timezone);
  return naive - off * 60000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Desplaza una hora local "YYYY-MM-DDTHH:mm:ss" ±minutos, CRUZANDO medianoche si
 * hace falta (no recorta al mismo día). Opera sobre los minutos de reloj de pared
 * usando Date.UTC como calendario neutro; el desfase real de zona lo aplica después
 * localToEpoch (DST-correcto). Así el evento escrito en Google cubre exactamente el
 * footprint validado, incluso si el padding cruza las 00:00.
 */
function shiftLocal(localIso: string, deltaMin: number): string {
  const [y, mo, d] = localIso.slice(0, 10).split("-").map(Number);
  const [hh, mm] = localIso.slice(11, 16).split(":").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, hh, mm) + deltaMin * 60_000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:00`;
}

// -----------------------------------------------------------------------------
// Duración + precio efectivos de una reserva (servicio + variante + add-ons)
// -----------------------------------------------------------------------------

export type SeleccionServicio = { variantId?: string; addonIds?: string[] };

export function resolverServicio(service: BookingService, sel: SeleccionServicio) {
  const variante = service.variantes?.find((v) => v.id === sel.variantId);
  const baseDur = variante ? variante.durationMin : service.durationMin;
  const basePrc = variante ? variante.precioEUR : service.precioEUR ?? 0;
  const addonsSel = (service.addons || []).filter((a) => a.activo && (sel.addonIds || []).includes(a.id));
  const durationMin = baseDur + addonsSel.reduce((s, a) => s + a.durationMin, 0);
  const precioEUR = basePrc + addonsSel.reduce((s, a) => s + a.precioEUR, 0);
  return {
    durationMin,
    precioEUR,
    paddingBeforeMin: service.paddingBeforeMin ?? 0,
    paddingAfterMin: service.paddingAfterMin ?? 0,
    varianteNombre: variante?.nombre,
    addonsSel,
  };
}

export function getEmpleado(business: BusinessBooking, id?: string): Empleado | undefined {
  if (!id) return undefined;
  return (business.empleados || []).find((e) => e.id === id);
}

// -----------------------------------------------------------------------------
// Resolver la cuenta de Google del negocio (multi-cliente hook)
// -----------------------------------------------------------------------------

export async function resolveCalendarEmail(b: BusinessBooking): Promise<string> {
  if (b.calendarEmail) return b.calendarEmail;
  const t = await getTenant(b.tenantId);
  return t?.email || process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
}

// -----------------------------------------------------------------------------
// Store (Supabase KV en prod; ficheros locales en dev)
// -----------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIGS_FILE = path.join(DATA_DIR, "booking-configs.json");
const RECORDS_FILE = path.join(DATA_DIR, "booking-records.json");
const KV_CONFIGS = "booking:configs";
const KV_REC_PREFIX = "booking:rec:";

type ConfigMap = Record<string, BusinessBooking>;
type RecordMap = Record<string, BookingRecord>;

async function readLocal<T>(file: string): Promise<T> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(file, "utf-8");
    return raw.trim() ? (JSON.parse(raw) as T) : ({} as T);
  } catch {
    return {} as T;
  }
}
async function writeLocal(file: string, data: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

async function readConfigs(): Promise<ConfigMap> {
  let data: ConfigMap | null = null;
  if (supabaseEnabled()) data = await kvGet<ConfigMap>(KV_CONFIGS);
  else data = await readLocal<ConfigMap>(CONFIGS_FILE);
  if (!data || Object.keys(data).length === 0) {
    data = { ...seedBusinesses() };
    await writeConfigs(data);
  }
  // Auto-arreglo de la demo: si quedó persistida con el seed viejo (fotos picsum,
  // sin mapa), la refresca una vez con el seed actual. Solo toca la "demo" y solo
  // cuando lleva las URLs picsum (un salón real nunca las usa) → no pisa datos reales.
  const d = data.demo;
  if (d && (d.galeria || []).some((g) => g.includes("picsum"))) {
    const seed = seedBusinesses();
    if (seed.demo) { data.demo = seed.demo; await writeConfigs(data); }
  }
  // Alta ÚNICA del salón fundador "Bendito Arte". Se inyecta una sola vez: si ya
  // está en configs no se toca (respeta ediciones del dueño); si se borró alguna
  // vez, el flag KV evita re-inyectarlo. En local ya vive en el JSON → no aplica.
  if (!data["bendito-arte"]) {
    const yaSeed = supabaseEnabled() ? await kvGet<boolean>("booking:seed:bendito-arte") : false;
    if (!yaSeed) {
      data["bendito-arte"] = benditoArteSeed();
      await writeConfigs(data);
      if (supabaseEnabled()) await kvSet("booking:seed:bendito-arte", true);
    }
  }
  return data;
}
async function writeConfigs(map: ConfigMap): Promise<void> {
  if (supabaseEnabled()) await kvSet(KV_CONFIGS, map);
  else await writeLocal(CONFIGS_FILE, map);
}

export async function listBusinesses(): Promise<BusinessBooking[]> {
  return Object.values(await readConfigs());
}
export async function getBusinessBySlug(slug: string): Promise<BusinessBooking | null> {
  const all = await readConfigs();
  return all[slug] || null;
}
export async function saveBusiness(b: BusinessBooking): Promise<BusinessBooking> {
  const all = await readConfigs();
  all[b.slug] = { ...b, actualizadoEn: new Date().toISOString() };
  await writeConfigs(all);
  return all[b.slug];
}
/**
 * Negocios de un TENANT. Es la forma correcta de resolver qué ve un panel.
 *
 * `getBusinessesForOwner` (abajo) resuelve por email de calendario, y eso tiene
 * un agujero: `resolveCalendarEmail` cae al email del fundador cuando el negocio
 * no declara calendario propio, así que el panel de un cliente podía acabar
 * enseñando los negocios del fundador. Pasó de verdad: el panel de la gestoría de
 * gestorías mostraba los servicios de un centro de belleza.
 *
 * Filtrando por `tenantId` eso es imposible: un negocio pertenece a un tenant y
 * a uno solo.
 */
export async function getBusinessesForTenant(tenantId: string): Promise<BusinessBooking[]> {
  const all = Object.values(await readConfigs());
  return all.filter((b) => b.tenantId === tenantId);
}

/**
 * ⚠️ Resuelve por email del calendario. NO usar para decidir qué ve un panel:
 * usa `getBusinessesForTenant`. Se mantiene porque el email de calendario sigue
 * siendo la forma de saber a quién avisar de una cita.
 */
export async function getBusinessesForOwner(email: string): Promise<BusinessBooking[]> {
  const all = Object.values(await readConfigs());
  const out: BusinessBooking[] = [];
  for (const b of all) {
    const owner = await resolveCalendarEmail(b);
    if (owner.toLowerCase() === email.toLowerCase()) out.push(b);
  }
  return out;
}

export async function saveRecord(rec: BookingRecord): Promise<void> {
  if (supabaseEnabled()) {
    await kvSet(KV_REC_PREFIX + rec.id, rec);
  } else {
    const map = await readLocal<RecordMap>(RECORDS_FILE);
    map[rec.id] = rec;
    await writeLocal(RECORDS_FILE, map);
  }
}
export async function getRecord(id: string): Promise<BookingRecord | null> {
  if (supabaseEnabled()) return kvGet<BookingRecord>(KV_REC_PREFIX + id);
  const map = await readLocal<RecordMap>(RECORDS_FILE);
  return map[id] || null;
}
export async function listRecords(): Promise<BookingRecord[]> {
  if (supabaseEnabled()) {
    const rows = await kvListByPrefix<BookingRecord>(KV_REC_PREFIX);
    return rows.map((r) => r.value);
  }
  const map = await readLocal<RecordMap>(RECORDS_FILE);
  return Object.values(map);
}
export async function getRecordByToken(token: string): Promise<BookingRecord | null> {
  const all = await listRecords();
  return all.find((r) => r.token === token) || null;
}

// -----------------------------------------------------------------------------
// Cómputo de HUECOS LIBRES (footprint = padding + servicio + padding)
// -----------------------------------------------------------------------------

export type SlotsResult =
  | { ok: true; date: string; slots: string[]; timezone: string }
  | { ok: false; reason: "no_calendar" | "error"; detail?: string };

export type DuracionFootprint = { durationMin: number; paddingBeforeMin?: number; paddingAfterMin?: number };

type Ocupado = { start: number; end: number };

/**
 * ¿El detalle de error de Google indica que el calendario está DESCONECTADO y hay
 * que reconectar OAuth (no un fallo transitorio)? Cubre el caso típico `invalid_grant`
 * (refresh token caducado o revocado), la ausencia de tokens, el cliente no autorizado
 * y los tokens sin el scope `calendar.events`. Se usa para mapear a reason:"no_calendar"
 * y que el panel muestre el aviso de reconexión en vez del código crudo de Google.
 */
export function pareceCalendarioDesconectado(detail?: string): boolean {
  if (!detail) return false;
  return /invalid_grant|invalid_client|unauthorized|no[_ ]?tokens?|refresh|revoked|expired|token|insufficient|scope/i.test(detail);
}

/**
 * Reúne TODO lo que ocupa la agenda en [fromEpoch, toEpoch]. Fuente ÚNICA de
 * "ocupado" para el grid (computeFreeSlots) y el check puntual (footprintLibre).
 *
 * Dos modos (modelo B):
 *   - GLOBAL (empleadoId ausente): negocio SIN personal. Incluye el ocupado real de
 *     Google (calendario compartido → sincroniza con Lucía/Carmen/personal) + todas
 *     nuestras reservas/bloqueos.
 *   - POR EMPLEADO (empleadoId): negocio CON personal. NO usa el calendario
 *     compartido (permite que dos profesionales atiendan en paralelo); ocupado =
 *     las reservas de ESE empleado + las sin asignar y los bloqueos (que bloquean a
 *     todos). Seguimiento 100% interno.
 */
async function reunirOcupado(
  business: BusinessBooking,
  fromEpoch: number,
  toEpoch: number,
  redirectUri: string,
  excludeId?: string,
  empleadoId?: string,
): Promise<{ ok: true; busy: Ocupado[] } | { ok: false; reason: "no_calendar" | "error"; detail?: string }> {
  const tz = business.timezone || "Europe/Madrid";
  const perStaff = !!empleadoId;
  const busy: Ocupado[] = [];

  if (!perStaff) {
    const calendarEmail = await resolveCalendarEmail(business);
    const fb = await freeBusyQuery(calendarEmail, redirectUri, new Date(fromEpoch).toISOString(), new Date(toEpoch).toISOString());
    const SIM = process.env.BOOKING_SIMULATE === "1";
    if (fb.ok) for (const b of fb.busy) busy.push({ start: Date.parse(b.start), end: Date.parse(b.end) });
    else if (!SIM) return { ok: false, reason: (fb.reason === "no_tokens" || pareceCalendarioDesconectado(fb.detail)) ? "no_calendar" : "error", detail: fb.detail };
  }

  try {
    const recs = await listRecords();
    for (const r of recs) {
      if (r.slug !== business.slug || !ocupaAgenda(r.estado) || r.id === excludeId) continue;
      // Modo per-staff: las reservas de OTRO empleado no bloquean a éste. Las sin
      // asignar (empleadoId ausente) y los bloqueos globales sí bloquean a todos.
      if (perStaff && r.empleadoId && r.empleadoId !== empleadoId) continue;
      const pBr = r.paddingBeforeMin ?? 0;
      const pAr = r.paddingAfterMin ?? 0;
      const rs = localToEpoch(r.startIso, tz) - pBr * 60_000;
      const re = localToEpoch(r.startIso, tz) + (r.durationMin + pAr) * 60_000;
      if (re > fromEpoch && rs < toEpoch) busy.push({ start: rs, end: re });
    }
  } catch {
    /* no crítico */
  }
  return { ok: true, busy };
}

/** ¿Está LIBRE el footprint [start-pB, start+dur+pA] para una hora arbitraria? (citas manuales) */
async function footprintLibre(
  business: BusinessBooking,
  startNorm: string,
  pB: number,
  dur: number,
  pA: number,
  redirectUri: string,
  excludeId?: string,
  empleadoId?: string,
): Promise<{ ok: true; libre: boolean } | { ok: false; reason: "no_calendar" | "error"; detail?: string }> {
  const tz = business.timezone || "Europe/Madrid";
  const startEpoch = localToEpoch(startNorm, tz);
  const footStart = startEpoch - pB * 60_000;
  const footEnd = startEpoch + (dur + pA) * 60_000;
  const oc = await reunirOcupado(business, footStart - 60_000, footEnd + 60_000, redirectUri, excludeId, empleadoId);
  if (!oc.ok) return oc;
  return { ok: true, libre: !oc.busy.some((b) => footStart < b.end && footEnd > b.start) };
}

export async function computeFreeSlots(
  business: BusinessBooking,
  opts: DuracionFootprint,
  dateStr: string,
  redirectUri: string,
  leadTimeMinOverride?: number,
  empleadoId?: string,
): Promise<SlotsResult> {
  const tz = business.timezone || "Europe/Madrid";
  // Con empleado: usa su turno propio si lo tiene; si no, el horario del negocio.
  const empleado = empleadoId ? getEmpleado(business, empleadoId) : undefined;
  const horario = empleado?.horario ?? business.horario;
  const weekday = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  const day = horario[weekday];
  if (!day || !day.abierto || day.franjas.length === 0) {
    return { ok: true, date: dateStr, slots: [], timezone: tz };
  }

  const step = business.slotStepMin || 15;
  const dur = opts.durationMin;
  const pB = opts.paddingBeforeMin ?? 0;
  const pA = opts.paddingAfterMin ?? 0;
  const lead = leadTimeMinOverride ?? business.leadTimeMin ?? 60;
  const minEpoch = Date.now() + lead * 60_000;

  // Ventana de "ocupado": cubre TODO el footprint posible del día, incluido el
  // padding que rebase la medianoche por cualquiera de los dos bordes. (Antes solo
  // consultaba el día natural, así que un footprint a caballo de las 00:00 no veía
  // las citas del otro lado → posible doble reserva.)
  const dayStartEpoch = localToEpoch(`${dateStr}T00:00:00`, tz);
  const fromEpoch = dayStartEpoch - (pB + 5) * 60_000;
  const toEpoch = dayStartEpoch + 24 * 60 * 60_000 + (dur + pA + 5) * 60_000;

  const oc = await reunirOcupado(business, fromEpoch, toEpoch, redirectUri, undefined, empleadoId);
  if (!oc.ok) return oc;
  const busy = oc.busy;

  const slots: string[] = [];
  for (const f of day.franjas) {
    const [dh, dm] = f.desde.split(":").map(Number);
    const [hh, hm] = f.hasta.split(":").map(Number);
    const openMin = dh * 60 + dm;
    const closeMin = hh * 60 + hm;
    // El SERVICIO debe caber dentro de la franja (el padding puede rebasar bordes).
    for (let m = openMin; m + dur <= closeMin; m += step) {
      const startLocal = `${dateStr}T${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`;
      const startEpoch = localToEpoch(startLocal, tz);
      if (startEpoch < minEpoch) continue; // pasado o dentro del lead-time
      const footStart = startEpoch - pB * 60_000;
      const footEnd = startEpoch + (dur + pA) * 60_000;
      const solapa = busy.some((b) => footStart < b.end && footEnd > b.start);
      if (!solapa) slots.push(startLocal);
    }
  }
  return { ok: true, date: dateStr, slots, timezone: tz };
}

/** Empleados ACTIVOS que realizan un servicio (vacío = el negocio no tiene personal → modo global). */
export function empleadosDeServicio(business: BusinessBooking, serviceId: string): Empleado[] {
  const emps = (business.empleados || []).filter((e) => e.activo);
  if (emps.length === 0) return [];
  return emps.filter((e) => !e.serviceIds?.length || e.serviceIds.includes(serviceId));
}

type AsignacionResult =
  | { ok: true; empleado?: Empleado }
  | { ok: false; reason: "slot_taken" | "empleado_invalido" | "no_calendar" | "error"; detail?: string };

/**
 * Valida que `startNorm` es un hueco realmente ofrecible para el servicio y ASIGNA
 * empleado (modelo B):
 *   - Negocio sin personal → re-valida contra el grid global (comportamiento previo).
 *   - Con `preferidoId` → ese empleado debe realizar el servicio y tenerlo libre.
 *   - "cualquiera" (sin preferido) → primer empleado elegible con el hueco libre.
 */
async function validarYAsignar(
  business: BusinessBooking,
  service: BookingService,
  sel: DuracionFootprint,
  startNorm: string,
  dateStr: string,
  redirectUri: string,
  preferidoId?: string,
): Promise<AsignacionResult> {
  const eligibles = empleadosDeServicio(business, service.id);
  if (eligibles.length === 0) {
    const g = await computeFreeSlots(business, sel, dateStr, redirectUri);
    if (!g.ok) return { ok: false, reason: g.reason === "no_calendar" ? "no_calendar" : "error", detail: g.detail };
    return g.slots.includes(startNorm) ? { ok: true, empleado: undefined } : { ok: false, reason: "slot_taken" };
  }
  const candidatos = preferidoId ? eligibles.filter((e) => e.id === preferidoId) : eligibles;
  if (preferidoId && candidatos.length === 0) return { ok: false, reason: "empleado_invalido" };
  for (const e of candidatos) {
    const r = await computeFreeSlots(business, sel, dateStr, redirectUri, undefined, e.id);
    if (!r.ok) return { ok: false, reason: r.reason === "no_calendar" ? "no_calendar" : "error", detail: r.detail };
    if (r.slots.includes(startNorm)) return { ok: true, empleado: e };
  }
  return { ok: false, reason: "slot_taken" };
}

// -----------------------------------------------------------------------------
// Crear reserva — pasa por reservarSlotBooking (motor PROPIO del booking; NO toca el de Lucía/Carmen)
// -----------------------------------------------------------------------------

export type CrearReservaInput = {
  slug: string;
  serviceId: string;
  variantId?: string;
  addonIds?: string[];
  startIso: string; // hora de inicio del SERVICIO (local del negocio)
  cliente: { nombre: string; telefono: string; email?: string };
  empleadoId?: string; // profesional elegido; ausente = "cualquiera" (auto-asigna)
  redirectUri: string;
};

export type CrearReservaResult =
  | { ok: true; record: BookingRecord }
  | { ok: false; reason: "not_found" | "service_not_found" | "slot_taken" | "empleado_invalido" | "locked" | "no_calendar" | "error"; detail?: string; suggested?: string };

function nuevoId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

export async function crearReserva(input: CrearReservaInput): Promise<CrearReservaResult> {
  const business = await getBusinessBySlug(input.slug);
  if (!business) return { ok: false, reason: "not_found" };
  const service = business.servicios.find((s) => s.id === input.serviceId && s.activo);
  if (!service) return { ok: false, reason: "service_not_found" };
  // Si el servicio tiene variantes, exigimos una válida.
  if (service.variantes?.length && !service.variantes.find((v) => v.id === input.variantId)) {
    return { ok: false, reason: "service_not_found" };
  }

  const sel = resolverServicio(service, { variantId: input.variantId, addonIds: input.addonIds });

  // Re-validar el hueco (TZ-correcto + footprint + ocupado real) y ASIGNAR empleado
  // (per-staff si el negocio tiene personal; global si no) ANTES de reservar.
  const dateStr = input.startIso.slice(0, 10);
  const startNorm = input.startIso.length === 16 ? `${input.startIso}:00` : input.startIso;
  const asig = await validarYAsignar(business, service, sel, startNorm, dateStr, input.redirectUri, input.empleadoId);
  if (!asig.ok) return { ok: false, reason: asig.reason, detail: asig.detail };
  const empleado = asig.empleado;

  const calendarEmail = await resolveCalendarEmail(business);

  // El evento en Google cubre el FOOTPRINT (padding antes + servicio + padding
  // después) para bloquear de verdad prep/limpieza. El cliente ve la hora del
  // servicio; el evento arranca en la hora de prep.
  const eventStart = shiftLocal(startNorm, -sel.paddingBeforeMin);
  const eventDuration = sel.paddingBeforeMin + sel.durationMin + sel.paddingAfterMin;
  const nombreCompleto = [service.nombre, sel.varianteNombre].filter(Boolean).join(" · ");
  const motivo = [nombreCompleto, ...sel.addonsSel.map((a) => `+ ${a.nombre}`)].join(" ") + (empleado ? ` · ${empleado.nombre}` : "");

  const res = await reservarSlotBooking({
    tenantId: business.tenantId,
    userEmail: calendarEmail,
    redirectUri: input.redirectUri,
    nombre: input.cliente.nombre,
    motivo,
    startIso: eventStart,
    durationMin: eventDuration,
    agenteOrigen: "booking",
    customerPhone: input.cliente.telefono,
    attendees: input.cliente.email ? [input.cliente.email] : undefined,
    simulate: process.env.BOOKING_SIMULATE === "1" ? true : undefined,
    // Multi-empleado: aísla el lock por profesional y re-valida per-staff dentro del
    // lock (en vez del findFreeSlot global, que asume un único calendario).
    resourceId: empleado?.id,
    revalidate: empleado
      ? async () => {
          const fl = await footprintLibre(business, startNorm, sel.paddingBeforeMin, sel.durationMin, sel.paddingAfterMin, input.redirectUri, undefined, empleado.id);
          return fl.ok && fl.libre;
        }
      : undefined,
  });

  if (!res.ok) {
    if (res.reason === "slot_taken") return { ok: false, reason: "slot_taken", suggested: res.suggested };
    if (res.reason === "locked") return { ok: false, reason: "locked" };
    const noCal = pareceCalendarioDesconectado(res.detail);
    return { ok: false, reason: noCal ? "no_calendar" : "error", detail: res.detail };
  }

  const record: BookingRecord = {
    id: nuevoId("bk"),
    token: crypto.randomBytes(16).toString("hex"),
    slug: business.slug,
    tenantId: business.tenantId,
    serviceId: service.id,
    servicioNombre: service.nombre,
    variantId: input.variantId,
    varianteNombre: sel.varianteNombre,
    addonIds: sel.addonsSel.map((a) => a.id),
    addonsNombres: sel.addonsSel.map((a) => a.nombre),
    durationMin: sel.durationMin,
    paddingBeforeMin: sel.paddingBeforeMin,
    paddingAfterMin: sel.paddingAfterMin,
    precioEUR: sel.precioEUR,
    startIso: startNorm,
    cliente: input.cliente,
    empleadoId: empleado?.id,
    empleadoNombre: empleado?.nombre,
    eventId: res.eventId,
    htmlLink: res.htmlLink,
    estado: "confirmada",
    origen: "online",
    tipo: "cita",
    creadaEn: new Date().toISOString(),
  };
  await saveRecord(record);
  await notificarDueno(record, "nueva");
  return { ok: true, record };
}

// -----------------------------------------------------------------------------
// Unificación de canales — Pablo/Carmen reservan por el orquestador general
// (reservarSlot). Estos helpers permiten que ESA cita quede TAMBIÉN como
// BookingRecord (con token, visible/gestionable en el panel) apuntando al MISMO
// evento de Google, SIN crear un segundo evento.
// -----------------------------------------------------------------------------

/** Primer negocio (BusinessBooking) de un tenant. null si el tenant no tiene ninguno. */
export async function getBusinessByTenant(tenantId: string): Promise<BusinessBooking | null> {
  const all = await listBusinesses();
  return all.find((b) => b.tenantId === tenantId) ?? null;
}

export type RegistrarRecordInput = {
  slug: string;
  startIso: string; // hora de inicio (local del negocio)
  durationMin: number;
  motivo: string; // texto del servicio/motivo (el orquestador no usa serviceId)
  cliente: { nombre: string; telefono: string; email?: string };
  eventId?: string; // evento YA creado en Google por el orquestador
  htmlLink?: string;
  baseUrl?: string; // origen público (para el enlace de cancelar de la confirmación al cliente)
  /** SOLO RESTAURACIÓN. Ausentes en los demás sectores, como hasta ahora. */
  comensales?: number;
  zona?: "terraza" | "interior" | "indiferente";
};

/**
 * Persiste un BookingRecord a partir de una cita YA creada en Google por el
 * orquestador general (Pablo/Carmen). NO llama a Google → cero evento duplicado.
 * Idempotente por eventId (protege ante reintentos de webhook). Devuelve null si
 * el tenant no tiene business → se comporta como hoy, sin regresión.
 */
export async function registrarRecordDeCita(input: RegistrarRecordInput): Promise<BookingRecord | null> {
  const business = await getBusinessBySlug(input.slug);
  if (!business) return null;
  // Idempotencia: si ya existe un record con este eventId, no dupliques.
  if (input.eventId) {
    const existente = (await listRecords()).find((r) => r.eventId === input.eventId);
    if (existente) return existente;
  }
  const startNorm = input.startIso.length === 16 ? `${input.startIso}:00` : input.startIso;
  const record: BookingRecord = {
    id: nuevoId("bk"),
    token: crypto.randomBytes(16).toString("hex"),
    slug: business.slug,
    tenantId: business.tenantId,
    serviceId: "",
    servicioNombre: input.motivo || "Cita",
    durationMin: input.durationMin,
    startIso: startNorm,
    cliente: input.cliente,
    comensales: input.comensales,
    zona: input.zona,
    eventId: input.eventId,
    htmlLink: input.htmlLink,
    // Confirmación HÍBRIDA, solo en restaurantes: la mesa nace PENDIENTE de que
    // la valide el restaurante, salvo que el dueño haya encendido la
    // confirmación automática. Un negocio sin config de restaurante entra por el
    // `: "confirmada"` de siempre, así que salón, estética, dental y legal se
    // comportan exactamente igual que antes.
    estado: business.restaurante
      ? estadoInicialReserva(configRestaurante(business))
      : "confirmada",
    origen: "online",
    tipo: "cita",
    creadaEn: new Date().toISOString(),
  };
  await saveRecord(record);
  await notificarDueno(record, "nueva");
  // Confirmación al CLIENTE (email + WhatsApp con enlace de cancelar/reprogramar).
  // Cuando la cita la agenda un agente (Pablo por WhatsApp, Carmen, Eva, Lucía), la
  // clienta recibe la MISMA confirmación con enlace que en la reserva online. Reutiliza
  // enviarConfirmacion (mismo texto y misma URL con token). Best-effort: nunca rompe la cita.
  try {
    const base = input.baseUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://aiteam.marketing";
    const { enviarConfirmacion } = await import("./booking-email");
    await enviarConfirmacion(record, business, base);
  } catch (e) {
    console.error("[booking] confirmación al cliente (whatsapp/email) falló (no crítico):", e);
  }
  return record;
}

/**
 * Avisa al dueño del negocio de una cita nueva/cancelada por DOS canales
 * independientes, cada uno con su propio flag y a prueba de fallos (nunca rompe
 * la reserva ni bloquea al otro canal):
 *   - Email de marca AI-Team → flag OWNER_NOTIFY_ENABLED (dedup en booking-email).
 *   - WhatsApp de plantilla   → flag OWNER_WHATSAPP_ENABLED (plantilla aviso_dueno_cita).
 * Dynamic import para evitar ciclos estáticos con booking-email/booking-owner-whatsapp.
 */
async function notificarDueno(record: BookingRecord, tipo: "nueva" | "cancelada"): Promise<void> {
  const business = await getBusinessBySlug(record.slug).catch(() => null);
  if (!business) return;
  // Canal 1 — email (self-gated por OWNER_NOTIFY_ENABLED; dedup interno).
  try {
    const { ownerNotifyEnabled, enviarAvisoDueno } = await import("./booking-email");
    if (ownerNotifyEnabled()) await enviarAvisoDueno(record, business, tipo);
  } catch (e) {
    console.error("[booking] aviso al dueño (email) falló (no crítico):", e);
  }
  // Canal 2 — WhatsApp de plantilla (self-gated por OWNER_WHATSAPP_ENABLED; fail-safe).
  try {
    const { enviarAvisoDuenoWhatsApp } = await import("./booking-owner-whatsapp");
    await enviarAvisoDuenoWhatsApp(record, business, tipo);
  } catch (e) {
    console.error("[booking] aviso al dueño (whatsapp) falló (no crítico):", e);
  }
}

// -----------------------------------------------------------------------------
// Cancelar reserva — borra de Google (libera el hueco + padding) + marca estado.
// Respeta la antelación mínima de cancelación del negocio.
// -----------------------------------------------------------------------------

/** Borra el evento de Google del registro (si aplica). No toca el estado. */
async function borrarEventoGoogle(record: BookingRecord, redirectUri: string): Promise<{ ok: boolean; detail?: string }> {
  const business = await getBusinessBySlug(record.slug);
  const calendarEmail = business ? await resolveCalendarEmail(business) : record.tenantId;
  const simulado = process.env.BOOKING_SIMULATE === "1" || record.eventId?.startsWith("sim_");
  if (record.eventId && !simulado) {
    const del = await deleteEvent(calendarEmail, redirectUri, record.eventId);
    if (!del.ok) return { ok: false, detail: del.detail };
  }
  return { ok: true };
}

export type CancelarResult =
  | { ok: true; record: BookingRecord }
  | { ok: false; reason: "not_found" | "too_late" | "error"; detail?: string; limiteIso?: string };

export async function cancelarReservaPorToken(token: string, redirectUri: string): Promise<CancelarResult> {
  const record = await getRecordByToken(token);
  if (!record) return { ok: false, reason: "not_found" };
  if (record.estado === "cancelada") return { ok: true, record }; // idempotente

  const business = await getBusinessBySlug(record.slug);
  const tz = business?.timezone || "Europe/Madrid";
  const antelacion = business?.cancelAntelacionMin ?? 0;
  // ¿Demasiado tarde para cancelar (dentro de la ventana de antelación)?
  if (antelacion > 0) {
    const startEpoch = localToEpoch(record.startIso, tz);
    if (Date.now() > startEpoch - antelacion * 60_000) {
      return { ok: false, reason: "too_late", limiteIso: record.startIso };
    }
  }

  const del = await borrarEventoGoogle(record, redirectUri);
  if (!del.ok) return { ok: false, reason: "error", detail: del.detail };
  const updated: BookingRecord = { ...record, estado: "cancelada", canceladaEn: new Date().toISOString() };
  await saveRecord(updated);
  await notificarDueno(updated, "cancelada");
  return { ok: true, record: updated };
}

// -----------------------------------------------------------------------------
// Panel del negocio (Biz) — agenda, máquina de estados, citas manuales, bloqueos.
// Todo pasa por el motor PROPIO del booking (reservarSlotBooking + Google) y el MISMO "ocupado", así
// que web/WhatsApp/llamada/manual comparten agenda sin dobles reservas.
// -----------------------------------------------------------------------------

/** Citas + bloqueos de un negocio en un rango de días [fromDate, toDate] (YYYY-MM-DD), ordenados. */
export async function listRecordsForRange(slug: string, fromDate: string, toDate: string): Promise<BookingRecord[]> {
  const all = await listRecords();
  return all
    .filter((r) => r.slug === slug && r.startIso.slice(0, 10) >= fromDate && r.startIso.slice(0, 10) <= toDate)
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}

export type CambiarEstadoResult =
  | { ok: true; record: BookingRecord }
  | { ok: false; reason: "not_found" | "transicion_invalida" | "error"; detail?: string };

/** Transición de estado desde el panel. Cancelar libera el hueco en Google; completada/no-show conservan el evento como histórico. */
export async function cambiarEstadoRecord(id: string, nuevoEstado: EstadoCita, redirectUri: string, expectSlug?: string): Promise<CambiarEstadoResult> {
  const record = await getRecord(id);
  if (!record || (expectSlug && record.slug !== expectSlug)) return { ok: false, reason: "not_found" };
  if (record.estado === nuevoEstado) return { ok: true, record }; // idempotente
  if (!puedeTransicionar(record.estado, nuevoEstado)) {
    return { ok: false, reason: "transicion_invalida", detail: `${record.estado} → ${nuevoEstado}` };
  }
  if (nuevoEstado === "cancelada") {
    const del = await borrarEventoGoogle(record, redirectUri);
    if (!del.ok) return { ok: false, reason: "error", detail: del.detail };
  }
  const updated: BookingRecord = {
    ...record,
    estado: nuevoEstado,
    ...(nuevoEstado === "cancelada" ? { canceladaEn: new Date().toISOString() } : {}),
  };
  await saveRecord(updated);
  if (nuevoEstado === "cancelada") await notificarDueno(updated, "cancelada");
  return { ok: true, record: updated };
}

export type CrearManualInput = {
  slug: string;
  serviceId?: string;
  variantId?: string;
  addonIds?: string[];
  customDurationMin?: number;
  customNombre?: string;
  startIso: string; // hora de inicio del servicio (local del negocio)
  cliente: { nombre: string; telefono: string; email?: string };
  empleadoId?: string;
  nota?: string;
  /**
   * RESTAURANTE. Cuántos vienen y dónde quieren sentarse. En los otros sectores
   * no se pasan y el registro sale sin ellos, como hasta ahora.
   */
  comensales?: number;
  zona?: "terraza" | "interior" | "indiferente";
  /**
   * Estado con el que nace. Por defecto "confirmada", que es lo que ha hecho
   * siempre una cita creada a mano por el dueño. Un restaurante en confirmación
   * híbrida pasa "pendiente" (ver `estadoInicialReserva` en restaurante.ts).
   */
  estadoInicial?: EstadoCita;
  redirectUri: string;
};

/** Cita creada a mano por el dueño (walk-in/teléfono). Sin lead-time, pero SIN doble reserva. */
export async function crearReservaManual(input: CrearManualInput): Promise<CrearReservaResult> {
  const business = await getBusinessBySlug(input.slug);
  if (!business) return { ok: false, reason: "not_found" };

  let dur: number, pB: number, pA: number;
  let precio: number | undefined;
  let serviceId = "";
  let servicioNombre = "";
  let varianteNombre: string | undefined;
  let addonIds: string[] = [];
  let addonsNombres: string[] = [];
  if (input.serviceId) {
    const service = business.servicios.find((s) => s.id === input.serviceId);
    if (!service) return { ok: false, reason: "service_not_found" };
    const sel = resolverServicio(service, { variantId: input.variantId, addonIds: input.addonIds });
    dur = sel.durationMin;
    pB = sel.paddingBeforeMin;
    pA = sel.paddingAfterMin;
    precio = sel.precioEUR;
    serviceId = service.id;
    servicioNombre = service.nombre;
    varianteNombre = sel.varianteNombre;
    addonIds = sel.addonsSel.map((a) => a.id);
    addonsNombres = sel.addonsSel.map((a) => a.nombre);
  } else {
    dur = Math.max(5, input.customDurationMin ?? 30);
    pB = 0;
    pA = 0;
    servicioNombre = input.customNombre?.trim() || "Cita";
  }

  const empleado = getEmpleado(business, input.empleadoId);

  const startNorm = input.startIso.length === 16 ? `${input.startIso}:00` : input.startIso;
  // Conflicto per-staff si va asignada a un profesional; global si no.
  const libre = await footprintLibre(business, startNorm, pB, dur, pA, input.redirectUri, undefined, empleado?.id);
  if (!libre.ok) return { ok: false, reason: libre.reason === "no_calendar" ? "no_calendar" : "error", detail: libre.detail };
  if (!libre.libre) return { ok: false, reason: "slot_taken" };

  const calendarEmail = await resolveCalendarEmail(business);
  const eventStart = shiftLocal(startNorm, -pB);
  const eventDuration = pB + dur + pA;
  const motivo = [servicioNombre, varianteNombre].filter(Boolean).join(" · ") + (empleado ? ` · ${empleado.nombre}` : "") + (input.nota ? ` — ${input.nota}` : "");

  const res = await reservarSlotBooking({
    tenantId: business.tenantId,
    userEmail: calendarEmail,
    redirectUri: input.redirectUri,
    nombre: input.cliente.nombre || "Cliente",
    motivo,
    startIso: eventStart,
    durationMin: eventDuration,
    agenteOrigen: "booking",
    customerPhone: input.cliente.telefono,
    attendees: input.cliente.email ? [input.cliente.email] : undefined,
    simulate: process.env.BOOKING_SIMULATE === "1" ? true : undefined,
    resourceId: empleado?.id,
    revalidate: empleado
      ? async () => {
          const fl = await footprintLibre(business, startNorm, pB, dur, pA, input.redirectUri, undefined, empleado.id);
          return fl.ok && fl.libre;
        }
      : undefined,
  });
  if (!res.ok) {
    if (res.reason === "slot_taken") return { ok: false, reason: "slot_taken", suggested: res.suggested };
    if (res.reason === "locked") return { ok: false, reason: "locked" };
    const noCal = pareceCalendarioDesconectado(res.detail);
    return { ok: false, reason: noCal ? "no_calendar" : "error", detail: res.detail };
  }

  const record: BookingRecord = {
    id: nuevoId("bk"),
    token: crypto.randomBytes(16).toString("hex"),
    slug: business.slug,
    tenantId: business.tenantId,
    serviceId,
    servicioNombre,
    varianteNombre,
    addonIds,
    addonsNombres,
    durationMin: dur,
    paddingBeforeMin: pB,
    paddingAfterMin: pA,
    precioEUR: precio,
    startIso: startNorm,
    cliente: input.cliente,
    empleadoId: empleado?.id,
    empleadoNombre: empleado?.nombre,
    nota: input.nota,
    comensales: input.comensales,
    zona: input.zona,
    eventId: res.eventId,
    htmlLink: res.htmlLink,
    estado: input.estadoInicial ?? "confirmada",
    origen: "manual",
    tipo: "cita",
    creadaEn: new Date().toISOString(),
  };
  await saveRecord(record);
  await notificarDueno(record, "nueva");
  return { ok: true, record };
}

export type CrearBloqueoInput = { slug: string; startIso: string; durationMin: number; nota?: string; redirectUri: string };

/** Franja no reservable (descanso/vacaciones). Se escribe en Google para bloquear de verdad. */
export async function crearBloqueo(input: CrearBloqueoInput): Promise<CrearReservaResult> {
  const business = await getBusinessBySlug(input.slug);
  if (!business) return { ok: false, reason: "not_found" };
  const dur = Math.max(5, input.durationMin);
  const startNorm = input.startIso.length === 16 ? `${input.startIso}:00` : input.startIso;
  const libre = await footprintLibre(business, startNorm, 0, dur, 0, input.redirectUri);
  if (!libre.ok) return { ok: false, reason: libre.reason === "no_calendar" ? "no_calendar" : "error", detail: libre.detail };
  if (!libre.libre) return { ok: false, reason: "slot_taken" };

  const calendarEmail = await resolveCalendarEmail(business);
  const res = await reservarSlotBooking({
    tenantId: business.tenantId,
    userEmail: calendarEmail,
    redirectUri: input.redirectUri,
    nombre: "Bloqueo",
    motivo: `⛔ Bloqueo${input.nota ? `: ${input.nota}` : ""}`,
    startIso: startNorm,
    durationMin: dur,
    agenteOrigen: "booking",
    simulate: process.env.BOOKING_SIMULATE === "1" ? true : undefined,
  });
  if (!res.ok) {
    if (res.reason === "slot_taken") return { ok: false, reason: "slot_taken", suggested: res.suggested };
    if (res.reason === "locked") return { ok: false, reason: "locked" };
    const noCal = pareceCalendarioDesconectado(res.detail);
    return { ok: false, reason: noCal ? "no_calendar" : "error", detail: res.detail };
  }
  const record: BookingRecord = {
    id: nuevoId("bloq"),
    token: crypto.randomBytes(16).toString("hex"),
    slug: business.slug,
    tenantId: business.tenantId,
    serviceId: "",
    servicioNombre: "Bloqueo",
    durationMin: dur,
    startIso: startNorm,
    cliente: { nombre: "", telefono: "" },
    nota: input.nota,
    eventId: res.eventId,
    htmlLink: res.htmlLink,
    estado: "confirmada",
    origen: "manual",
    tipo: "bloqueo",
    creadaEn: new Date().toISOString(),
  };
  await saveRecord(record);
  return { ok: true, record };
}

export type ReprogramarResult =
  | { ok: true; record: BookingRecord }
  | { ok: false; reason: "not_found" | "no_movible" | "slot_taken" | "locked" | "no_calendar" | "error"; detail?: string; suggested?: string };

/** Mueve una cita/bloqueo a nueva hora (y opcionalmente nueva duración), sin doble reserva. */
export async function reprogramarRecord(
  id: string,
  nuevoStartIso: string,
  nuevaDuracionMin: number | undefined,
  redirectUri: string,
  expectSlug?: string,
): Promise<ReprogramarResult> {
  const record = await getRecord(id);
  if (!record || (expectSlug && record.slug !== expectSlug)) return { ok: false, reason: "not_found" };
  if (!ocupaAgenda(record.estado)) return { ok: false, reason: "no_movible" }; // canceladas/completadas/no-show no se mueven
  const business = await getBusinessBySlug(record.slug);
  if (!business) return { ok: false, reason: "not_found" };

  const startNorm = nuevoStartIso.length === 16 ? `${nuevoStartIso}:00` : nuevoStartIso;
  const dur = nuevaDuracionMin && nuevaDuracionMin >= 5 ? nuevaDuracionMin : record.durationMin;
  const pB = record.paddingBeforeMin ?? 0;
  const pA = record.paddingAfterMin ?? 0;

  // ¿Libre el nuevo footprint? Excluyendo la PROPIA cita (permite moverla a un hueco
  // que se solape con su posición actual, p. ej. adelantarla 15 min). Per-staff si
  // la cita va asignada a un profesional.
  const libre = await footprintLibre(business, startNorm, pB, dur, pA, redirectUri, record.id, record.empleadoId);
  if (!libre.ok) return { ok: false, reason: libre.reason === "no_calendar" ? "no_calendar" : "error", detail: libre.detail };
  if (!libre.libre) return { ok: false, reason: "slot_taken" };

  const esBloqueo = record.tipo === "bloqueo";
  const calendarEmail = await resolveCalendarEmail(business);
  const nombre = esBloqueo ? "Bloqueo" : record.cliente?.nombre || "Cliente";
  const motivo = esBloqueo
    ? `⛔ Bloqueo${record.nota ? `: ${record.nota}` : ""}`
    : [record.servicioNombre, record.varianteNombre].filter(Boolean).join(" · ") +
      (record.addonsNombres?.length ? ` ${record.addonsNombres.map((a) => `+ ${a}`).join(" ")}` : "") +
      (record.nota ? ` — ${record.nota}` : "");
  const telefono = record.cliente?.telefono || undefined;
  const attendees = record.cliente?.email ? [record.cliente.email] : undefined;

  // Mover en Google = borrar el evento viejo y crear el nuevo. Borramos ANTES (para
  // no chocar consigo mismo en movimientos solapados); si la creación falla,
  // restauramos el evento viejo en su sitio para no perder la cita.
  const oldEventId = record.eventId;
  const del = await borrarEventoGoogle(record, redirectUri);
  if (!del.ok) return { ok: false, reason: "error", detail: del.detail };

  const res = await reservarSlotBooking({
    tenantId: business.tenantId, userEmail: calendarEmail, redirectUri, nombre, motivo,
    startIso: shiftLocal(startNorm, -pB),
    durationMin: pB + dur + pA,
    agenteOrigen: "booking", customerPhone: telefono, attendees,
    simulate: process.env.BOOKING_SIMULATE === "1" ? true : undefined,
    resourceId: record.empleadoId,
    revalidate: record.empleadoId
      ? async () => {
          const fl = await footprintLibre(business, startNorm, pB, dur, pA, redirectUri, record.id, record.empleadoId);
          return fl.ok && fl.libre;
        }
      : undefined,
  });
  if (!res.ok) {
    if (oldEventId) {
      const restore = await reservarSlotBooking({
        tenantId: business.tenantId, userEmail: calendarEmail, redirectUri, nombre, motivo,
        startIso: shiftLocal(record.startIso, -pB),
        durationMin: pB + record.durationMin + pA,
        agenteOrigen: "booking", customerPhone: telefono, attendees,
        simulate: process.env.BOOKING_SIMULATE === "1" ? true : undefined,
        resourceId: record.empleadoId,
        revalidate: record.empleadoId
          ? async () => {
              const fl = await footprintLibre(business, record.startIso, pB, record.durationMin, pA, redirectUri, record.id, record.empleadoId);
              return fl.ok && fl.libre;
            }
          : undefined,
      });
      if (restore.ok) await saveRecord({ ...record, eventId: restore.eventId, htmlLink: restore.htmlLink });
    }
    if (res.reason === "slot_taken") return { ok: false, reason: "slot_taken", suggested: res.suggested };
    if (res.reason === "locked") return { ok: false, reason: "locked" };
    const noCal = pareceCalendarioDesconectado(res.detail);
    return { ok: false, reason: noCal ? "no_calendar" : "error", detail: res.detail };
  }

  const updated: BookingRecord = { ...record, startIso: startNorm, durationMin: dur, eventId: res.eventId, htmlLink: res.htmlLink, reprogramadaEn: new Date().toISOString() };
  await saveRecord(updated);
  return { ok: true, record: updated };
}

// -----------------------------------------------------------------------------
// Clientes (CRM) — derivado de las reservas + notas/etiquetas persistidas.
// No hay entidad Cliente separada: se agrega por teléfono (o email/nombre).
// -----------------------------------------------------------------------------

export type ClienteMeta = { notas?: string; etiquetas?: string[]; reactivacionEnviadaIso?: string };
export type ClienteAgg = {
  key: string;
  nombre: string;
  telefono?: string;
  email?: string;
  totalCitas: number;
  completadas: number;
  noShows: number;
  canceladas: number;
  gastoTotal: number;
  ultimaVisitaIso?: string;
  proximaCitaIso?: string;
  etiquetas: string[];
  tieneNotas: boolean;
};
export type ClienteFicha = { cliente: ClienteAgg; historial: BookingRecord[]; meta: ClienteMeta };

const CLIENTES_META_FILE = path.join(DATA_DIR, "booking-clientes-meta.json");
const KV_CLIENTES_META = "booking:clientes-meta";
type ClientesMetaMap = Record<string, ClienteMeta>; // clave `${slug}|${clienteKey}`

/** Identidad estable de un cliente: teléfono normalizado (últimos 9 dígitos) → email → nombre. */
export function clienteKey(c: { telefono?: string; email?: string; nombre?: string }): string {
  const tel = (c.telefono || "").replace(/\D/g, "");
  if (tel.length >= 6) return "t:" + tel.slice(-9);
  if (c.email?.trim()) return "e:" + c.email.trim().toLowerCase();
  return "n:" + (c.nombre || "").trim().toLowerCase();
}

async function readClientesMeta(): Promise<ClientesMetaMap> {
  if (supabaseEnabled()) return (await kvGet<ClientesMetaMap>(KV_CLIENTES_META)) || {};
  return readLocal<ClientesMetaMap>(CLIENTES_META_FILE);
}
async function writeClientesMeta(m: ClientesMetaMap): Promise<void> {
  if (supabaseEnabled()) await kvSet(KV_CLIENTES_META, m);
  else await writeLocal(CLIENTES_META_FILE, m);
}

/** Lista de clientes del negocio (agregada de las reservas), con búsqueda opcional. */
export async function listClientes(slug: string, q?: string): Promise<ClienteAgg[]> {
  const hoy = new Date().toISOString().slice(0, 10);
  const recs = (await listRecords())
    .filter((r) => r.slug === slug && r.tipo !== "bloqueo" && (r.cliente?.nombre || r.cliente?.telefono || r.cliente?.email))
    .sort((a, b) => b.startIso.localeCompare(a.startIso)); // recientes primero → identidad = más reciente
  const meta = await readClientesMeta();
  const map = new Map<string, ClienteAgg>();
  for (const r of recs) {
    const key = clienteKey(r.cliente);
    let a = map.get(key);
    if (!a) {
      const m = meta[`${slug}|${key}`] || {};
      a = {
        key, nombre: r.cliente.nombre || "Cliente", telefono: r.cliente.telefono || undefined, email: r.cliente.email || undefined,
        totalCitas: 0, completadas: 0, noShows: 0, canceladas: 0, gastoTotal: 0, etiquetas: m.etiquetas || [], tieneNotas: !!(m.notas || "").trim(),
      };
      map.set(key, a);
    } else {
      if (!a.telefono && r.cliente.telefono) a.telefono = r.cliente.telefono;
      if (!a.email && r.cliente.email) a.email = r.cliente.email;
    }
    a.totalCitas++;
    if (r.estado === "completada") {
      a.completadas++;
      a.gastoTotal += r.precioEUR || 0;
      if (!a.ultimaVisitaIso || r.startIso > a.ultimaVisitaIso) a.ultimaVisitaIso = r.startIso;
    } else if (r.estado === "no_show") {
      a.noShows++;
    } else if (r.estado === "cancelada") {
      a.canceladas++;
    } else if ((r.estado === "confirmada" || r.estado === "pendiente") && r.startIso.slice(0, 10) >= hoy) {
      if (!a.proximaCitaIso || r.startIso < a.proximaCitaIso) a.proximaCitaIso = r.startIso;
    }
  }
  let out = [...map.values()];
  if (q?.trim()) {
    const s = q.trim().toLowerCase();
    out = out.filter((c) => c.nombre.toLowerCase().includes(s) || (c.telefono || "").includes(s) || (c.email || "").toLowerCase().includes(s));
  }
  out.sort((a, b) =>
    (b.proximaCitaIso ? 1 : 0) - (a.proximaCitaIso ? 1 : 0) ||
    (b.ultimaVisitaIso || "").localeCompare(a.ultimaVisitaIso || "") ||
    a.nombre.localeCompare(b.nombre));
  return out;
}

/** Ficha completa de un cliente: agregados + historial de citas + notas/etiquetas. */
export async function getClienteFicha(slug: string, key: string): Promise<ClienteFicha | null> {
  const historial = (await listRecords())
    .filter((r) => r.slug === slug && r.tipo !== "bloqueo" && clienteKey(r.cliente) === key)
    .sort((a, b) => b.startIso.localeCompare(a.startIso));
  if (historial.length === 0) return null;
  const cliente = (await listClientes(slug)).find((c) => c.key === key);
  if (!cliente) return null;
  const meta = (await readClientesMeta())[`${slug}|${key}`] || {};
  return { cliente, historial, meta };
}

export async function saveClienteMeta(slug: string, key: string, patch: ClienteMeta): Promise<void> {
  const m = await readClientesMeta();
  const k = `${slug}|${key}`;
  m[k] = { ...(m[k] || {}), ...patch };
  await writeClientesMeta(m);
}

// -----------------------------------------------------------------------------
// Reactivación de clientas dormidas — clientas que llevan tiempo sin volver.
// -----------------------------------------------------------------------------

export const DIAS_DORMIDA = 60;    // "dormida" si su última cita fue hace más de esto
export const DIAS_ANTISPAM = 30;   // no reenviar el aviso si ya se mandó hace menos de esto

export type ClienteDormida = {
  key: string;
  nombre: string;
  email: string;
  ultimaCitaIso: string;             // fecha de su última cita pasada
  diasSinVenir: number;
  reactivacionEnviadaIso?: string;   // último email de reactivación (anti-spam)
  diasDesdeAviso?: number;           // días desde ese último aviso
  puedeEnviar: boolean;              // false si ya se le avisó en los últimos DIAS_ANTISPAM
};

/** Días completos entre una fecha ISO (usamos su parte YYYY-MM-DD) y hoy. */
function diasHastaHoy(desdeIso: string): number {
  const a = Date.parse(`${desdeIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Clientas DORMIDAS de un negocio: tienen ≥1 cita pasada (no cancelada), su cita más
 * reciente fue hace más de DIAS_DORMIDA, NO tienen ninguna cita futura agendada y
 * tienen email válido. Incluye el estado anti-spam (si ya se les avisó y cuándo).
 */
export async function listClientesDormidas(slug: string): Promise<ClienteDormida[]> {
  const hoy = new Date().toISOString().slice(0, 10);
  const recs = (await listRecords()).filter((r) => r.slug === slug && r.tipo !== "bloqueo");
  const meta = await readClientesMeta();

  const g = new Map<string, { nombre: string; email?: string; ultimaPasada?: string; tieneFutura: boolean }>();
  for (const r of recs) {
    const key = clienteKey(r.cliente);
    let x = g.get(key);
    if (!x) { x = { nombre: r.cliente?.nombre || "Cliente", email: r.cliente?.email || undefined, tieneFutura: false }; g.set(key, x); }
    if (!x.email && r.cliente?.email) x.email = r.cliente.email;
    if ((x.nombre === "Cliente") && r.cliente?.nombre) x.nombre = r.cliente.nombre;
    const dia = r.startIso.slice(0, 10);
    if (dia >= hoy && (r.estado === "confirmada" || r.estado === "pendiente")) x.tieneFutura = true;
    if (dia < hoy && r.estado !== "cancelada" && (!x.ultimaPasada || r.startIso > x.ultimaPasada)) x.ultimaPasada = r.startIso;
  }

  const out: ClienteDormida[] = [];
  for (const [key, x] of g) {
    if (!x.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email)) continue; // email válido
    if (x.tieneFutura) continue;                                            // sin cita futura
    if (!x.ultimaPasada) continue;                                          // ≥1 cita pasada
    const diasSinVenir = diasHastaHoy(x.ultimaPasada);
    if (diasSinVenir <= DIAS_DORMIDA) continue;                             // más de 60 días
    const enviadaIso = meta[`${slug}|${key}`]?.reactivacionEnviadaIso;
    const diasDesdeAviso = enviadaIso ? diasHastaHoy(enviadaIso) : undefined;
    const puedeEnviar = !enviadaIso || (diasDesdeAviso ?? 999) >= DIAS_ANTISPAM;
    out.push({ key, nombre: x.nombre, email: x.email, ultimaCitaIso: x.ultimaPasada, diasSinVenir, reactivacionEnviadaIso: enviadaIso, diasDesdeAviso, puedeEnviar });
  }
  out.sort((a, b) => b.diasSinVenir - a.diasSinVenir);
  return out;
}

/** Marca que se envió el email de reactivación a esta clienta (ahora). */
export async function marcarReactivacionEnviada(slug: string, key: string): Promise<void> {
  await saveClienteMeta(slug, key, { reactivacionEnviadaIso: new Date().toISOString() });
}

// -----------------------------------------------------------------------------
// Campanita del dueño — notificaciones derivadas de los BookingRecord (mismos
// eventos que disparan el aviso al dueño): cita nueva, cancelada y reprogramada.
// -----------------------------------------------------------------------------

const NOTIF_VENTANA_DIAS = 14; // eventos de las últimas 2 semanas
export type NotifTipo = "nueva" | "cancelada" | "reprogramada";
export type Notificacion = {
  id: string;          // estable por evento (recordId+tipo[+ts])
  tipo: NotifTipo;
  recordId: string;
  cliente: string;
  servicio: string;
  citaIso: string;     // inicio de la cita (para mostrar)
  citaDia: string;     // YYYY-MM-DD de la cita (para navegar la agenda)
  eventoIso: string;   // cuándo ocurrió el evento (orden + no leídas)
};

/** Notificaciones del negocio: nueva/cancelada/reprogramada en la ventana, recientes primero. */
export async function listNotificaciones(slug: string): Promise<Notificacion[]> {
  const desde = Date.now() - NOTIF_VENTANA_DIAS * 86_400_000;
  const enVentana = (iso?: string) => !!iso && !Number.isNaN(Date.parse(iso)) && Date.parse(iso) >= desde;
  const recs = (await listRecords()).filter((r) => r.slug === slug && r.tipo !== "bloqueo");
  const out: Notificacion[] = [];
  for (const r of recs) {
    const base = {
      recordId: r.id,
      cliente: r.cliente?.nombre || "Cliente",
      servicio: [r.servicioNombre, r.varianteNombre].filter(Boolean).join(" · ") || "Cita",
      citaIso: r.startIso,
      citaDia: r.startIso.slice(0, 10),
    };
    if (enVentana(r.creadaEn)) out.push({ ...base, id: `${r.id}:nueva`, tipo: "nueva", eventoIso: r.creadaEn });
    if (r.estado === "cancelada" && enVentana(r.canceladaEn)) out.push({ ...base, id: `${r.id}:cancelada`, tipo: "cancelada", eventoIso: r.canceladaEn! });
    if (enVentana(r.reprogramadaEn)) out.push({ ...base, id: `${r.id}:reprog:${r.reprogramadaEn}`, tipo: "reprogramada", eventoIso: r.reprogramadaEn! });
  }
  out.sort((a, b) => b.eventoIso.localeCompare(a.eventoIso));
  return out;
}

// Estado "leídas" por DUEÑO+negocio: guardamos la marca de tiempo de la última vez
// que abrió la campana; las notificaciones con eventoIso > esa marca son "no leídas".
const NOTIF_SEEN_FILE = path.join(DATA_DIR, "booking-notif-seen.json");
const KV_NOTIF_SEEN = "booking:notif-seen";
type NotifSeenMap = Record<string, string>; // `${slug}|${ownerEmail}` -> lastSeenIso

async function readNotifSeen(): Promise<NotifSeenMap> {
  if (supabaseEnabled()) return (await kvGet<NotifSeenMap>(KV_NOTIF_SEEN)) || {};
  return readLocal<NotifSeenMap>(NOTIF_SEEN_FILE);
}
export async function getNotifSeen(slug: string, ownerEmail: string): Promise<string> {
  return (await readNotifSeen())[`${slug}|${ownerEmail.toLowerCase()}`] || "";
}
export async function setNotifSeen(slug: string, ownerEmail: string, iso: string): Promise<void> {
  const m = await readNotifSeen();
  m[`${slug}|${ownerEmail.toLowerCase()}`] = iso;
  if (supabaseEnabled()) await kvSet(KV_NOTIF_SEEN, m);
  else await writeLocal(NOTIF_SEEN_FILE, m);
}

/**
 * Citas ACTIVAS (futuras y no canceladas) de una clienta en un negocio, identificada
 * por su teléfono (misma normalización que el CRM: últimos 9 dígitos). Recientes primero.
 * La usa la autocancelación por agente (Pablo/Carmen) para pasarle su enlace de token.
 */
export async function citasActivasDeCliente(slug: string, telefono: string): Promise<BookingRecord[]> {
  const hoy = new Date().toISOString().slice(0, 10);
  const key = clienteKey({ telefono });
  return (await listRecords())
    .filter((r) =>
      r.slug === slug &&
      r.tipo !== "bloqueo" &&
      (r.estado === "confirmada" || r.estado === "pendiente") &&
      r.startIso.slice(0, 10) >= hoy &&
      clienteKey(r.cliente) === key,
    )
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}

// -----------------------------------------------------------------------------
// Lista de espera — si no hay hueco un día, el cliente se apunta y se le avisa por
// email en cuanto se libera (tras una cancelación o reprogramación).
// -----------------------------------------------------------------------------

export type EsperaEntry = {
  id: string;
  slug: string;
  serviceId: string;
  servicioNombre: string;
  variantId?: string;
  varianteNombre?: string;
  empleadoId?: string;
  empleadoNombre?: string;
  fecha: string; // "YYYY-MM-DD" día deseado
  cliente: { nombre: string; telefono: string; email?: string };
  estado: "esperando" | "avisado" | "cancelada";
  /** SOLO RESTAURACIÓN: los cuatro datos de la mesa viajan también a la espera. */
  comensales?: number;
  zona?: "terraza" | "interior" | "indiferente";
  /** Hora que pidió y no había, "HH:mm". Sirve para reofertar en su turno. */
  horaPedida?: string;
  creadaEn: string;
  avisadoEn?: string;
};

const ESPERA_FILE = path.join(DATA_DIR, "booking-espera.json");
const KV_ESP_PREFIX = "booking:espera:";
type EsperaMap = Record<string, EsperaEntry>;

async function saveEspera(e: EsperaEntry): Promise<void> {
  if (supabaseEnabled()) { await kvSet(KV_ESP_PREFIX + e.id, e); return; }
  const m = await readLocal<EsperaMap>(ESPERA_FILE);
  m[e.id] = e;
  await writeLocal(ESPERA_FILE, m);
}

export async function listEspera(slug: string): Promise<EsperaEntry[]> {
  let all: EsperaEntry[];
  if (supabaseEnabled()) all = (await kvListByPrefix<EsperaEntry>(KV_ESP_PREFIX)).map((x) => x.value);
  else all = Object.values(await readLocal<EsperaMap>(ESPERA_FILE));
  return all.filter((e) => e.slug === slug).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creadaEn.localeCompare(b.creadaEn));
}

export type CrearEsperaInput = {
  slug: string; serviceId: string; variantId?: string; empleadoId?: string; fecha: string;
  cliente: { nombre: string; telefono: string; email?: string };
  /** SOLO RESTAURACIÓN. Ausentes en los demás sectores, como hasta ahora. */
  comensales?: number;
  zona?: "terraza" | "interior" | "indiferente";
  horaPedida?: string;
};

export async function crearEspera(input: CrearEsperaInput): Promise<{ ok: true; entry: EsperaEntry } | { ok: false; reason: "not_found" | "service_not_found" }> {
  const business = await getBusinessBySlug(input.slug);
  if (!business) return { ok: false, reason: "not_found" };
  const service = business.servicios.find((s) => s.id === input.serviceId && s.activo);
  if (!service) return { ok: false, reason: "service_not_found" };
  const variante = service.variantes?.find((v) => v.id === input.variantId);
  const empleado = getEmpleado(business, input.empleadoId);
  const entry: EsperaEntry = {
    id: nuevoId("esp"), slug: business.slug, serviceId: service.id, servicioNombre: service.nombre,
    variantId: input.variantId, varianteNombre: variante?.nombre,
    empleadoId: empleado?.id, empleadoNombre: empleado?.nombre,
    fecha: input.fecha, cliente: input.cliente, estado: "esperando",
    comensales: input.comensales, zona: input.zona, horaPedida: input.horaPedida,
    creadaEn: new Date().toISOString(),
  };
  await saveEspera(entry);
  return { ok: true, entry };
}

/** Marca una entrada de espera como cancelada (gestión del dueño). */
export async function cancelarEspera(slug: string, id: string): Promise<boolean> {
  const e = (await listEspera(slug)).find((x) => x.id === id);
  if (!e) return false;
  await saveEspera({ ...e, estado: "cancelada" });
  return true;
}

/**
 * Tras liberarse un hueco el día `fecha`, avisa por email a quien esté esperando y
 * cuya elección (servicio/variante/empleado) tenga ahora hueco. Best-effort.
 * `notify` inyecta el envío para no acoplar el email a esta capa. Devuelve nº avisados.
 */
export async function notificarEsperaSiLibre(
  slug: string,
  fecha: string,
  redirectUri: string,
  notify: (entry: EsperaEntry, business: BusinessBooking) => Promise<unknown>,
): Promise<number> {
  const business = await getBusinessBySlug(slug);
  if (!business) return 0;
  const entries = (await listEspera(slug)).filter((e) => e.estado === "esperando" && e.fecha === fecha);
  let avisados = 0;
  for (const e of entries) {
    const service = business.servicios.find((s) => s.id === e.serviceId);
    if (!service) continue;
    const sel = resolverServicio(service, { variantId: e.variantId });
    const eligibles = empleadosDeServicio(business, service.id);
    let hay = false;
    if (e.empleadoId) {
      const r = await computeFreeSlots(business, sel, fecha, redirectUri, undefined, e.empleadoId);
      hay = r.ok && r.slots.length > 0;
    } else if (eligibles.length === 0) {
      const r = await computeFreeSlots(business, sel, fecha, redirectUri);
      hay = r.ok && r.slots.length > 0;
    } else {
      for (const emp of eligibles) {
        const r = await computeFreeSlots(business, sel, fecha, redirectUri, undefined, emp.id);
        if (r.ok && r.slots.length > 0) { hay = true; break; }
      }
    }
    if (!hay) continue;
    await saveEspera({ ...e, estado: "avisado", avisadoEn: new Date().toISOString() });
    try { await notify(e, business); } catch { /* best-effort */ }
    avisados++;
  }
  return avisados;
}

// -----------------------------------------------------------------------------
// Informes — resumen del negocio en un periodo (derivado de las reservas).
// Sin pagos online: "ingresos" = precio de las citas COMPLETADAS.
// -----------------------------------------------------------------------------

export type Informe = {
  from: string; to: string;
  ingresos: number;
  citas: { total: number; completadas: number; confirmadas: number; canceladas: number; noShow: number };
  tasaNoShow: number; // % sobre completadas+no_show
  clientes: { nuevos: number; recurrentes: number };
  ocupacion: { reservadoMin: number; capacidadMin: number; pct: number };
  porEmpleado: { id: string; nombre: string; ingresos: number; citas: number }[];
  porServicio: { id: string; nombre: string; ingresos: number; citas: number }[];
};

function diaSiguiente(dateStr: string): string {
  const dt = new Date(`${dateStr}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

/** Capacidad estimada del periodo = minutos abiertos por día × nº de empleados activos (o 1). */
function capacidadPeriodo(business: BusinessBooking | null, from: string, to: string): number {
  if (!business) return 0;
  const nStaff = Math.max(1, (business.empleados || []).filter((e) => e.activo).length);
  let total = 0;
  let d = from;
  for (let guard = 0; d <= to && guard < 400; guard++, d = diaSiguiente(d)) {
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    const day = business.horario[wd];
    if (day?.abierto) for (const f of day.franjas) {
      const [dh, dm] = f.desde.split(":").map(Number);
      const [hh, hm] = f.hasta.split(":").map(Number);
      total += (hh * 60 + hm) - (dh * 60 + dm);
    }
  }
  return total * nStaff;
}

export async function informe(slug: string, fromDate: string, toDate: string): Promise<Informe> {
  const business = await getBusinessBySlug(slug);
  const all = (await listRecords()).filter((r) => r.slug === slug && r.tipo !== "bloqueo");
  const enRango = all.filter((r) => { const d = r.startIso.slice(0, 10); return d >= fromDate && d <= toDate; });

  let ingresos = 0, completadas = 0, confirmadas = 0, canceladas = 0, noShow = 0, reservadoMin = 0;
  const empAcc: Record<string, { nombre: string; ingresos: number; citas: number }> = {};
  const svcAcc: Record<string, { nombre: string; ingresos: number; citas: number }> = {};
  for (const r of enRango) {
    if (r.estado === "completada") { completadas++; ingresos += r.precioEUR || 0; reservadoMin += r.durationMin; }
    else if (r.estado === "confirmada" || r.estado === "pendiente") { confirmadas++; reservadoMin += r.durationMin; }
    else if (r.estado === "cancelada") { canceladas++; }
    else if (r.estado === "no_show") { noShow++; }
    if (r.estado === "completada" || r.estado === "confirmada" || r.estado === "pendiente") {
      const e = (empAcc[r.empleadoId || "_sin"] ||= { nombre: r.empleadoNombre || "Sin asignar", ingresos: 0, citas: 0 });
      e.citas++; if (r.estado === "completada") e.ingresos += r.precioEUR || 0;
      const s = (svcAcc[r.serviceId || "_otro"] ||= { nombre: r.servicioNombre || "—", ingresos: 0, citas: 0 });
      s.citas++; if (r.estado === "completada") s.ingresos += r.precioEUR || 0;
    }
  }
  const tasaNoShow = completadas + noShow > 0 ? Math.round((noShow / (completadas + noShow)) * 100) : 0;

  // Nuevos vs recurrentes: cliente con cita en el rango; nuevo si su PRIMERA cita (global) cae en el rango.
  const primera: Record<string, string> = {};
  for (const r of all) { const k = clienteKey(r.cliente); if (!primera[k] || r.startIso < primera[k]) primera[k] = r.startIso; }
  let nuevos = 0, recurrentes = 0;
  for (const k of new Set(enRango.map((r) => clienteKey(r.cliente)))) {
    const p = primera[k]?.slice(0, 10);
    if (p && p >= fromDate && p <= toDate) nuevos++; else recurrentes++;
  }

  const capacidadMin = capacidadPeriodo(business, fromDate, toDate);
  const porEmpleado = Object.entries(empAcc).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.ingresos - a.ingresos || b.citas - a.citas);
  const porServicio = Object.entries(svcAcc).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.ingresos - a.ingresos || b.citas - a.citas);

  return {
    from: fromDate, to: toDate, ingresos,
    citas: { total: enRango.length, completadas, confirmadas, canceladas, noShow },
    tasaNoShow,
    clientes: { nuevos, recurrentes },
    ocupacion: { reservadoMin, capacidadMin, pct: capacidadMin > 0 ? Math.round((reservadoMin / capacidadMin) * 100) : 0 },
    porEmpleado, porServicio,
  };
}

// -----------------------------------------------------------------------------
// Seed — negocio demo de estética estilo Booksy (precargado y editable)
// -----------------------------------------------------------------------------

function seedBusinesses(): ConfigMap {
  const laborable: DayHours = { abierto: true, franjas: [{ desde: "09:00", hasta: "14:00" }, { desde: "16:00", hasta: "20:00" }] };
  const sabado: DayHours = { abierto: true, franjas: [{ desde: "10:00", hasta: "14:00" }] };
  const cerrado: DayHours = { abierto: false, franjas: [] };

  const categorias: Categoria[] = [
    { id: "cat_depil", nombre: "Depilación" },
    { id: "cat_facial", nombre: "Faciales" },
    { id: "cat_unas", nombre: "Uñas" },
    { id: "cat_masaje", nombre: "Masajes" },
    { id: "cat_corporal", nombre: "Corporales" },
    { id: "cat_pestanas", nombre: "Extensiones de pestañas" },
    { id: "cat_micro", nombre: "Microblading" },
  ];

  const servicios: BookingService[] = [
    { id: "svc_cejas", categoriaId: "cat_depil", nombre: "Depilación de cejas", descripcion: "Perfilado y depilado de cejas con cera o hilo.", durationMin: 15, precioEUR: 12, paddingAfterMin: 5, activo: true },
    {
      id: "svc_laser", categoriaId: "cat_depil", nombre: "Depilación láser",
      descripcion: "Láser de diodo. Elige la zona.", activo: true, durationMin: 20, paddingAfterMin: 10,
      variantes: [
        { id: "v_axilas", nombre: "Axilas", durationMin: 15, precioEUR: 25 },
        { id: "v_ingles", nombre: "Ingles", durationMin: 20, precioEUR: 35 },
        { id: "v_piernas", nombre: "Piernas enteras", durationMin: 45, precioEUR: 70 },
      ],
    },
    {
      id: "svc_limpieza", categoriaId: "cat_facial", nombre: "Limpieza facial profunda",
      descripcion: "Higiene facial completa con extracción e hidratación.", durationMin: 45, precioEUR: 45, paddingAfterMin: 10, activo: true,
      addons: [
        { id: "a_led", nombre: "Máscara LED", durationMin: 15, precioEUR: 15, activo: true },
        { id: "a_acido", nombre: "Ácido hialurónico", durationMin: 10, precioEUR: 20, activo: true },
      ],
    },
    { id: "svc_facialpremium", categoriaId: "cat_facial", nombre: "Facial antiedad premium", descripcion: "Tratamiento intensivo con radiofrecuencia.", durationMin: 60, precioEUR: 80, paddingAfterMin: 10, activo: true },
    {
      id: "svc_mani", categoriaId: "cat_unas", nombre: "Manicura", activo: true, durationMin: 30, precioEUR: 18,
      variantes: [
        { id: "v_normal", nombre: "Esmaltado normal", durationMin: 30, precioEUR: 18 },
        { id: "v_semi", nombre: "Semipermanente", durationMin: 45, precioEUR: 25 },
      ],
    },
    { id: "svc_pedi", categoriaId: "cat_unas", nombre: "Pedicura spa", descripcion: "Con exfoliación e hidratación.", durationMin: 45, precioEUR: 28, activo: true },
    {
      id: "svc_masaje", categoriaId: "cat_masaje", nombre: "Masaje relajante", activo: true, durationMin: 30, precioEUR: 30, paddingBeforeMin: 5, paddingAfterMin: 5,
      variantes: [
        { id: "v_30", nombre: "30 minutos", durationMin: 30, precioEUR: 30 },
        { id: "v_60", nombre: "60 minutos", durationMin: 60, precioEUR: 55 },
      ],
    },
    { id: "svc_corporal", categoriaId: "cat_corporal", nombre: "Tratamiento corporal reductor", descripcion: "Sesión anticelulítica/reafirmante.", durationMin: 60, precioEUR: 60, paddingAfterMin: 10, activo: true },
    { id: "svc_pestanas", categoriaId: "cat_pestanas", nombre: "Extensiones de pestañas pelo a pelo", descripcion: "Técnica clásica, efecto natural.", durationMin: 90, precioEUR: 65, paddingBeforeMin: 10, paddingAfterMin: 10, activo: true },
    { id: "svc_micro", categoriaId: "cat_micro", nombre: "Microblading de cejas", descripcion: "Micropigmentación pelo a pelo. Incluye retoque a las 4-6 semanas.", durationMin: 120, precioEUR: 250, paddingBeforeMin: 15, paddingAfterMin: 15, activo: true },
  ];

  const demo: BusinessBooking = {
    slug: "demo",
    tenantId: DEFAULT_TENANT_ID,
    nombre: "Clínica Bella (demo)",
    descripcion: "Centro de estética y belleza. Reserva online en segundos — cancelación gratis, sin comisiones.",
    galeria: [
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=640&h=440&fit=crop&q=80",
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=640&h=440&fit=crop&q=80",
      "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=640&h=440&fit=crop&q=80",
    ],
    direccion: "Av. Ricardo Soriano 42, 29601 Marbella, Málaga",
    lat: 36.5085,
    lng: -4.8878,
    telefono: "+34 600 123 456",
    timezone: "Europe/Madrid",
    slotStepMin: 15,
    leadTimeMin: 60,
    cancelAntelacionMin: 120,
    categorias,
    servicios,
    empleados: [
      { id: "emp_ana", nombre: "Ana", color: "#C8202A", activo: true, serviceIds: ["svc_limpieza", "svc_facialpremium", "svc_mani", "svc_pedi", "svc_pestanas", "svc_micro"] },
      { id: "emp_berta", nombre: "Berta", color: "#5A6B3F", activo: true, serviceIds: ["svc_cejas", "svc_laser", "svc_masaje", "svc_corporal", "svc_mani"] },
    ],
    horario: { 0: cerrado, 1: laborable, 2: laborable, 3: laborable, 4: laborable, 5: laborable, 6: sabado },
  };
  return { demo };
}
