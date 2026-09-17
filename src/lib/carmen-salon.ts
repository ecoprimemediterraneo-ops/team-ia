// ¿A qué negocio pertenece esta llamada?
//
// ANTES: Retell mandaba un `slug` opcional; sin él, se caía a
// `CARMEN_SLUG_POR_DEFECTO`, y sin eso, al único negocio si solo había uno —
// con dos o más, Carmen se negaba a reservar. Era el caso normal, no una
// excepción: Retell casi nunca manda `slug` (no hay dónde configurarlo salvo
// a mano por negocio), así que con más de un cliente Carmen no reservaba casi
// nunca.
//
// AHORA: el número al que ha llamado el cliente (`call.to_number` de Retell)
// resuelve el negocio de la MISMA forma que el `phone_number_id` de WhatsApp
// resuelve a Pablo o el `instagram_user_id` a Marta — un número por cliente,
// dado de alta en `tenant.carmenPhoneNumber`. Es la fuente de verdad y va
// PRIMERO. El resto de reglas se quedan como red de seguridad para cuando
// todavía no se ha dado de alta el número de un cliente nuevo.
//
// Reglas, en orden:
//   1. El número al que se ha llamado es de un tenant conocido → su negocio.
//   2. Si la llamada trae `slug` y ese negocio existe → ése, sin discusión.
//   3. Si no, `CARMEN_SLUG_POR_DEFECTO` si está configurada.
//   4. Si tampoco, y solo hay UN negocio dado de alta, se usa ése.
//   5. Si hay varios y no sabemos cuál, NO se adivina.

import { getBusinessBySlug, listBusinesses, type BusinessBooking } from "./booking";
import { resolveTenantFromCarmenNumber } from "./tenants";

export type SalonResuelto =
  | { ok: true; slug: string; tenantId: string; como: "numero_llamado" | "de_la_llamada" | "configurado" | "unico" }
  | { ok: false; motivo: "no_existe" | "ambiguo" };

async function primerNegocioDeTenant(tenantId: string): Promise<BusinessBooking | null> {
  const todos = await listBusinesses();
  return todos.find((b) => b.tenantId === tenantId) ?? null;
}

export async function resolverSalonDeLlamada(
  slugDeLaLlamada?: string,
  /** `call.to_number` de Retell: el número al que ha llamado el cliente. */
  numeroLlamado?: string,
): Promise<SalonResuelto> {
  // 1) EL NÚMERO AL QUE HA LLAMADO. Va primero: es un dato de la llamada
  // misma, no una configuración que se pueda quedar desactualizada.
  const numero = (numeroLlamado || "").trim();
  if (numero) {
    const tenantId = await resolveTenantFromCarmenNumber(numero);
    if (tenantId) {
      const negocio = await primerNegocioDeTenant(tenantId);
      if (negocio) return { ok: true, slug: negocio.slug, tenantId, como: "numero_llamado" };
      console.warn(`[carmen] el número "${numero}" resuelve al tenant "${tenantId}", pero ese tenant no tiene ningún negocio de reservas dado de alta.`);
      return { ok: false, motivo: "no_existe" };
    }
    // Número desconocido: NO se cae al resto de reglas en silencio. Si Retell
    // manda un `to_number` y no es de nadie, es una llamada mal enrutada o un
    // cliente sin dar de alta todavía — no un caso para adivinar por slug.
    console.warn(`[carmen] el número al que se ha llamado ("${numero}") no es de ningún tenant. No se adivina por slug/configuración.`);
    return { ok: false, motivo: "no_existe" };
  }

  const pedido = (slugDeLaLlamada || "").trim();
  if (pedido) {
    const b = await getBusinessBySlug(pedido);
    if (b) return { ok: true, slug: b.slug, tenantId: b.tenantId, como: "de_la_llamada" };
    console.warn(`[carmen] la llamada trae slug "${pedido}" y no existe ningún negocio con ese slug.`);
    return { ok: false, motivo: "no_existe" };
  }

  const configurado = (process.env.CARMEN_SLUG_POR_DEFECTO || "").trim();
  if (configurado) {
    const b = await getBusinessBySlug(configurado);
    if (b) return { ok: true, slug: b.slug, tenantId: b.tenantId, como: "configurado" };
    console.warn(`[carmen] CARMEN_SLUG_POR_DEFECTO="${configurado}" no corresponde a ningún negocio.`);
  }

  const todos = await listBusinesses();
  if (todos.length === 1) return { ok: true, slug: todos[0].slug, tenantId: todos[0].tenantId, como: "unico" };

  console.warn(
    `[carmen] LLAMADA SIN NEGOCIO: no viene número conocido ni slug, y hay ${todos.length} negocios dados de alta ` +
      `(${todos.map((b) => b.slug).join(", ")}). No se adivina: antes se metía en el salón piloto.`,
  );
  return { ok: false, motivo: "ambiguo" };
}

/** Lo que Carmen dice en voz alta cuando no se puede saber de qué negocio es la llamada. */
export const MENSAJE_SIN_SALON =
  "Perdona, ahora mismo no puedo acceder a la agenda. Te paso con alguien del equipo y lo dejamos cerrado.";
