// En qué bloque va cada cargo. Una función y una regla de precedencia.
//
// Vive aparte del clasificador porque el clasificador solo sabe leer conceptos,
// y aquí manda algo más fuerte: lo que el gestor ha decidido a mano. Si Jose ha
// dicho que un cargo lleva factura, lleva factura, aunque el concepto diga
// "TRASPASO" y aunque la lista opine lo contrario. Nunca al revés.

import "server-only";
import { clasificarSinFactura, normalizar, type GrupoSinFactura } from "./gestoria-clasificacion";
import type { MovimientoBanco, ConceptoAprendido } from "./gestoria-facturas";

export type Bloque = { bloque: 2 } | { bloque: 3; grupo: GrupoSinFactura; aMano: boolean };

/**
 * Decide el bloque de un cargo.
 *
 * Orden, de más fuerte a menos:
 *   1. Lo que se movió a mano en ESE cargo.
 *   2. Lo que se aprendió de ese concepto para ESE cliente.
 *   3. La lista de conceptos.
 *   4. Bloque 2, que es el que se revisa.
 */
export function bloqueDe(mov: MovimientoBanco, aprendidos: ConceptoAprendido[] = []): Bloque {
  const porLista = clasificarSinFactura(mov.concepto);

  if (mov.bloque_manual === "lleva") return { bloque: 2 };
  if (mov.bloque_manual === "no_lleva") {
    return { bloque: 3, grupo: porLista ?? "traspaso", aMano: true };
  }

  const concepto = normalizar(mov.concepto);
  const aprendido = aprendidos.find((a) => a.cliente_id === mov.cliente_id && a.concepto === concepto);
  if (aprendido) {
    return aprendido.destino === "lleva"
      ? { bloque: 2 }
      : { bloque: 3, grupo: porLista ?? "traspaso", aMano: true };
  }

  return porLista ? { bloque: 3, grupo: porLista, aMano: false } : { bloque: 2 };
}

/** Atajo: ¿este cargo va al bloque de "no lleva factura"? */
export const esSinFactura = (mov: MovimientoBanco, aprendidos: ConceptoAprendido[] = []) =>
  bloqueDe(mov, aprendidos).bloque === 3;
