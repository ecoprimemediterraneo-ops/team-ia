// Lo que Pablo le manda al gestor cada mañana.
//
// DOS MENSAJES, NO UNO. El resumen del día va aparte de lo que vence hoy o
// mañana. Mezclados, lo urgente se lee como un renglón más de una lista larga y
// se pasa por alto — que es exactamente lo que ya le pasa a Jose con su bandeja.
// Separados, el segundo mensaje solo llega cuando de verdad hay algo que no
// puede esperar, y por eso se lee.
//
// Tono de casa: sin emojis, sin signos de apertura, frases cortas, sin fórmulas
// de asistente. Se dice lo que hay y ya.

import "server-only";
import { listarTareas, esRojo, diasHasta, type Tarea } from "./gestoria-hoy";

export type AvisoDiario = {
  /** El resumen. Siempre se manda, aunque no haya nada. */
  resumen: string;
  /** Lo que vence hoy o mañana. null = no hay nada, no se manda segundo mensaje. */
  urgente: string | null;
  tareas: Tarea[];
};

const cuando = (t: Tarea): string => {
  const d = diasHasta(t.vence);
  if (d === null) return "sin plazo";
  if (d < 0) return `vencio hace ${-d} dia${d === -1 ? "" : "s"}`;
  if (d === 0) return "vence hoy";
  if (d === 1) return "vence mañana";
  return `en ${d} dias`;
};

const linea = (t: Tarea): string =>
  `- ${t.titulo}${t.clienteNombre ? ` (${t.clienteNombre})` : ""}, ${cuando(t)}`;

/**
 * "buenos dias, jose." · "buenos dias." si no se sabe cómo se llama.
 *
 * En minúscula a propósito: todo el aviso de Pablo va en minúscula, escrito
 * como escribe una persona por WhatsApp, no como escribe un sistema.
 */
const saludo = (nombre?: string): string =>
  nombre && nombre.trim() ? `buenos dias, ${nombre.trim().toLowerCase()}.` : "buenos dias.";

export function redactarAviso(tareas: Tarea[], nombreGestor?: string): AvisoDiario {
  const vivas = tareas.filter((t) => !t.hecho);
  const rojas = vivas.filter(esRojo);
  const resto = vivas.filter((t) => !esRojo(t));

  if (!vivas.length) {
    return { resumen: `${saludo(nombreGestor)} hoy no tienes nada pendiente.`, urgente: null, tareas: [] };
  }

  // El resumen enseña como mucho seis: una lista de veinte en WhatsApp no se lee.
  // Lo que no cabe se cuenta, no se esconde.
  const enResumen = resto.slice(0, 6);
  const sobran = resto.length - enResumen.length;

  const partes = [
    `${saludo(nombreGestor)} tienes ${vivas.length} cosa${vivas.length === 1 ? "" : "s"} pendiente${vivas.length === 1 ? "" : "s"}.`,
  ];
  if (enResumen.length) partes.push(enResumen.map(linea).join("\n"));
  if (sobran > 0) partes.push(`y ${sobran} mas en el panel.`);
  if (rojas.length) partes.push(`te mando aparte lo que vence ya.`);

  const urgente = rojas.length
    ? [
        rojas.length === 1 ? "esto vence ya y sigue sin hacer:" : `${rojas.length} cosas vencen ya y siguen sin hacer:`,
        rojas.map(linea).join("\n"),
        "cuando lo tengas hecho, marcalo en el panel y dejo de avisarte.",
      ].join("\n\n")
    : null;

  return { resumen: partes.join("\n\n"), urgente, tareas: vivas };
}

export async function avisoDelDia(tenantId: string): Promise<AvisoDiario> {
  const { getTenant } = await import("./tenants");
  const t = await getTenant(tenantId).catch(() => null);
  return redactarAviso(await listarTareas(tenantId), t?.ownerName);
}

/** Interruptor de envío. Fail-closed: sin la variable, no sale ningún mensaje. */
export const avisoDiarioEnabled = (): boolean =>
  (process.env.GESTORIA_AVISO_DIARIO_ENABLED || "").toLowerCase() === "true";
