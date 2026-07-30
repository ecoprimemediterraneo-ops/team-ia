// =============================================================================
// LISTA DE ESPERA INTELIGENTE (FASE 2)
//
// Cuando se libera un hueco (tras una cancelación), ofrece por WhatsApp a UNA
// clienta de la lista de espera adelantar su cita — con frenos de seguridad.
//
// REUTILIZA (no reinventa nada):
//   - whatsapp-sender.ts  → sendWhatsAppText (envío real Meta Cloud API, el de Pablo)
//   - booking.ts          → listEspera / cancelarEspera / getBusinessBySlug /
//                            listRecords / getRecord / reprogramarRecord / clienteKey
//   - supabase.ts         → KV con fallback a JSON local (mismo patrón que booking)
//
// FRENOS: flag WAITLIST_SEND_ENABLED (default OFF → registra sin enviar),
// anti-duplicado, tope por clienta/día y por salón/día, ventana horaria 9–21,
// UNA oferta viva por hueco (una persona a la vez) con caducidad, e idempotencia
// (id de oferta determinista por slug|espera|hueco).
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { kvGet, kvSet, kvListByPrefix, supabaseEnabled } from "./supabase";
import { sendWhatsAppText } from "./whatsapp-sender";
import {
  listEspera,
  cancelarEspera,
  getBusinessBySlug,
  getRecord,
  listRecords,
  reprogramarRecord,
  clienteKey,
  type EsperaEntry,
  type BookingRecord,
} from "./booking";

// -----------------------------------------------------------------------------
// Config (variables de entorno con valores por defecto seguros)
// -----------------------------------------------------------------------------

/** Interruptor maestro. OFF por defecto: todo funciona pero NO se envía WhatsApp
 *  real (las ofertas quedan registradas con motivoNoEnvio="flag_off"). */
export function waitlistSendEnabled(): boolean {
  return (process.env.WAITLIST_SEND_ENABLED || "").toLowerCase() === "true";
}

function num(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}
const MAX_CLIENTA_DIA = num(process.env.WAITLIST_MAX_POR_CLIENTA_DIA, 1);
const MAX_SALON_DIA = num(process.env.WAITLIST_MAX_POR_SALON_DIA, 30);
const VENTANA_DESDE = num(process.env.WAITLIST_VENTANA_DESDE_H, 9); // 09:00
const VENTANA_HASTA = num(process.env.WAITLIST_VENTANA_HASTA_H, 21); // 21:00
const RESP_MIN = num(process.env.WAITLIST_RESP_MIN, 45); // minutos de espera de respuesta antes de pasar a la siguiente

// -----------------------------------------------------------------------------
// Tipos + persistencia (ledger de ofertas/envíos)
// -----------------------------------------------------------------------------

export type WaitlistOfferEstado =
  | "ofrecida" // enviada, esperando respuesta
  | "aceptada" // clienta dijo que sí → cita reasignada
  | "rechazada" // clienta dijo que no
  | "expirada" // no respondió a tiempo → pasa a la siguiente
  | "registrada_sin_enviar"; // no se envió (flag off, fuera de ventana, tope…)

export type WaitlistOffer = {
  id: string;
  slug: string;
  esperaId: string;
  clienteNombre: string;
  clienteTelefono: string;
  huecoStartIso: string; // slot liberado que se ofrece
  huecoServiceId: string;
  huecoServicioNombre: string;
  empleadoId?: string;
  recordActualId: string; // cita lejana de la clienta que se adelantaría
  recordActualStartIso: string;
  mensaje: string; // texto exacto del WhatsApp
  estado: WaitlistOfferEstado;
  enviado: boolean; // salió de verdad por WhatsApp
  mensajeId?: string; // id de Meta si se envió
  motivoNoEnvio?: string; // "flag_off" | "fuera_de_ventana" | "rate_limit_clienta" | "rate_limit_salon" | "graph_error:…"
  ofrecidoEn: string;
  resueltoEn?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const OFFERS_FILE = path.join(DATA_DIR, "booking-waitlist-offers.json");
const KV_OFFER = "booking:wloffer:";
type OfferMap = Record<string, WaitlistOffer>;

async function readOffersLocal(): Promise<OfferMap> {
  try {
    return JSON.parse(await fs.readFile(OFFERS_FILE, "utf8")) as OfferMap;
  } catch {
    return {};
  }
}
async function writeOffersLocal(m: OfferMap): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(OFFERS_FILE, JSON.stringify(m, null, 2), "utf8");
}
async function saveOffer(o: WaitlistOffer): Promise<void> {
  if (supabaseEnabled()) {
    await kvSet(KV_OFFER + o.id, o);
    return;
  }
  const m = await readOffersLocal();
  m[o.id] = o;
  await writeOffersLocal(m);
}
async function getOffer(id: string): Promise<WaitlistOffer | null> {
  if (supabaseEnabled()) return (await kvGet<WaitlistOffer>(KV_OFFER + id)) ?? null;
  return (await readOffersLocal())[id] ?? null;
}
export async function listOffers(slug?: string): Promise<WaitlistOffer[]> {
  let all: WaitlistOffer[];
  if (supabaseEnabled()) all = (await kvListByPrefix<WaitlistOffer>(KV_OFFER)).map((x) => x.value);
  else all = Object.values(await readOffersLocal());
  return (slug ? all.filter((o) => o.slug === slug) : all).sort((a, b) => a.ofrecidoEn.localeCompare(b.ofrecidoEn));
}

function offerId(slug: string, esperaId: string, huecoStartIso: string): string {
  return "wlo_" + crypto.createHash("sha1").update(`${slug}|${esperaId}|${huecoStartIso}`).digest("hex").slice(0, 16);
}

// -----------------------------------------------------------------------------
// Helpers de tiempo y formato
// -----------------------------------------------------------------------------

function horaEnZona(tz: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date()));
}
function fechaDe(d: Date, tz: string): string {
  // en-CA → "YYYY-MM-DD"
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function caducada(o: WaitlistOffer): boolean {
  return Date.now() - new Date(o.ofrecidoEn).getTime() > RESP_MIN * 60_000;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function fmt(startIso: string): string {
  const [dp, tp = "00:00:00"] = startIso.split("T");
  const [y, m, d] = dp.split("-").map(Number);
  const hhmm = tp.slice(0, 5);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return `${DIAS[dow]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")} a las ${hhmm}`;
}

/** Texto del WhatsApp de oferta (exportado para la ruta de prueba). */
export function textoOferta(a: {
  nombre: string;
  salon: string;
  servicio: string;
  huecoStartIso: string;
  actualStartIso: string;
}): string {
  const first = (a.nombre || "").trim().split(/\s+/)[0] || "";
  return [
    `¡Hola${first ? " " + first : ""}! 👋 Te escribo de *${a.salon}*.`,
    ``,
    `Se ha liberado un hueco *${fmt(a.huecoStartIso)}* para tu *${a.servicio}* — bastante antes de tu cita del ${fmt(a.actualStartIso)}.`,
    ``,
    `¿Quieres adelantarla a ese hueco? Responde *SÍ* y te lo cambio. Si prefieres mantener tu cita, no hagas nada 🙂`,
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Selección de la clienta adecuada
// -----------------------------------------------------------------------------

/** Próxima cita de la clienta POSTERIOR al hueco liberado (la que se adelantaría). */
async function citaActualPosterior(
  slug: string,
  telefono: string,
  huecoStartIso: string,
  serviceId?: string,
): Promise<BookingRecord | null> {
  const key = clienteKey({ telefono });
  const recs = (await listRecords())
    .filter(
      (r) =>
        r.slug === slug &&
        r.tipo !== "bloqueo" &&
        (r.estado === "pendiente" || r.estado === "confirmada") &&
        clienteKey(r.cliente) === key &&
        r.startIso > huecoStartIso &&
        (!serviceId || r.serviceId === serviceId),
    )
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
  return recs[0] ?? null;
}

// -----------------------------------------------------------------------------
// Núcleo: ofrecer un hueco liberado a la siguiente clienta adecuada
// -----------------------------------------------------------------------------

export type FreedSlot = { startIso: string; serviceId: string; servicioNombre?: string; empleadoId?: string };
export type OfrecerResult =
  | { ok: false; motivo: "business_not_found" | "sin_candidatas" | "ya_ofreciendo" }
  | { ok: true; offer: WaitlistOffer };

/**
 * Se ha liberado `freed` en `slug`. Busca UNA clienta adecuada en la lista de
 * espera (mismo servicio, empleado compatible, con una cita futura MÁS LEJANA que
 * el hueco) y le ofrece adelantarla por WhatsApp — respetando todos los frenos.
 * `force.to`: solo para la ruta de prueba (envía de verdad al número dado,
 * saltándose flag/ventana/tope; nunca lo use el flujo normal).
 */
export async function procesarHuecoLiberado(
  slug: string,
  freed: FreedSlot,
  redirectUri: string,
  force?: { to?: string },
): Promise<OfrecerResult> {
  const business = await getBusinessBySlug(slug);
  if (!business) return { ok: false, motivo: "business_not_found" };
  const tz = business.timezone || "Europe/Madrid";
  const offers = await listOffers(slug);

  // UNA oferta viva por hueco (una persona a la vez): si hay una "ofrecida" no
  // caducada para este mismo hueco, no ofrecemos a otra todavía.
  const viva = offers.find((o) => o.huecoStartIso === freed.startIso && o.estado === "ofrecida" && !caducada(o));
  if (viva && !force?.to) return { ok: false, motivo: "ya_ofreciendo" };

  // Anti-duplicado: nunca ofrecer el MISMO hueco dos veces a la MISMA persona.
  const yaOfrecidas = new Set(offers.filter((o) => o.huecoStartIso === freed.startIso).map((o) => o.esperaId));

  // Candidatas: esperando, mismo servicio, empleado compatible, sin oferta previa
  // para este hueco, y con una cita futura posterior al hueco (algo que adelantar).
  const espera = (await listEspera(slug)).filter(
    (e) =>
      e.estado === "esperando" &&
      e.serviceId === freed.serviceId &&
      (!e.empleadoId || !freed.empleadoId || e.empleadoId === freed.empleadoId) &&
      !yaOfrecidas.has(e.id),
  );
  const candidatas: { e: EsperaEntry; actual: BookingRecord }[] = [];
  for (const e of espera) {
    const actual = await citaActualPosterior(slug, e.cliente.telefono, freed.startIso, freed.serviceId);
    if (actual) candidatas.push({ e, actual });
  }
  if (candidatas.length === 0) return { ok: false, motivo: "sin_candidatas" };

  // La adecuada: la de cita actual MÁS LEJANA (más gana adelantando); desempate por
  // antigüedad en la lista de espera.
  candidatas.sort(
    (a, b) => b.actual.startIso.localeCompare(a.actual.startIso) || a.e.creadaEn.localeCompare(b.e.creadaEn),
  );
  const { e, actual } = candidatas[0];

  const servicio = freed.servicioNombre || actual.servicioNombre || e.servicioNombre;
  const to = force?.to || e.cliente.telefono;
  const mensaje = textoOferta({
    nombre: e.cliente.nombre,
    salon: business.nombre,
    servicio,
    huecoStartIso: freed.startIso,
    actualStartIso: actual.startIso,
  });

  const offer: WaitlistOffer = {
    id: offerId(slug, e.id, freed.startIso),
    slug,
    esperaId: e.id,
    clienteNombre: e.cliente.nombre,
    clienteTelefono: to,
    huecoStartIso: freed.startIso,
    huecoServiceId: freed.serviceId,
    huecoServicioNombre: servicio,
    empleadoId: freed.empleadoId,
    recordActualId: actual.id,
    recordActualStartIso: actual.startIso,
    mensaje,
    estado: "registrada_sin_enviar",
    enviado: false,
    ofrecidoEn: new Date().toISOString(),
  };

  const forced = !!force?.to;
  if (!forced) {
    // Ventana horaria.
    const h = horaEnZona(tz);
    if (h < VENTANA_DESDE || h >= VENTANA_HASTA) {
      offer.motivoNoEnvio = "fuera_de_ventana";
      await saveOffer(offer);
      return { ok: true, offer };
    }
    // Topes de envíos reales de hoy.
    const hoy = fechaDe(new Date(), tz);
    const enviadosClienta = offers.filter((o) => o.enviado && o.clienteTelefono === to && fechaDe(new Date(o.ofrecidoEn), tz) === hoy).length;
    if (enviadosClienta >= MAX_CLIENTA_DIA) {
      offer.motivoNoEnvio = "rate_limit_clienta";
      await saveOffer(offer);
      return { ok: true, offer };
    }
    const enviadosSalon = offers.filter((o) => o.enviado && fechaDe(new Date(o.ofrecidoEn), tz) === hoy).length;
    if (enviadosSalon >= MAX_SALON_DIA) {
      offer.motivoNoEnvio = "rate_limit_salon";
      await saveOffer(offer);
      return { ok: true, offer };
    }
    // Flag maestro.
    if (!waitlistSendEnabled()) {
      offer.motivoNoEnvio = "flag_off";
      await saveOffer(offer);
      return { ok: true, offer };
    }
  }

  // Envío real por WhatsApp.
  const r = await sendWhatsAppText(to, mensaje);
  if (r.ok) {
    offer.estado = "ofrecida";
    offer.enviado = true;
    offer.mensajeId = r.messageId;
  } else {
    offer.motivoNoEnvio = `${r.reason}:${r.detail}`.slice(0, 200);
  }
  await saveOffer(offer);
  return { ok: true, offer };
}

// -----------------------------------------------------------------------------
// Respuesta de la clienta: aceptar / rechazar + barrido de caducadas
// -----------------------------------------------------------------------------

export type AceptarResult =
  | { ok: false; motivo: string }
  | { ok: true; offer: WaitlistOffer; record: BookingRecord };

/** La clienta dijo que SÍ: reasigna su cita al hueco (libera la antigua) y ofrece
 *  el hueco antiguo a la siguiente en lista. Idempotente. */
export async function aceptarOferta(id: string, redirectUri: string): Promise<AceptarResult> {
  const offer = await getOffer(id);
  if (!offer) return { ok: false, motivo: "not_found" };
  if (offer.estado === "aceptada") {
    const rec = await getRecord(offer.recordActualId);
    return rec ? { ok: true, offer, record: rec } : { ok: false, motivo: "already" };
  }
  if (offer.estado === "rechazada" || offer.estado === "expirada") return { ok: false, motivo: "no_vigente" };

  // Mover la cita lejana al hueco liberado. reprogramarRecord libera el hueco antiguo.
  const rep = await reprogramarRecord(offer.recordActualId, offer.huecoStartIso, undefined, redirectUri, offer.slug);
  if (!rep.ok) return { ok: false, motivo: rep.reason };

  offer.estado = "aceptada";
  offer.resueltoEn = new Date().toISOString();
  await saveOffer(offer);
  await cancelarEspera(offer.slug, offer.esperaId); // ya tiene su hueco antes → fuera de la lista

  // Cascada: la cita ANTIGUA queda libre → ofrecer a la siguiente adecuada.
  try {
    await procesarHuecoLiberado(
      offer.slug,
      { startIso: offer.recordActualStartIso, serviceId: offer.huecoServiceId, servicioNombre: offer.huecoServicioNombre, empleadoId: offer.empleadoId },
      redirectUri,
    );
  } catch {
    /* best-effort */
  }
  return { ok: true, offer, record: rep.record };
}

/** La clienta dijo que NO (o no le viene): libera el hueco y ofrece a la siguiente. */
export async function rechazarOferta(id: string, redirectUri: string): Promise<{ ok: boolean }> {
  const offer = await getOffer(id);
  if (!offer) return { ok: false };
  if (offer.estado === "ofrecida" || offer.estado === "registrada_sin_enviar") {
    offer.estado = "rechazada";
    offer.resueltoEn = new Date().toISOString();
    await saveOffer(offer);
    try {
      await procesarHuecoLiberado(
        offer.slug,
        { startIso: offer.huecoStartIso, serviceId: offer.huecoServiceId, servicioNombre: offer.huecoServicioNombre, empleadoId: offer.empleadoId },
        redirectUri,
      );
    } catch {
      /* best-effort */
    }
  }
  return { ok: true };
}

/** Barrido (para cron): caduca ofertas sin respuesta y las reoferta a la siguiente. */
export async function barrerOfertasCaducadas(redirectUri: string): Promise<{ caducadas: number; reofertadas: number }> {
  const offers = await listOffers();
  let caducadas = 0;
  let reofertadas = 0;
  for (const o of offers) {
    if (o.estado === "ofrecida" && caducada(o)) {
      o.estado = "expirada";
      o.resueltoEn = new Date().toISOString();
      await saveOffer(o);
      caducadas++;
      try {
        const r = await procesarHuecoLiberado(
          o.slug,
          { startIso: o.huecoStartIso, serviceId: o.huecoServiceId, servicioNombre: o.huecoServicioNombre, empleadoId: o.empleadoId },
          redirectUri,
        );
        if (r.ok) reofertadas++;
      } catch {
        /* best-effort */
      }
    }
  }
  return { caducadas, reofertadas };
}
