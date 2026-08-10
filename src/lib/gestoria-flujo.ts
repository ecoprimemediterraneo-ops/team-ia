// Lo que contesta una gestoría cuando el cliente pregunta por lo suyo.
//
// Mismo sitio en la arquitectura que `restaurante-flujo.ts`: la DECISIÓN vive en
// `gestoria.ts` (puro, comprobable) y aquí se reúnen los datos y se ejecuta. El
// webhook de Pablo solo llama y manda lo que le devuelvan.
//
// Las tres respuestas posibles, y ninguna se salta:
//   1. Un solo expediente → se cuenta su estado.
//   2. Varios abiertos → se le PREGUNTA de cuál, listándolos. No se adivina:
//      contarle el de la renta cuando preguntaba por las nóminas es peor que
//      preguntar.
//   3. Sin ficha o sin expedientes → se dice que no consta y se ofrece pasarlo a
//      una persona. NUNCA se inventa un estado ni un plazo.

import "server-only";
import { logEvent, makeEventId } from "./event-log";
import {
  listarExpedientes, guardarExpedientes, expedientesDe, textoEstado,
  tramiteById, type Expediente,
} from "./gestoria";

export type RespuestaGestoria = { texto: string; via: string };

/** Frase con la lista de trámites abiertos, para preguntar de cuál habla. */
function preguntaCual(expedientes: Expediente[]): string {
  const nombres = expedientes.map((e) => {
    const n = tramiteById(e.tramite)?.nombre ?? e.tramite;
    return e.periodo ? `${n} (${e.periodo})` : n;
  });
  const lista = nombres.map((n) => `· ${n}`).join("\n");
  return `Tienes ${expedientes.length} cosas abiertas con nosotros:\n${lista}\n\n¿Por cuál preguntas?`;
}

/**
 * Contesta una consulta de estado. Devuelve null si esto no aplica (el tenant no
 * es gestoría o no hay nada que mirar) para que el llamante siga con su flujo.
 *
 * `tramitePedido` viene del clasificador cuando el cliente ya ha dicho de qué
 * habla: con eso no hace falta preguntarle nada.
 */
export async function responderEstadoExpediente(opts: {
  tenantId: string;
  telefono: string;
  tramitePedido?: string;
}): Promise<RespuestaGestoria | null> {
  const todos = await listarExpedientes(opts.tenantId);
  const suyos = expedientesDe(todos, opts.telefono);

  // Sin ficha o sin nada abierto: se dice y se ofrece una persona.
  if (!suyos.length) {
    return {
      texto:
        "Pues ahora mismo no me consta nada abierto a tu nombre con este teléfono. " +
        "Se lo paso a una compañera y te dice algo en cuanto lo mire, ¿te parece?",
      via: "gestoria_estado_sin_expediente",
    };
  }

  // Si ya ha dicho de qué trámite habla, se va directo a ese.
  if (opts.tramitePedido) {
    const filtrados = suyos.filter((e) => e.tramite === opts.tramitePedido);
    if (filtrados.length) {
      const texto = textoEstado(filtrados);
      if (texto) {
        await registrarEstadoResuelto(opts.tenantId, opts.telefono, filtrados);
        return { texto, via: "gestoria_estado" };
      }
    }
  }

  // Varios abiertos y sin saber de cuál: se pregunta.
  if (suyos.length > 1) {
    return { texto: preguntaCual(suyos), via: "gestoria_estado_cual" };
  }

  const texto = textoEstado(suyos);
  if (!texto) return null;
  await registrarEstadoResuelto(opts.tenantId, opts.telefono, suyos);
  return { texto, via: "gestoria_estado" };
}

/**
 * Deja constancia de que una consulta de estado se resolvió SOLA.
 *
 * Es lo que alimenta el KPI "Estados resueltos solos" del panel y lo que hace
 * que el informe mensual pueda contarlo. Se registra como `message_out` con
 * `meta.kind: "estado_expediente"`, igual que el resto de agentes.
 */
async function registrarEstadoResuelto(
  tenantId: string,
  telefono: string,
  expedientes: Expediente[],
): Promise<void> {
  try {
    await logEvent(tenantId, {
      id: makeEventId("estado_expediente", "pablo", telefono, String(Date.now())),
      type: "message_out",
      channel: "pablo",
      senderId: telefono,
      meta: {
        kind: "estado_expediente",
        expedientes: expedientes.map((e) => e.id),
        tramites: expedientes.map((e) => e.tramite),
      },
    });
  } catch (err) {
    console.error("[gestoria-flujo] no se pudo registrar el estado resuelto:", err);
  }
}

// -----------------------------------------------------------------------------
// El cliente dice que YA ha mandado la documentación
// -----------------------------------------------------------------------------

/**
 * ¿El mensaje es "ya te lo he mandado" / "ahí va"?
 *
 * Se reconoce por texto y también por venir con adjunto: en WhatsApp mucha gente
 * manda el PDF sin escribir nada.
 */
export function diceQueEnvioDocumentacion(texto: string, traeAdjunto = false): boolean {
  if (traeAdjunto) return true;
  const t = (texto || "").toLowerCase();
  return /\b(ya te lo (he )?(mandado|enviado|pasado)|ah[ií] (te )?va|te lo mando|adjunto|ya lo mand[ée]|acabo de envi|ya est[aá] enviado)\b/.test(t);
}

/**
 * Apunta en el expediente que el cliente dice haber mandado la documentación.
 *
 * OJO — NO da los documentos por recibidos. Solo deja la marca para que el dueño
 * lo vea en el panel y lo compruebe: dar por bueno un "ya te lo he mandado" sin
 * que nadie mire el correo es exactamente cómo se pierde un plazo.
 */
export async function anotarEnvioDeDocumentacion(opts: {
  tenantId: string;
  telefono: string;
}): Promise<RespuestaGestoria | null> {
  const todos = await listarExpedientes(opts.tenantId);
  const suyos = expedientesDe(todos, opts.telefono).filter(
    (e) => e.estado === "esperando_documentacion",
  );
  if (!suyos.length) return null;

  const ahora = new Date().toISOString();
  const ids = new Set(suyos.map((e) => e.id));
  const actualizados = todos.map((e) =>
    ids.has(e.id)
      ? {
          ...e,
          nota: `${e.nota ? `${e.nota} · ` : ""}El cliente dice haber enviado la documentación (${ahora.slice(0, 10)}), pendiente de comprobar`,
          actualizadoEn: ahora,
        }
      : e,
  );
  await guardarExpedientes(opts.tenantId, actualizados);

  try {
    await logEvent(opts.tenantId, {
      id: makeEventId("docs_recibidas", "pablo", opts.telefono, String(Date.now())),
      type: "message_in",
      channel: "pablo",
      senderId: opts.telefono,
      meta: { kind: "docs_anunciadas", expedientes: [...ids] },
    });
  } catch (err) {
    console.error("[gestoria-flujo] no se pudo registrar el envío de documentación:", err);
  }

  const nombres = suyos.map((e) => tramiteById(e.tramite)?.nombre ?? e.tramite).join(", ");
  return {
    texto: `¡Gracias! Lo anoto en tu expediente de ${nombres} y lo revisamos. Si faltara algo te aviso por aquí.`,
    via: "gestoria_docs_anunciadas",
  };
}
