// Petición de reseña por WhatsApp. Para TODOS los sectores, no solo gestoría.
//
// Es la palanca más barata que tiene un negocio local: al cliente contento se le
// manda el enlace directo de Google y se acabó. Lo que la hace peligrosa es
// exactamente lo mismo que la hace barata —es un mensaje no solicitado—, así que
// lleva sus frenos y ninguno es opcional:
//
//   1. Se manda AL DÍA SIGUIENTE del servicio, en horario decente (10–20 h),
//      no al salir por la puerta. En caliente suena a que le estás cobrando el favor.
//   2. UNA VEZ cada 90 días por clienta, aunque venga cada semana.
//   3. Solo a quien la cita le salió: realizada (`completada`, o `confirmada` que
//      ya pasó). Nunca a quien anuló ni a quien no se presentó.
//   4. Sin enlace de reseñas en la ficha del negocio, no se manda nada.
//   5. Si contesta con una QUEJA, no se le insiste y se avisa a la dueña.
//   6. Va fuera de la ventana de 24 h de WhatsApp: solo por PLANTILLA
//      (`aiteam_pedir_resena`) y detrás de REVIEW_REQUEST_ENABLED, apagado hasta
//      que Meta la apruebe.

import "server-only";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";
import fs from "node:fs/promises";
import path from "node:path";
import type { BookingRecord, BusinessBooking } from "./booking";

/** Envío real. FAIL-CLOSED, igual que el resto de interruptores del sistema. */
export const resenaSendEnabled = (): boolean =>
  (process.env.REVIEW_REQUEST_ENABLED || "").toLowerCase() === "true";

/** Plantilla aprobada en Meta (variables: nombre, negocio, enlace). */
export const plantillaResena = (): string => process.env.REVIEW_REQUEST_TEMPLATE || "aiteam_pedir_resena";

/** Una vez cada 90 días por clienta. */
export const DIAS_ENTRE_PETICIONES = 90;
/** Tras una queja no se le vuelve a pedir en un año. */
export const DIAS_TRAS_QUEJA = 365;

/** Se pide al día siguiente del servicio. */
export const DIAS_TRAS_SERVICIO = 1;

/** Horas (España) en las que se puede mandar: el cron es horario. */
export const HORA_DESDE = 10;
export const HORA_HASTA = 20;

// -----------------------------------------------------------------------------
// Registro de a quién se le ha pedido ya
// -----------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "resenas-pedidas.json");
const KV_KEY = (slug: string) => `resenas:pedidas:${slug}`;
/** teléfono normalizado → ISO de la última petición. */
type Pedidas = Record<string, string>;

const soloDigitos = (t: string) => (t || "").replace(/\D/g, "");

export async function listarPedidas(slug: string): Promise<Pedidas> {
  if (supabaseEnabled()) return (await kvGet<Pedidas>(KV_KEY(slug))) ?? {};
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    const all = raw.trim() ? (JSON.parse(raw) as Record<string, Pedidas>) : {};
    return all[slug] ?? {};
  } catch {
    return {};
  }
}

export async function marcarPedida(slug: string, telefono: string, cuando = new Date()): Promise<void> {
  const clave = soloDigitos(telefono);
  if (!clave) return;
  const previas = await listarPedidas(slug);
  const next = { ...previas, [clave]: cuando.toISOString() };
  if (supabaseEnabled()) {
    await kvSet(KV_KEY(slug), next);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
  const all = raw.trim() ? (JSON.parse(raw) as Record<string, Pedidas>) : {};
  all[slug] = next;
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

const FILE_QUEJAS = path.join(DATA_DIR, "resenas-quejas.json");
const KV_QUEJAS = (slug: string) => `resenas:quejas:${slug}`;

export async function listarQuejas(slug: string): Promise<Pedidas> {
  if (supabaseEnabled()) return (await kvGet<Pedidas>(KV_QUEJAS(slug))) ?? {};
  const raw = await fs.readFile(FILE_QUEJAS, "utf-8").catch(() => "{}");
  return ((raw.trim() ? JSON.parse(raw) : {}) as Record<string, Pedidas>)[slug] ?? {};
}

/** Contestó a la petición con una queja: no se le vuelve a pedir reseña en un año. */
export async function marcarQueja(slug: string, telefono: string, cuando = new Date()): Promise<void> {
  const clave = soloDigitos(telefono);
  if (!clave) return;
  const next = { ...(await listarQuejas(slug)), [clave]: cuando.toISOString() };
  if (supabaseEnabled()) { await kvSet(KV_QUEJAS(slug), next); return; }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(FILE_QUEJAS, "utf-8").catch(() => "{}");
  const all = raw.trim() ? (JSON.parse(raw) as Record<string, Pedidas>) : {};
  all[slug] = next;
  const tmp = `${FILE_QUEJAS}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(all, null, 2));
  await fs.rename(tmp, FILE_QUEJAS);
}

/** ¿Se le pidió reseña hace poco (para leer su respuesta como respuesta a eso)? */
export async function pedidaHaceNada(slug: string, telefono: string, dias = 7, ahora = new Date()): Promise<boolean> {
  const p = (await listarPedidas(slug))[soloDigitos(telefono)];
  return !!p && ahora.getTime() - Date.parse(p) <= dias * 86_400_000;
}

/** ¿La respuesta es una queja? Reglas, sin IA: mejor avisar de más a la dueña que de menos. */
export function esQueja(texto: string): boolean {
  const t = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b(no (me )?(gusto|quede contenta|quede contento|volvere)|queja|reclamacion|fatal|horrible|mal(isim[oa])?\b|mala experiencia|decepcion|decepcionad|me hicieron dano|me quemaron|estropead|chapuza|nada contenta|nada contento|no estoy contenta|no estoy contento|muy caro|me cobraron de mas|llegue y no|me dejaron esperando|esperando (una|mas de)|impuntual|mal atendid|borde|maleducad|terrible|awful|bad experience|not happy|disappointed|complain)/.test(t)) return true;
  return false;
}

// -----------------------------------------------------------------------------
// Decisión — pura y comprobable
// -----------------------------------------------------------------------------

export type PeticionResena = { record: BookingRecord; telefono: string; texto: string };

/** ¿Han pasado ya los 90 días desde la última petición (y el año desde una queja)? */
export function puedePedirse(pedidas: Pedidas, telefono: string, ahora = new Date(), quejas: Pedidas = {}): boolean {
  const q = quejas[soloDigitos(telefono)];
  if (q && ahora.getTime() - Date.parse(q) < DIAS_TRAS_QUEJA * 86_400_000) return false;
  const ultima = pedidas[soloDigitos(telefono)];
  if (!ultima) return true;
  return ahora.getTime() - new Date(ultima).getTime() >= DIAS_ENTRE_PETICIONES * 86_400_000;
}

/**
 * El enlace de reseña del negocio. Se configura POR NEGOCIO: cada uno tiene su
 * ficha de Google y no hay forma de deducirlo. Sin enlace no se pide nada — un
 * mensaje que dice "déjanos una reseña" sin decir dónde es ruido.
 */
export const enlaceResena = (b: BusinessBooking): string | undefined =>
  b.resenaUrl?.trim() || undefined;

/** Las variables de la plantilla `aiteam_pedir_resena`, en orden: nombre, negocio, enlace. */
export function variablesPeticion(b: BusinessBooking, nombreCliente: string): string[] {
  return [(nombreCliente || "").split(" ")[0] || "—", b.nombre, enlaceResena(b) || ""];
}

/** El mismo mensaje en texto (vista previa y pruebas). Estilo de casa: corto, sin emojis. */
export function textoPeticion(b: BusinessBooking, nombreCliente: string): string {
  const [nombre, negocio, enlace] = variablesPeticion(b, nombreCliente);
  return `Hola ${nombre}, gracias por venir ayer a ${negocio}. Si te quedaste a gusto, nos ayudaría mucho una reseña en Google: ${enlace}\nSi algo no fue bien, contéstanos a este mensaje y lo vemos.`;
}

/** Hora de España ahora (0–23). */
export function horaEspana(ahora = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(ahora)) % 24;
}

/**
 * A quién habría que pedirle reseña hoy. NO envía: devuelve la lista para que
 * quien llame decida, y solo si el flag está encendido.
 *
 * `records` son los del negocio; `pedidas`, el registro de peticiones previas.
 */
export function peticionesDeHoy(opts: {
  business: BusinessBooking;
  records: BookingRecord[];
  pedidas: Pedidas;
  quejas?: Pedidas;
  ahora?: Date;
}): PeticionResena[] {
  const ahora = opts.ahora ?? new Date();
  if (!enlaceResena(opts.business)) return [];

  // El día del que toca pedir: ayer (en España).
  const objetivo = new Date(ahora.getTime() - DIAS_TRAS_SERVICIO * 86_400_000)
    .toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });

  const out: PeticionResena[] = [];
  const yaEnEstaTanda = new Set<string>();

  for (const r of opts.records) {
    if (r.tipo === "bloqueo") continue;
    // Solo citas REALIZADAS: marcada como completada, o confirmada y ya pasada
    // (muchos salones no la marcan). Anuladas, no presentadas o pendientes, no.
    if (r.estado !== "completada" && r.estado !== "confirmada") continue;
    if (r.startIso.slice(0, 10) !== objetivo) continue;

    const tel = r.cliente?.telefono || "";
    const clave = soloDigitos(tel);
    if (!clave || yaEnEstaTanda.has(clave)) continue;
    if (!puedePedirse(opts.pedidas, tel, ahora, opts.quejas)) continue;

    yaEnEstaTanda.add(clave);
    out.push({ record: r, telefono: tel, texto: textoPeticion(opts.business, r.cliente?.nombre || "") });
  }
  return out;
}
