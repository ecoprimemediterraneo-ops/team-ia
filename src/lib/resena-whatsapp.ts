// Petición de reseña por WhatsApp. Para TODOS los sectores, no solo gestoría.
//
// Es la palanca más barata que tiene un negocio local: al cliente contento se le
// manda el enlace directo de Google y se acabó. Lo que la hace peligrosa es
// exactamente lo mismo que la hace barata —es un mensaje no solicitado—, así que
// lleva tres frenos y ninguno es opcional:
//
//   1. Se manda AL DÍA SIGUIENTE del servicio, no al salir por la puerta. En
//      caliente suena a que le estás cobrando el favor.
//   2. UNA VEZ cada 6 meses por cliente, aunque venga cada semana. Un cliente
//      fiel al que le pides reseña cada visita deja de ser un cliente fiel.
//   3. El envío real está detrás de un flag apagado por defecto.
//
// Solo se le pide a quien la cita le salió BIEN: `completada`. A quien canceló o
// no apareció no se le pide nada.

import "server-only";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";
import fs from "node:fs/promises";
import path from "node:path";
import type { BookingRecord, BusinessBooking } from "./booking";

/** Envío real. FAIL-CLOSED, igual que el resto de interruptores del sistema. */
export const resenaSendEnabled = (): boolean =>
  (process.env.RESENA_SEND_ENABLED || "").toLowerCase() === "true";

/** Una vez cada seis meses por cliente. */
export const MESES_ENTRE_PETICIONES = 6;

/** Se pide al día siguiente del servicio. */
export const DIAS_TRAS_SERVICIO = 1;

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

// -----------------------------------------------------------------------------
// Decisión — pura y comprobable
// -----------------------------------------------------------------------------

export type PeticionResena = { record: BookingRecord; telefono: string; texto: string };

/** ¿Han pasado ya los seis meses desde la última vez que se le pidió? */
export function puedePedirse(pedidas: Pedidas, telefono: string, ahora = new Date()): boolean {
  const ultima = pedidas[soloDigitos(telefono)];
  if (!ultima) return true;
  const meses = (ahora.getTime() - new Date(ultima).getTime()) / (30 * 86_400_000);
  return meses >= MESES_ENTRE_PETICIONES;
}

/**
 * El enlace de reseña del negocio. Se configura POR NEGOCIO: cada uno tiene su
 * ficha de Google y no hay forma de deducirlo. Sin enlace no se pide nada — un
 * mensaje que dice "déjanos una reseña" sin decir dónde es ruido.
 */
export const enlaceResena = (b: BusinessBooking): string | undefined =>
  b.resenaUrl?.trim() || undefined;

export function textoPeticion(b: BusinessBooking, nombreCliente: string): string {
  const enlace = enlaceResena(b);
  const nombre = (nombreCliente || "").split(" ")[0];
  return (
    `¡Hola${nombre ? ` ${nombre}` : ""}! Gracias por venir a ${b.nombre} 🙌\n\n` +
    `Si te quedaste a gusto, ¿nos dejas una reseña? Nos ayuda muchísimo y se tarda un minuto:\n${enlace}`
  );
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
  ahora?: Date;
}): PeticionResena[] {
  const ahora = opts.ahora ?? new Date();
  if (!enlaceResena(opts.business)) return [];

  // El día del que toca pedir: ayer.
  const objetivo = new Date(ahora.getTime() - DIAS_TRAS_SERVICIO * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const out: PeticionResena[] = [];
  const yaEnEstaTanda = new Set<string>();

  for (const r of opts.records) {
    if (r.tipo === "bloqueo") continue;
    // Solo a quien vino y le fue bien. A un no-show no se le pide reseña.
    if (r.estado !== "completada") continue;
    if (r.startIso.slice(0, 10) !== objetivo) continue;

    const tel = r.cliente?.telefono || "";
    const clave = soloDigitos(tel);
    if (!clave || yaEnEstaTanda.has(clave)) continue;
    if (!puedePedirse(opts.pedidas, tel, ahora)) continue;

    yaEnEstaTanda.add(clave);
    out.push({ record: r, telefono: tel, texto: textoPeticion(opts.business, r.cliente?.nombre || "") });
  }
  return out;
}
