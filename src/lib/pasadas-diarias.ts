// Los trabajos diarios que NO son recordatorios de cita, pero comparten su cron.
//
// Por qué viven aquí y no en la ruta del cron: la ruta ya hacía una cosa y ahora
// hace tres, y meterle doscientas líneas más la convertiría en el sitio donde
// nadie quiere entrar. Además así se pueden llamar desde una prueba.
//
// NO SE HA CREADO NINGÚN CRON NUEVO. Los tres trabajos son diarios y de volumen
// bajo, y el plan Hobby solo permite una ejecución al día por cron: añadir uno
// por trabajo sería gastar cupo para nada.
//
// LOS TRES SON FAIL-CLOSED. Con el interruptor apagado se calcula todo y se
// devuelve CUÁNTOS mensajes habrían salido y a quién, pero no se envía nada. Es
// el mismo criterio que el recall dental y la lista de espera: primero lo ves,
// después sale.

import "server-only";
import { listTenants } from "./tenants";
import { resolverSector } from "./sectores";
import {
  listarExpedientes, guardarExpedientes, reclamacionesPendientes, avisosDeVencimiento,
  reclamacionDocsEnabled, calendarioFiscalEnabled,
} from "./gestoria";
import { listBusinesses, listRecords } from "./booking";
import {
  peticionesDeHoy, listarPedidas, marcarPedida, resenaSendEnabled, enlaceResena,
} from "./resena-whatsapp";
import { sendWhatsAppText } from "./whatsapp-sender";
import { logEvent, makeEventId } from "./event-log";

// -----------------------------------------------------------------------------
// GESTORÍA: reclamar documentación y avisar de vencimientos
// -----------------------------------------------------------------------------

export type ResultadoGestoria = {
  tenants: number;
  docs: { candidatos: number; enviados: number; modo: string };
  fiscal: { candidatos: number; enviados: number; modo: string };
};

export async function pasadaGestoria(): Promise<ResultadoGestoria> {
  const tenants = (await listTenants()).filter((t) => resolverSector(t) === "gestoria");
  const enviarDocs = reclamacionDocsEnabled();
  const enviarFiscal = calendarioFiscalEnabled();

  let candidatosDocs = 0, enviadosDocs = 0;
  let candidatosFiscal = 0, enviadosFiscal = 0;

  for (const t of tenants) {
    const lista = await listarExpedientes(t.id).catch(() => []);
    if (!lista.length) continue;

    // --- Reclamación de documentación (freno de 3 días dentro) ---
    const reclamaciones = reclamacionesPendientes(lista);
    candidatosDocs += reclamaciones.length;

    if (enviarDocs && reclamaciones.length) {
      const ahora = new Date().toISOString();
      let actualizada = lista;
      for (const r of reclamaciones) {
        const res = await sendWhatsAppText(r.expediente.telefono, r.texto).catch(() => ({ ok: false }));
        if (!res.ok) continue;
        enviadosDocs++;
        // Se marca la fecha en CADA documento reclamado: es lo que hace que el
        // freno de tres días funcione en la pasada siguiente.
        const ids = new Set(r.documentos.map((d) => d.id));
        actualizada = actualizada.map((e) =>
          e.id === r.expediente.id
            ? {
                ...e,
                documentos: e.documentos.map((d) => (ids.has(d.id) ? { ...d, reclamadoEn: ahora } : d)),
                actualizadoEn: ahora,
              }
            : e,
        );
        await registrar(t.id, "docs_reclamados", r.expediente.telefono, {
          expediente: r.expediente.id,
          recordatorio: r.esRecordatorio,
        });
      }
      await guardarExpedientes(t.id, actualizada);
    }

    // --- Calendario fiscal (avisa 7 días antes, solo a quien le aplica) ---
    const avisos = avisosDeVencimiento(lista);
    candidatosFiscal += avisos.length;
    if (enviarFiscal) {
      for (const a of avisos) {
        const res = await sendWhatsAppText(a.telefono, a.texto).catch(() => ({ ok: false }));
        if (!res.ok) continue;
        enviadosFiscal++;
        await registrar(t.id, "aviso_fiscal", a.telefono, { vencimiento: a.vencimiento.id });
      }
    }
  }

  return {
    tenants: tenants.length,
    docs: {
      candidatos: candidatosDocs,
      enviados: enviadosDocs,
      modo: enviarDocs ? "encendido" : "APAGADO (GESTORIA_DOCS_SEND_ENABLED)",
    },
    fiscal: {
      candidatos: candidatosFiscal,
      enviados: enviadosFiscal,
      modo: enviarFiscal ? "encendido" : "APAGADO (GESTORIA_FISCAL_SEND_ENABLED)",
    },
  };
}

// -----------------------------------------------------------------------------
// RESEÑAS: aplica a los CINCO sectores
// -----------------------------------------------------------------------------

export type ResultadoResenas = {
  negocios: number;
  sinEnlace: number;
  candidatos: number;
  enviados: number;
  modo: string;
};

export async function pasadaResenas(): Promise<ResultadoResenas> {
  const negocios = await listBusinesses().catch(() => []);
  const todos = await listRecords().catch(() => []);
  const enviar = resenaSendEnabled();

  let sinEnlace = 0, candidatos = 0, enviados = 0;

  for (const business of negocios) {
    // Sin enlace de reseña configurado no se manda nada: un "déjanos una reseña"
    // sin decir dónde es ruido.
    if (!enlaceResena(business)) { sinEnlace++; continue; }

    const suyos = todos.filter((r) => r.slug === business.slug);
    const pedidas = await listarPedidas(business.slug).catch(() => ({}));
    const peticiones = peticionesDeHoy({ business, records: suyos, pedidas });
    candidatos += peticiones.length;
    if (!enviar) continue;

    for (const p of peticiones) {
      const res = await sendWhatsAppText(p.telefono, p.texto).catch(() => ({ ok: false }));
      if (!res.ok) continue;
      enviados++;
      // El registro de "ya se le pidió" es lo que garantiza el tope de una vez
      // cada seis meses. Se marca solo si el envío salió.
      await marcarPedida(business.slug, p.telefono);
      await registrar(business.tenantId, "resena_pedida", p.telefono, { record: p.record.id });
    }
  }

  return {
    negocios: negocios.length,
    sinEnlace,
    candidatos,
    enviados,
    modo: enviar ? "encendido" : "APAGADO (RESENA_SEND_ENABLED)",
  };
}

// -----------------------------------------------------------------------------

/** Un `message_out` con su `kind`, como el resto de agentes, para el informe. */
async function registrar(
  tenantId: string,
  kind: string,
  telefono: string,
  meta: Record<string, unknown>,
): Promise<void> {
  try {
    await logEvent(tenantId, {
      id: makeEventId(kind, "pablo", telefono, String(Date.now())),
      type: "message_out",
      channel: "pablo",
      senderId: telefono,
      meta: { kind, ...meta },
    });
  } catch (err) {
    console.error(`[pasadas-diarias] no se pudo registrar ${kind}:`, err);
  }
}
