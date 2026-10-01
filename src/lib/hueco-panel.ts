// Comprobaciones COMUNES de los chats con acciones del panel (salón, dental,
// estética) al crear o mover una cita. Antes cada chat tenía la suya, y solo el
// de salón miraba la hora: dental y estética proponían una cita a una hora que
// ya había pasado o con la clínica cerrada.
//
//   · pegaDeHueco  → ¿se puede pedir esa hora? (pasada, día cerrado, fuera de
//     horario), con el siguiente hueco libre. Se mira al PREPARAR y otra vez al
//     CONFIRMAR: entre una cosa y otra pueden pasar minutos y la hora caducar.
//   · citaGuardada → el «Cita creada» solo se dice si la cita está de verdad en
//     la agenda del negocio. El texto de éxito sale de lo guardado, nunca del
//     modelo ni de un `ok` a secas.

import "server-only";
import { computeFreeSlots, resolverServicio, listRecords, servicioPedido, type BusinessBooking, type BookingService, type Empleado } from "./booking";

const REDIRECT_URI = "https://aiteam.marketing/api/lucia/callback";
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function fechaNatural(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}
const horaDe = (iso: string) => iso.match(/T(\d{2}:\d{2})/)?.[1] ?? iso;
export const cuando = (iso: string) => `${fechaNatural(iso)} a las ${horaDe(iso)}`;

/** "AAAA-MM-DDTHH:mm" de ahora en la zona del negocio. */
export function ahoraDelNegocio(negocio: Pick<BusinessBooking, "timezone">, ahora = new Date()): string {
  return ahora.toLocaleString("sv-SE", { timeZone: negocio.timezone || "Europe/Madrid" }).replace(" ", "T").slice(0, 16);
}

/**
 * ¿Se puede pedir esa hora? Devuelve el motivo (para quien lleva el panel) o
 * null si no hay pega a la vista. Ocupado / no cabe lo decide luego `reservarSlot`.
 * `servicio` sirve para buscar el siguiente hueco; si no se sabe, se usa el que
 * encaje con `motivo` o el primero activo.
 */
export async function pegaDeHueco(
  negocio: BusinessBooking,
  startIso: string,
  opts: { servicio?: BookingService; motivo?: string; prof?: Empleado; ahora?: Date } = {},
): Promise<string | null> {
  const ahora = ahoraDelNegocio(negocio, opts.ahora);
  const fecha = startIso.slice(0, 10);
  const prof = opts.prof;
  const dia = (prof?.horario ?? negocio.horario)?.[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
  const servicio = opts.servicio ?? (opts.motivo ? servicioPedido(negocio, opts.motivo) ?? undefined : undefined) ?? negocio.servicios.find((s) => s.activo);
  const quien = prof ? ` con ${prof.nombre}` : "";
  const siguiente = async (): Promise<string> => {
    if (!servicio) return "";
    const sel = resolverServicio(servicio, {});
    for (let i = 0; i < 8; i++) {
      const d = new Date(`${fecha}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const f = d.toISOString().slice(0, 10);
      if (f < ahora.slice(0, 10)) continue;
      const r = await computeFreeSlots(negocio, sel, f, REDIRECT_URI, undefined, prof?.id).catch(() => null);
      const libre = r && r.ok ? r.slots.find((x) => x.slice(0, 16) > ahora) : undefined;
      if (libre) return ` El siguiente hueco libre${quien} es el ${cuando(libre)}.`;
    }
    return " No veo huecos libres en los próximos días.";
  };
  if (startIso.slice(0, 16) <= ahora) return `Esa hora (${cuando(startIso)}) ya ha pasado, no se puede reservar.${await siguiente()}`;
  if (!dia || !dia.abierto || dia.franjas.length === 0) {
    return `${prof ? prof.nombre : "El negocio"} no abre el ${DIAS[new Date(`${fecha}T12:00:00Z`).getUTCDay()]}.${await siguiente()}`;
  }
  const h = horaDe(startIso);
  if (!dia.franjas.some((f) => h >= f.desde && h < f.hasta)) {
    return `A las ${h} está fuera de horario ese día (${dia.franjas.map((f) => `${f.desde}–${f.hasta}`).join(", ")}).${await siguiente()}`;
  }
  return null;
}

/**
 * Tras un `reservarSlot` correcto: ¿la cita está DE VERDAD en la agenda del
 * negocio? Sin esto, un `ok` del calendario sin cita guardada se contaba como
 * «Cita creada» y la dueña no la encontraba ni en Hoy ni en la Agenda.
 */
export async function citaGuardada(
  res: { ok: boolean; recordId?: string; eventId?: string },
  slug: string,
): Promise<{ id: string; startIso: string } | null> {
  if (!res.ok) return null;
  const recs = await listRecords();
  const r = recs.find((x) => x.slug === slug && x.tipo === "cita" && x.estado !== "cancelada" &&
    ((res.recordId && x.id === res.recordId) || (res.eventId && x.eventId === res.eventId)));
  return r ? { id: r.id, startIso: r.startIso } : null;
}

export const TEXTO_NO_GUARDADA =
  "La agenda no ha guardado la cita, así que NO está creada. No la busques en Hoy: inténtalo otra vez o créala desde la Agenda.";

/**
 * ¿Es un motivo de `pegaDeHueco` (hora pasada, cerrado, fuera de horario)? Los
 * chats lo usan para CORTAR la vuelta: si no, el modelo cogía el «siguiente
 * hueco» del motivo y lo proponía por su cuenta sin decir que la hora pedida no
 * valía (pediste las 11:00 y el recuadro salía a las 17:45).
 */
export function esPegaDeHora(motivo: string): boolean {
  return /ya ha pasado, no se puede reservar| no abre el |est[aá] fuera de horario/.test(motivo);
}

/**
 * Los próximos días con su nombre, calculados en código. El modelo se equivocaba
 * al pasar «el martes» a fecha (el 01/10/2026 propuso «martes 2 de octubre», que
 * era viernes). Con esta chuleta en el sistema no tiene que calcular nada.
 */
export function calendarioProximo(hoyIso: string, dias = 14): string {
  const out: string[] = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(`${hoyIso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const nombre = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    out.push(`${i === 0 ? "hoy" : i === 1 ? "mañana" : nombre.split(",")[0]}: ${nombre} = ${iso}`);
  }
  return `\n\nCALENDARIO (usa SIEMPRE estas fechas; «el martes» es el PRIMER martes de la lista, no lo calcules tú):\n${out.join("\n")}`;
}
