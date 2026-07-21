// -----------------------------------------------------------------------------
// Autocancelación asistida por agente: cuando la clienta quiere CANCELAR o MOVER
// su cita, el agente (Pablo por WhatsApp, Carmen por voz) le pasa su enlace de
// autocancelación web (/reservas/cancelar/{token}) en vez de gestionarlo a mano.
// Reutiliza urlCancelacion() y citasActivasDeCliente() ya existentes.
// -----------------------------------------------------------------------------

import "server-only";
import type { BusinessBooking, BookingRecord } from "./booking";
import { citasActivasDeCliente } from "./booking";
import { urlCancelacion } from "./booking-email";

/** ¿La clienta expresa intención de CANCELAR o MOVER una cita (no de reservar una nueva)? */
export function esIntencionCancelar(text: string): boolean {
  const t = (text || "").toLowerCase();
  return /\b(cancel\w*|anul\w*|dar de baja|quitar (la|mi) cita|no puedo (ir|asistir|acudir|venir)|no voy a poder|no podr[ée]|mov(er|erla)|reprogram\w*|cambiar (la|mi|de) (cita|hora|d[ií]a)|otra hora|otro d[ií]a|posponer|aplazar)\b/.test(t)
    || /\bcambiar\b[\s\S]{0,20}\bcita\b/.test(t);
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function servicioDe(r: BookingRecord): string {
  return [r.servicioNombre, r.varianteNombre].filter(Boolean).join(" · ") || "tu cita";
}
/** "el jueves 15 de agosto a las 10:00" a partir del startIso local. */
function cuandoDe(r: BookingRecord): string {
  const m = r.startIso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return r.startIso.slice(0, 10);
  const [, y, mo, d, hh, mm] = m;
  const wd = new Date(`${y}-${mo}-${d}T12:00:00Z`).getUTCDay();
  return `el ${DIAS[wd]} ${parseInt(d, 10)} de ${MESES[parseInt(mo, 10) - 1]} a las ${hh}:${mm}`;
}

export type CitaConUrl = { cita: BookingRecord; url: string };
export type CasoCancelacion =
  | { caso: "una"; item: CitaConUrl }
  | { caso: "varias"; items: CitaConUrl[] }
  | { caso: "ninguna" };

/** Resuelve el caso (0 / 1 / varias citas activas) y adjunta el enlace de token de cada una. */
export async function resolverCancelacion(slug: string, telefono: string, baseUrl: string): Promise<CasoCancelacion> {
  const citas = await citasActivasDeCliente(slug, telefono);
  const items = citas.map((c) => ({ cita: c, url: urlCancelacion(c, baseUrl) }));
  if (items.length === 0) return { caso: "ninguna" };
  if (items.length === 1) return { caso: "una", item: items[0] };
  return { caso: "varias", items };
}

/** Texto para chat/WhatsApp (Pablo): pega el/los enlace(s) directamente. */
export function textoCancelacionChat(caso: CasoCancelacion, publicUrl: string, nombre?: string): string {
  const hola = nombre ? `, ${nombre.split(/\s+/)[0]}` : "";
  if (caso.caso === "ninguna") {
    return `Mmm, no veo ninguna cita futura a tu nombre 🤔. Si quieres reservar una nueva, dime qué te viene bien o entra aquí:\n${publicUrl}`;
  }
  if (caso.caso === "una") {
    const { cita, url } = caso.item;
    return `¡Claro${hola}! 🙌 Desde este enlace puedes cancelar o cambiar la hora de tu cita de *${servicioDe(cita)}* (${cuandoDe(cita)}) tú misma en un toque:\n${url}`;
  }
  const lineas = caso.items.map((i) => `• *${servicioDe(i.cita)}* — ${cuandoDe(i.cita)}:\n${i.url}`).join("\n\n");
  return `¡Claro${hola}! Tienes ${caso.items.length} citas próximas. Elige cuál cancelar o mover desde su enlace:\n\n${lineas}`;
}

/** Texto HABLADO para Carmen (voz): el/los enlace(s) van por WhatsApp, no se dictan. */
export function textoCancelacionVoz(caso: CasoCancelacion): string {
  if (caso.caso === "ninguna") {
    return "Pues no me consta ninguna cita futura a tu nombre. ¿Quieres que te reserve una nueva?";
  }
  if (caso.caso === "una") {
    return `Te acabo de enviar por WhatsApp el enlace para cancelar o cambiar tu cita de ${servicioDe(caso.item.cita)}, ${cuandoDe(caso.item.cita)}. Desde ahí lo puedes hacer tú en un momento.`;
  }
  return `Te he mandado por WhatsApp los enlaces de tus ${caso.items.length} citas próximas para que elijas cuál quieres cambiar.`;
}
