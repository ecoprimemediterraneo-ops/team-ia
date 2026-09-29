// Lo que Pablo contesta en los momentos en que NO puede improvisar: cita
// guardada, servicio que no existe, cita que no se ha podido guardar, cliente
// que pide una persona o tiene una urgencia. Mismas reglas que Carmen:
//   · solo se confirma una cita GUARDADA, y la confirmación va en UN mensaje;
//   · solo se nombran servicios REALES de la ficha, nunca categorías;
//   · nunca se promete que alguien llamará si el aviso no ha llegado.
// Estilo de casa en WhatsApp: sin emojis y sin signos de apertura.
import type { BookingRecord, BusinessBooking } from "./booking";

export type Idioma = "es" | "en";
const DIAS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MESES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function cuando(iso: string, idioma: Idioma = "es"): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const h = iso.slice(11, 16);
  return idioma === "en"
    ? `${DIAS_EN[d.getUTCDay()]} ${d.getUTCDate()} ${MESES_EN[d.getUTCMonth()]} at ${h}`
    : `el ${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} a las ${h}`;
}

/** UN solo mensaje: la cita tal como ha quedado GUARDADA, con dónde y cómo anularla. */
export function textoCitaGuardada(o: { record: BookingRecord; negocio: BusinessBooking; nombre?: string; idioma?: Idioma; baseUrl?: string }): string {
  const { record: r, negocio: b } = o;
  const en = o.idioma === "en";
  const base = (o.baseUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://aiteam.marketing").replace(/\/$/, "");
  const enlace = `${base}/reservas/cancelar/${r.token}`;
  const nombre = (o.nombre || r.cliente?.nombre || "").split(" ")[0];
  const con = r.empleadoNombre ? (en ? ` with ${r.empleadoNombre}` : ` con ${r.empleadoNombre}`) : "";
  return en
    ? `Done${nombre ? `, ${nombre}` : ""}. Your appointment at *${b.nombre}* is booked: *${r.servicioNombre}*, ${cuando(r.startIso, "en")}${con}.` +
        `${b.direccion ? `\nAddress: ${b.direccion}` : ""}\n\nCan't make it? Cancel or change it here: ${enlace} or just tell me.`
    : `Listo${nombre ? `, ${nombre}` : ""}. Te he guardado la cita en *${b.nombre}*: *${r.servicioNombre}*, ${cuando(r.startIso)}${con}.` +
        `${b.direccion ? `\nDirección: ${b.direccion}` : ""}\n\nSi no puedes venir, anúlala o cámbiala aquí: ${enlace} o dímelo por aquí.`;
}

/** Servicio que el salón no tiene: se dice y se nombran los REALES de la ficha. */
export function textoServicioNoDisponible(negocio: BusinessBooking, pedido: string | undefined, idioma: Idioma = "es"): string {
  const hay = negocio.servicios.filter((s) => s.activo).map((s) => s.nombre);
  return idioma === "en"
    ? `Sorry, we don't offer ${pedido ? `"${pedido}"` : "that"} at ${negocio.nombre}. What we do offer: ${hay.join(", ")}. Would any of these suit you?`
    : `${pedido ? `${pedido.charAt(0).toUpperCase()}${pedido.slice(1)} no` : "Eso no"} lo hacemos en ${negocio.nombre}. Lo que sí tenemos: ${hay.join(", ")}. Te interesa alguno?`;
}

/** La reserva no ha quedado guardada: nunca se confirma. */
export function textoNoGuardada(idioma: Idioma = "es"): string {
  return idioma === "en"
    ? "Sorry, I couldn't save the appointment just now, so it is NOT booked yet. Shall I try again?"
    : "Perdona, no he podido dejar la cita guardada, así que todavía NO está reservada. Lo intento otra vez?";
}

/** Faltan datos. Si ya ha dicho el servicio y el día, no se le vuelve a preguntar por ellos. */
export function preguntaFaltante(missing: string[], idioma: Idioma = "es"): string {
  if (idioma === "en") {
    if (missing.includes("fecha_hora")) return "Which day and time would suit you?";
    if (missing.includes("motivo")) return "Which service would you like?";
    if (missing.includes("nombre")) return "What name should I book it under?";
    return "";
  }
  if (missing.includes("fecha_hora")) return "Qué día y a qué hora te viene bien?";
  if (missing.includes("motivo")) return "Para qué servicio?";
  if (missing.includes("nombre")) return "A nombre de quién la pongo?";
  return "";
}

/** "Quiero hablar con una persona / con el responsable / con alguien". */
export function pideUnaPersona(texto: string): boolean {
  const t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /\b(hablar|habla|pasame|pasas|pasa|pasar|ponme|pones|poner)\b[^.?!]{0,30}\b(persona|humano|alguien|responsable|encargad[oa]|duen[oa]|gerente|real)\b/.test(t) ||
    /\b(talk|speak)\b[^.?!]{0,30}\b(person|human|someone|manager|owner)\b/.test(t) ||
    /\b(atencion|agente) humana?\b/.test(t);
}

export function textoAvisoAlDueno(o: { avisado: boolean; urgente: boolean; idioma?: Idioma }): string {
  const en = o.idioma === "en";
  if (o.avisado) {
    if (o.urgente) {
      return en
        ? "I've just alerted the person in charge and passed on your message so they can contact you as soon as possible. If it gets worse, please see a doctor or go to A&E."
        : "Acabo de avisar al responsable con tu mensaje para que te contacte lo antes posible. Si empeora, acude a un centro médico o a urgencias.";
    }
    return en
      ? "I've passed your message to the person in charge; they'll get back to you as soon as they can. Can I help you with anything else meanwhile?"
      : "Le he pasado tu mensaje al responsable y te contestará en cuanto pueda. Mientras, te ayudo en algo más?";
  }
  return en
    ? "I've noted it for the team. If it's urgent and gets worse, please see a doctor."
    : o.urgente
      ? "Lo dejo anotado para el equipo. Si es urgente y empeora, acude a un centro médico o a urgencias."
      : "Lo dejo anotado para el equipo. Mientras, te ayudo en algo más?";
}

/**
 * ¿La respuesta del modelo CONFIRMA una cita? En el flujo libre no se ha
 * guardado nada: si lo dice, es mentira y se cambia (ver el webhook).
 */
export function confirmaCitaSinGuardar(respuesta: string): boolean {
  const t = respuesta.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /\b(te he (agendado|apuntado|reservado|guardado)|(ya )?tienes (la )?cita (confirmada|reservada)|cita (confirmada|reservada)|queda(s)? (reservad|confirmad|apuntad))/.test(t) ||
    /\b(you('| a)re (booked|all set)|your appointment is (booked|confirmed)|i('| ha)ve booked)\b/.test(t);
}
