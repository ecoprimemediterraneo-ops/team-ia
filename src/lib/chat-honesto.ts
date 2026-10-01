// Guardián compartido de los chats con acciones (salón, dental, estética,
// gestoría). En estos chats el modelo NUNCA ejecuta nada: solo propone, y se
// ejecuta con el botón (o un "sí" por texto que hace lo mismo). Así que si el
// modelo, sin propuesta sobre la mesa, escribe "cita creada" o "hecho", se lo
// está inventando. Este filtro lo detecta y lo sustituye por la verdad.

const AFIRMA_HECHO =
  /\b(cita\s+(creada|reservada|agendada|apuntada|movida|cancelada|guardada)|(he|ya|lo|la|te\s+la|te\s+lo|se\s+ha)\s+(creado|reservado|agendado|apuntado|movido|cancelado|anotado|registrado|guardado|confirmado|dejado|puesto|hecho)|(queda|queda\s+ya|est[aá]|ya\s+est[aá])\s+(creada|reservada|agendada|apuntada|movida|cancelada|hecha|guardada|confirmada|lista|listo)|^\s*¡?\s*(hecho|listo|perfecto,?\s+(ya|creada|reservada|hecho))\b|(creada|reservada|agendada|apuntada)\s+para|apuntad[ao]\s+en\s+la\s+lista|ya\s+(la|lo)\s+tienes|\bid\s*[:#]?\s*[a-z]{2,6}_[a-z0-9_]+|\b(bk|cita|rec)_[a-z0-9]{4,})/i;

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

export const TEXTO_SI_SIN_PROPUESTA =
  "No tengo nada preparado para confirmar, así que no he hecho nada. Pídemelo entero (por ejemplo: «cita para Laura con Ana mañana a las 11:00, corte») y te saco el recuadro para confirmarlo.";

export const TEXTO_PENDIENTE_CONFIRMAR =
  "Lo tengo preparado, pero todavía NO está hecho: confírmalo con el botón de abajo (o contesta «sí»).";

/**
 * El texto del MODELO nunca puede dar algo por hecho: en estos chats el modelo
 * no ejecuta nada. Los «hecho / creada / id …» de verdad salen de `ejecutar()`,
 * por el camino del botón, sin pasar por aquí. Así que:
 *   · con propuesta en pantalla, si presume de hecho → se dice que falta confirmar;
 *   · sin propuesta, si presume de hecho → se dice que no se ha hecho nada.
 */
export function sinInventar(texto: string, hayPendiente: boolean, pregunta?: string): string {
  if (hayPendiente) return afirmaHecho(texto) ? TEXTO_PENDIENTE_CONFIRMAR : texto;
  // Un «sí» escrito SIN recuadro delante: no hay nada que confirmar, y lo que el
  // modelo redacte a partir de un «sí» suelto es justo donde se inventaba el
  // «Cita creada». Solo se deja pasar si está preguntando algo.
  if (pregunta !== undefined && esSi(pregunta) && !texto.trim().endsWith("?")) return TEXTO_SI_SIN_PROPUESTA;
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
