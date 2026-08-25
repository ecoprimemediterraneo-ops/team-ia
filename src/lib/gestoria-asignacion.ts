// De quién es este documento. Se decide SOLO con datos duros, y se decide solo.
//
// EL PROBLEMA QUE ARREGLA
// -----------------------
// Antes esto solo PROPONÍA ("Parece de: Bar El Puerto") y todo se quedaba en la
// bandeja hasta que el gestor lo colocaba a mano. Con cien clientes y cien
// facturas al mes por cliente eso son diez mil clics al mes. Inviable. Jose no
// está para clasificar documentos: está para conciliar el banco y para saber a
// quién tiene que reclamar. Así que lo que se puede resolver con un dato duro se
// resuelve sin preguntar, y la bandeja pasa a ser la excepción.
//
// QUÉ CUENTA COMO DATO DURO, Y POR QUÉ SOLO ESTO
// ----------------------------------------------
//   1. El NIF impreso en el documento contra el NIF del cliente.
//   2. El teléfono desde el que llegó contra los teléfonos del cliente.
//
// Y NADA MÁS. Ni el nombre del proveedor, ni el parecido del texto, ni el
// contenido. Un proveedor sale en las facturas de veinte clientes distintos:
// "es de Bar El Puerto porque pone cervezas" es exactamente cómo se le mete a un
// cliente el gasto de otro, y eso no se descubre hasta que Hacienda pregunta.
// Un dato duro coincide o no coincide; no hay "se parece bastante".
//
// LA AMBIGÜEDAD NO SE RESUELVE, SE DECLARA
// ----------------------------------------
// Si el mismo NIF o el mismo teléfono está en dos clientes, NO se asigna. Elegir
// uno a cara o cruz acierta la mitad de las veces y el error queda escrito y
// silencioso. Va a "Sin identificar" marcado como conflicto, que es una cosa
// que el gestor puede arreglar en un minuto en las fichas.

import "server-only";
import type { ClienteGestoria } from "./gestoria-clientes";
import { normalizarNif, soloDigitos, normalizarEmail } from "./gestoria-identidad";

/** Por qué se asignó (o por qué no se pudo). Se guarda y se enseña. */
export type MotivoAsignacion = "nif" | "telefono" | "email" | "manual";

export const TEXTO_MOTIVO: Record<MotivoAsignacion, string> = {
  nif: "NIF coincide",
  telefono: "Teléfono coincide",
  email: "Correo coincide",
  manual: "Asignado a mano",
};

export type Resolucion =
  | { tipo: "asignar"; clienteId: string; clienteNombre: string; motivo: MotivoAsignacion; detalle: string }
  | {
      tipo: "conflicto";
      motivo: MotivoAsignacion;
      valor: string;
      clientes: Array<{ id: string; nombre: string }>;
      detalle: string;
    }
  | { tipo: "sin_resolver" };

/** Los datos del documento con los que se intenta resolver. */
export type PistasDocumento = {
  /** NIF del DESTINATARIO leído del papel. El del emisor no vale: ese es el proveedor. */
  nifDestinatario?: string | null;
  /** De dónde llegó: un teléfono si vino por Pablo, un correo si vino por Lucía. */
  remitente?: string | null;
};

/**
 * ¿De quién es? Coincidencia EXACTA tras normalizar, o nada.
 *
 * El orden importa: manda el NIF sobre el teléfono. El papel dice a nombre de
 * quién está la factura; el teléfono solo dice quién la mandó, y una gestoría
 * recibe facturas reenviadas por terceros todo el rato.
 */
export function resolverPorDatoDuro(clientes: ClienteGestoria[], pistas: PistasDocumento): Resolucion {
  // --- 1. Por NIF ---
  const nif = normalizarNif(pistas.nifDestinatario);
  if (nif) {
    const casan = clientes.filter((c) => c.nif && normalizarNif(c.nif) === nif);
    if (casan.length === 1) {
      return {
        tipo: "asignar",
        clienteId: casan[0].id,
        clienteNombre: casan[0].nombre,
        motivo: "nif",
        detalle: `NIF ${pistas.nifDestinatario?.trim()} coincide con ${casan[0].nombre}`,
      };
    }
    if (casan.length > 1) {
      return {
        tipo: "conflicto",
        motivo: "nif",
        valor: nif,
        clientes: casan.map((c) => ({ id: c.id, nombre: c.nombre })),
        detalle: `El NIF ${nif} está en ${casan.length} fichas: ${casan.map((c) => c.nombre).join(", ")}. Corrige una y se resuelve solo.`,
      };
    }
  }

  const remitente = (pistas.remitente || "").trim();

  // --- 2. Por teléfono ---
  const tel = soloDigitos(remitente);
  if (tel && !remitente.includes("@")) {
    const casan = clientes.filter((c) => c.id === tel || (c.telefonos || []).includes(tel));
    if (casan.length === 1) {
      return {
        tipo: "asignar",
        clienteId: casan[0].id,
        clienteNombre: casan[0].nombre,
        motivo: "telefono",
        detalle: `Llegó del teléfono ${tel}, que es de ${casan[0].nombre}`,
      };
    }
    if (casan.length > 1) {
      return {
        tipo: "conflicto",
        motivo: "telefono",
        valor: tel,
        clientes: casan.map((c) => ({ id: c.id, nombre: c.nombre })),
        detalle: `El teléfono ${tel} está en ${casan.length} fichas: ${casan.map((c) => c.nombre).join(", ")}. Corrige una y se resuelve solo.`,
      };
    }
  }

  // --- 3. Por correo (los que entran por Lucía) ---
  const email = normalizarEmail(remitente);
  if (email.includes("@")) {
    const casan = clientes.filter((c) => (c.emails || []).includes(email));
    if (casan.length === 1) {
      return {
        tipo: "asignar",
        clienteId: casan[0].id,
        clienteNombre: casan[0].nombre,
        motivo: "email",
        detalle: `Llegó del correo ${email}, que es de ${casan[0].nombre}`,
      };
    }
    if (casan.length > 1) {
      return {
        tipo: "conflicto",
        motivo: "email",
        valor: email,
        clientes: casan.map((c) => ({ id: c.id, nombre: c.nombre })),
        detalle: `El correo ${email} está en ${casan.length} fichas: ${casan.map((c) => c.nombre).join(", ")}. Corrige una y se resuelve solo.`,
      };
    }
  }

  return { tipo: "sin_resolver" };
}
