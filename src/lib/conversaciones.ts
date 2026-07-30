// Bandeja de conversaciones de Pablo, reconstruida desde el event-log.
//
// Fuente: los eventos `message_in` / `message_out` del TENANT. No del store por
// login, no del tenant por defecto: del tenant de quien está mirando. Un negocio
// no puede ver las conversaciones de otro.
//
// El texto de cada mensaje vive en `meta.texto`, que empezó a guardarse el 30 de
// julio de 2026 (antes solo se registraba QUE hubo un mensaje, no cuál). Los
// eventos anteriores a esa fecha aparecen como mensaje sin contenido en vez de
// desaparecer: es más honesto que fingir que la conversación empieza más tarde.
//
// Solo lectura, a propósito. Cuando se quiera contestar desde el panel, el sitio
// es `enviarRespuesta` al final de este fichero: está preparado y documentado.

import "server-only";
import { getMonthEvents, monthKey, type AnalyticsEvent } from "./event-log";

export type Mensaje = {
  id: string;
  ts: string;
  /** "cliente" = lo escribió la persona · "agente" = lo contestó Pablo. */
  de: "cliente" | "agente";
  texto: string;
  /** Falta el texto porque el evento es anterior a que se guardara. */
  sinTexto: boolean;
  /** Segundos que tardó Pablo en contestar. Solo en los del agente. */
  tardoSeg?: number;
  /** De qué camino del webhook salió la respuesta. Útil para diagnosticar. */
  via?: string;
};

export type Conversacion = {
  /** Teléfono del cliente. Es la clave de la conversación. */
  senderId: string;
  /** Nombre de WhatsApp, si lo mandó Meta. */
  nombre?: string;
  mensajes: Mensaje[];
  ultimoTs: string;
  /** Extracto del último mensaje, para la lista. */
  ultimoTexto: string;
  ultimoDe: "cliente" | "agente";
  /** Cuántos mensajes ha escrito el cliente. */
  entrantes: number;
};

const TIPOS = new Set(["message_in", "message_out"]);

/** Mes anterior al de `d`, en formato "YYYY-MM". */
function mesAnterior(d: Date): string {
  return monthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
}

function aMensaje(e: AnalyticsEvent): Mensaje | null {
  if (!TIPOS.has(e.type) || !e.senderId) return null;
  const meta = (e.meta ?? {}) as Record<string, unknown>;
  const texto = typeof meta.texto === "string" ? meta.texto.trim() : "";
  const lat = typeof meta.latencyMs === "number" ? meta.latencyMs : undefined;
  return {
    id: e.id,
    ts: e.ts,
    de: e.type === "message_in" ? "cliente" : "agente",
    texto,
    sinTexto: !texto,
    tardoSeg: lat !== undefined ? Math.round(lat / 100) / 10 : undefined,
    via: typeof meta.via === "string" ? meta.via : undefined,
  };
}

/**
 * Conversaciones del tenant, de más reciente a más antigua.
 *
 * Lee el mes en curso y el anterior: suficiente para una bandeja y acotado, para
 * no recorrer el histórico entero en cada carga del panel.
 */
export async function leerConversaciones(
  tenantId: string,
  opts?: { canal?: string; maxConversaciones?: number },
): Promise<Conversacion[]> {
  const canal = opts?.canal ?? "pablo";
  const ahora = new Date();

  const [esteMes, anterior] = await Promise.all([
    getMonthEvents(tenantId, monthKey(ahora)).catch(() => [] as AnalyticsEvent[]),
    getMonthEvents(tenantId, mesAnterior(ahora)).catch(() => [] as AnalyticsEvent[]),
  ]);

  const porCliente = new Map<string, { nombre?: string; mensajes: Mensaje[] }>();

  for (const e of [...anterior, ...esteMes]) {
    if (e.channel !== canal) continue;
    const m = aMensaje(e);
    if (!m) continue;
    const grupo = porCliente.get(e.senderId!) ?? { mensajes: [] };
    const meta = (e.meta ?? {}) as Record<string, unknown>;
    if (!grupo.nombre && typeof meta.nombre === "string" && meta.nombre.trim()) {
      grupo.nombre = meta.nombre.trim();
    }
    grupo.mensajes.push(m);
    porCliente.set(e.senderId!, grupo);
  }

  const salida: Conversacion[] = [];
  for (const [senderId, g] of porCliente) {
    // Orden cronológico dentro del hilo.
    const mensajes = g.mensajes.sort((a, b) => a.ts.localeCompare(b.ts));
    const ultimo = mensajes[mensajes.length - 1];
    if (!ultimo) continue;
    salida.push({
      senderId,
      nombre: g.nombre,
      mensajes,
      ultimoTs: ultimo.ts,
      ultimoTexto: ultimo.texto,
      ultimoDe: ultimo.de,
      entrantes: mensajes.filter((m) => m.de === "cliente").length,
    });
  }

  // La lista va por el último mensaje, como cualquier bandeja.
  salida.sort((a, b) => b.ultimoTs.localeCompare(a.ultimoTs));
  const tope = opts?.maxConversaciones ?? 50;
  return salida.slice(0, tope);
}

// -----------------------------------------------------------------------------
// PREPARADO PARA CONTESTAR DESDE EL PANEL (todavía no conectado)
// -----------------------------------------------------------------------------
//
// Esta iteración es de solo lectura. Para añadir el envío hace falta:
//
//   1. Un endpoint (por ejemplo POST /api/pablo/responder) que reciba
//      { senderId, texto }, compruebe la sesión y que ese senderId pertenece al
//      tenant de quien envía —si no, un negocio podría escribir a los clientes
//      de otro—, y llame a `sendWhatsAppText`.
//   2. Registrar el mensaje con `type: "message_out"`, `channel: "pablo"`,
//      `senderId`, y `meta.texto` + `meta.via: "manual"`, para que salga en esta
//      misma bandeja y en el feed. El helper del webhook (`registrarIntercambio`)
//      es el modelo a seguir.
//   3. Añadir el turno a la memoria de conversación (`appendTurn`) para que la IA
//      no repita lo que ya ha dicho el dueño a mano.
//   4. ⚠️ La ventana de 24 horas de WhatsApp: fuera de ella, Meta solo admite
//      plantillas aprobadas. El endpoint tiene que comprobar la fecha del último
//      mensaje del cliente y avisar de que no se puede escribir texto libre.
//
// Se deja documentado y sin implementar para no dar por hecho el punto 4, que es
// el que rompería en producción.
