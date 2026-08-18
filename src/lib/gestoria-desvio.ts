// A qué gestoría van las facturas que entran por un número de WhatsApp.
//
// EL PROBLEMA REAL, no el de la demo
// ----------------------------------
// Una factura que entra por WhatsApp tiene que acabar en la cuenta de LA
// gestoría que lleva a ese cliente. Hoy el tenant se resuelve por el
// `phone_number_id` del número que RECIBE (`resolveTenantFromMeta`), y eso es lo
// correcto: cada gestoría con su número, cada número con su cuenta.
//
// La alternativa —un número compartido y enrutar por el REMITENTE— se descartó,
// y no por comodidad:
//
//   · El caso que importa es el cliente que manda su primera foto ANTES de que
//     nadie lo haya dado de alta. Por remitente no hay forma de saber a qué
//     gestoría pertenece: no está en ninguna lista todavía. Y justo ese es el
//     caso para el que existe la bandeja de "sin asignar".
//   · Un mismo negocio puede ser cliente de dos gestorías. El mismo número de
//     origen apuntaría a dos cuentas.
//   · En Meta la calidad, la ventana de 24 h y las plantillas van POR NÚMERO.
//     Compartir número es compartir reputación: si una gestoría cabrea a sus
//     clientes, se quedan mudas todas.
//
// PARA QUÉ SIRVE ENTONCES ESTE FICHERO
// ------------------------------------
// Para el hueco entre que una gestoría entra y tiene su propio número dado de
// alta en Meta, que son días o semanas: mientras tanto, el número de AI-Team
// hace de puente. Se dice qué número desvía y a qué tenant, y SOLO afecta a los
// adjuntos: el texto sigue yendo a Pablo como siempre, así que la cuenta
// comercial de AI-Team no se toca.
//
// Es un puente declarado y visible, no un apaño escondido: el panel enseña que
// está puesto, y `/api/admin/gestoria-desvio` lo quita en un clic.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";

const CLAVE = "gestoria_desvio_adjuntos";
const FICHERO = path.join(process.cwd(), "data", "gestoria-desvio.json");

export type DesvioAdjuntos = {
  /** El `phone_number_id` del número que RECIBE la foto. */
  phoneNumberId: string;
  /** La gestoría a cuya bandeja van esas facturas. */
  tenantId: string;
  activo: boolean;
  puesto_en: string;
  nota?: string;
};

export async function leerDesvio(): Promise<DesvioAdjuntos | null> {
  if (supabaseEnabled()) return kvGet<DesvioAdjuntos>(CLAVE);
  try {
    return JSON.parse(await fs.readFile(FICHERO, "utf-8")) as DesvioAdjuntos;
  } catch {
    return null;
  }
}

export async function guardarDesvio(d: DesvioAdjuntos): Promise<void> {
  if (supabaseEnabled()) {
    await kvSet(CLAVE, d);
    return;
  }
  await fs.mkdir(path.dirname(FICHERO), { recursive: true });
  await fs.writeFile(FICHERO, JSON.stringify(d, null, 2));
}

export type DestinoAdjunto = {
  tenantId: string;
  desviado: boolean;
  /** Para el log: por qué ha acabado ahí. */
  motivo: string;
};

/**
 * A qué tenant se le apunta esta factura.
 *
 * Sin desvío puesto, el que resolvió el webhook por el número. Con desvío
 * puesto y encajando el número, el de la gestoría. Nunca falla: si el desvío
 * está mal escrito, se devuelve el de siempre y se dice en el log — perder una
 * factura por una configuración torcida sería peor que guardarla donde estaba.
 */
export async function destinoDeAdjunto(opts: {
  phoneNumberId?: string;
  tenantResuelto: string;
}): Promise<DestinoAdjunto> {
  const d = await leerDesvio().catch(() => null);

  if (!d || !d.activo) {
    return { tenantId: opts.tenantResuelto, desviado: false, motivo: "sin desvío" };
  }
  if (!opts.phoneNumberId || d.phoneNumberId !== opts.phoneNumberId) {
    return {
      tenantId: opts.tenantResuelto,
      desviado: false,
      motivo: `hay desvío pero es para el número ${d.phoneNumberId}, no para ${opts.phoneNumberId ?? "(ausente)"}`,
    };
  }
  return {
    tenantId: d.tenantId,
    desviado: true,
    motivo: `desvío activo: los adjuntos de ${d.phoneNumberId} van a ${d.tenantId}`,
  };
}
