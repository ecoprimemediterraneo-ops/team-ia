// ¿A qué negocio pertenece esta llamada?
//
// Carmen atiende el teléfono y Retell manda un `slug` con el negocio. Cuando no
// venía, el código caía a `"bendito-arte"` escrito a fuego: el salón piloto.
//
// Con un solo cliente eso no se nota. Con dos, una llamada sin `slug` mete la
// cita en la agenda de OTRO negocio, en su Google Calendar, con el nombre y el
// teléfono de una persona que nunca llamó allí. Y no da error: la cita se crea
// perfectamente, solo que en el sitio equivocado.
//
// Reglas:
//   1. Si la llamada trae `slug` y ese negocio existe → ése, sin discusión.
//   2. Si no lo trae, se usa `CARMEN_SLUG_POR_DEFECTO` si está configurada.
//   3. Si tampoco, y solo hay UN negocio dado de alta, se usa ése: es el caso
//      del piloto de hoy y no hay ninguna ambigüedad.
//   4. Si hay varios y no sabemos cuál, NO se adivina.

import { getBusinessBySlug, listBusinesses } from "./booking";

export type SalonResuelto =
  | { ok: true; slug: string; como: "de_la_llamada" | "configurado" | "unico" }
  | { ok: false; motivo: "no_existe" | "ambiguo" };

export async function resolverSalonDeLlamada(slugDeLaLlamada?: string): Promise<SalonResuelto> {
  const pedido = (slugDeLaLlamada || "").trim();
  if (pedido) {
    const b = await getBusinessBySlug(pedido);
    if (b) return { ok: true, slug: b.slug, como: "de_la_llamada" };
    console.warn(`[carmen] la llamada trae slug "${pedido}" y no existe ningún negocio con ese slug.`);
    return { ok: false, motivo: "no_existe" };
  }

  const configurado = (process.env.CARMEN_SLUG_POR_DEFECTO || "").trim();
  if (configurado) {
    const b = await getBusinessBySlug(configurado);
    if (b) return { ok: true, slug: b.slug, como: "configurado" };
    console.warn(`[carmen] CARMEN_SLUG_POR_DEFECTO="${configurado}" no corresponde a ningún negocio.`);
  }

  const todos = await listBusinesses();
  if (todos.length === 1) return { ok: true, slug: todos[0].slug, como: "unico" };

  console.warn(
    `[carmen] LLAMADA SIN NEGOCIO: no viene slug y hay ${todos.length} negocios dados de alta ` +
      `(${todos.map((b) => b.slug).join(", ")}). No se adivina: antes se metía en el salón piloto.`,
  );
  return { ok: false, motivo: "ambiguo" };
}

/** Lo que Carmen dice en voz alta cuando no se puede saber de qué negocio es la llamada. */
export const MENSAJE_SIN_SALON =
  "Perdona, ahora mismo no puedo acceder a la agenda. Te paso con alguien del equipo y lo dejamos cerrado.";
