// Guardián compartido de los chats con acciones (salón, dental, estética,
// gestoría). En estos chats el modelo NUNCA ejecuta nada: solo propone, y se
// ejecuta con el botón (o un "sí" por texto que hace lo mismo). Así que si el
// modelo, sin propuesta sobre la mesa, escribe "cita creada" o "hecho", se lo
// está inventando. Este filtro lo detecta y lo sustituye por la verdad.

const AFIRMA_HECHO =
  /\b(cita\s+(creada|reservada|agendada|apuntada|movida|cancelada)|(he|ya)\s+(creado|reservado|agendado|apuntado|movido|cancelado|anotado|registrado|guardado)|(queda|queda ya|est[aá])\s+(creada|reservada|agendada|apuntada|movida|cancelada|hecha|guardada)|hecho\.|^\s*¡?listo\b|creada\s+para|apuntad[ao]\s+en\s+la\s+lista)/i;

export function afirmaHecho(texto: string): boolean {
  return AFIRMA_HECHO.test(texto);
}

export const TEXTO_NO_EJECUTADO =
  "No he hecho nada todavía: para cambiar algo tengo que prepararlo y que tú lo confirmes con el botón. Dime otra vez qué quieres (por ejemplo: «cita para Laura con Ana el lunes a las 11:00, corte») y te lo dejo preparado.";

/** El modelo pide confirmación EN TEXTO en vez de llamar a la herramienta (no sale el recuadro y un "sí" no dispara nada). */
export function pideConfirmarEnTexto(texto: string): boolean {
  return /(¿\s*(lo\s+|la\s+)?(confirmas|confirmo|hago|creo|muevo|cancelo|apunto|reservo|dejo)\b|\bvoy a (crear|mover|cancelar|apuntar|reservar|agendar)\b|¿te (va|viene|encaja) (bien|ese|esa)|¿(quieres|deseas) que (la |lo )?(cree|reserve|mueva|cancele|apunte|confirme))/i.test(texto);
}

export const NUDGE =
  "No pidas confirmación en texto: llama ahora a la herramienta «preparar_…» que toque con los datos que ya tienes. Es la herramienta la que deja el botón de confirmar. Si te falta un dato, pregúntalo, pero sin decir que vas a hacerlo.";

export const TEXTO_SIN_PREPARAR =
  "No he podido dejar nada preparado para confirmar, así que no he hecho nada. Repíteme la petición con nombre, servicio, día y hora y te la dejo lista con el botón.";

/** Si no hay propuesta pendiente y el texto presume de haber hecho algo, no se cuela. */
export function sinInventar(texto: string, hayPendiente: boolean): string {
  if (hayPendiente) return texto;
  if (afirmaHecho(texto)) return TEXTO_NO_EJECUTADO;
  if (pideConfirmarEnTexto(texto)) return TEXTO_SIN_PREPARAR;
  return texto;
}

const limpio = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
const SI = new Set(["si", "vale", "ok", "okey", "confirmo", "confirmado", "hazlo", "adelante", "de acuerdo", "perfecto", "dale", "venga", "claro",
  "si hazlo", "si confirmo", "si por favor", "vale hazlo", "si adelante", "vale confirmo", "ok hazlo", "si dale", "si vale"]);
const NO = new Set(["no", "dejalo", "olvidalo", "mejor no", "cancela", "cancelalo", "no gracias", "no hazlo", "no lo hagas"]);

/** ¿El mensaje es un "sí" (o un "no") a secas, para contestar a un recuadro de confirmar? */
export function esSi(t: string): boolean { return SI.has(limpio(t)); }
export function esNo(t: string): boolean { return NO.has(limpio(t)); }
