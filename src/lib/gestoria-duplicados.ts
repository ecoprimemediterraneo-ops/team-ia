// La misma factura, dos veces.
//
// POR QUÉ IMPORTA Y NO ES UN DETALLE
// -----------------------------------
// Por WhatsApp la misma factura entra dos y tres veces: el cliente la manda, no
// se acuerda, la vuelve a mandar; el proveedor se la reenvía; alguien la
// fotografía y además la manda en PDF. Si se cuela dos veces, el IVA se deduce
// dos veces, y eso Hacienda lo ve. Es la clase de error que no da la cara hasta
// que llega el requerimiento.
//
// DOS NIVELES DE CERTEZA, Y NO UNO
// --------------------------------
//   SEGURO   mismo número de factura y mismo importe. El número de factura es
//            único por emisor: si coinciden los dos, es el mismo papel.
//   PROBABLE no hay número (un ticket, una foto mal leída) pero coinciden
//            emisor, importe y fecha. Casi siempre lo es, pero un bar puede
//            emitir dos tickets iguales el mismo día y son dos gastos reales.
//
// NUNCA SE BORRA. Se marca, se enseña y decide Jose. Borrar una factura buena
// creyéndola repetida es peor que el problema: la de verdad desaparece y nadie
// se entera hasta el cierre del trimestre.

import "server-only";
import type { FacturaRecibida } from "./gestoria-facturas";

export type Certeza = "seguro" | "probable";

export type Duplicado = {
  /** El documento que ya estaba. El nuevo es el que se marca. */
  originalId: string;
  certeza: Certeza;
  /** "igual que la factura del 3 de marzo". Se enseña tal cual. */
  detalle: string;
};

const normalizarNumero = (v: string | null | undefined): string =>
  (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const normalizarNif = (v: string | null | undefined): string =>
  (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Al céntimo, y en valor absoluto: un abono es la misma cifra en negativo. */
const mismoImporte = (a: number | null | undefined, b: number | null | undefined): boolean =>
  typeof a === "number" && typeof b === "number" &&
  Math.round(Math.abs(a) * 100) === Math.round(Math.abs(b) * 100);

const fechaBonita = (f: string | null | undefined): string => {
  if (!f) return "sin fecha";
  const d = new Date(`${f}T12:00:00Z`);
  return isNaN(d.getTime()) ? f : d.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
};

/**
 * ¿Este documento ya está guardado?
 *
 * Se compara SOLO contra los del mismo cliente: dos clientes distintos pueden
 * tener facturas del mismo proveedor por el mismo importe el mismo día, y son
 * dos gastos de verdad.
 *
 * Devuelve `null` si no lo es. Los descartados y los ya marcados como duplicado
 * no cuentan como original: si no, el tercer envío apuntaría al segundo.
 */
export function buscarDuplicado(
  nueva: FacturaRecibida,
  yaGuardadas: FacturaRecibida[],
): Duplicado | null {
  const numeroNueva = normalizarNumero(nueva.lectura?.numero?.valor);
  const nifNueva = normalizarNif(nueva.lectura?.nifEmisor?.valor);

  const candidatas = yaGuardadas.filter(
    (f) =>
      f.id !== nueva.id &&
      f.estado !== "descartada" &&
      !f.duplicado_de &&
      // Mismo cliente, incluido "las dos sin dueño todavía".
      (f.cliente_id ?? null) === (nueva.cliente_id ?? null),
  );

  // --- SEGURO: número de factura + importe ---
  if (numeroNueva) {
    const igual = candidatas.find(
      (f) =>
        normalizarNumero(f.lectura?.numero?.valor) === numeroNueva &&
        mismoImporte(f.importe, nueva.importe),
    );
    if (igual) {
      return {
        originalId: igual.id,
        certeza: "seguro",
        detalle: `Mismo número de factura (${nueva.lectura?.numero?.valor}) y mismo importe que la del ${fechaBonita(igual.fecha_factura)}.`,
      };
    }
  }

  // --- PROBABLE: sin número, pero emisor + importe + fecha ---
  if (!numeroNueva && nifNueva && nueva.fecha_factura) {
    const parecida = candidatas.find(
      (f) =>
        normalizarNif(f.lectura?.nifEmisor?.valor) === nifNueva &&
        mismoImporte(f.importe, nueva.importe) &&
        f.fecha_factura === nueva.fecha_factura,
    );
    if (parecida) {
      return {
        originalId: parecida.id,
        certeza: "probable",
        detalle: `Mismo proveedor, mismo importe y misma fecha que la del ${fechaBonita(parecida.fecha_factura)}. No trae número, así que compruébalo.`,
      };
    }
  }

  return null;
}

/** ¿Cuenta este documento? Un duplicado no suma en totales ni cruza con el banco. */
export const cuenta = (f: FacturaRecibida): boolean => !f.duplicado_de && f.estado !== "descartada";

/** Los duplicados detectados este mes, para el contador de arriba. */
export function duplicadosDelMes(facturas: FacturaRecibida[], hoy: string): FacturaRecibida[] {
  const mes = hoy.slice(0, 7);
  return facturas.filter((f) => !!f.duplicado_de && (f.fecha_recepcion || "").slice(0, 7) === mes);
}
