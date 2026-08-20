// ¿Este ingreso es una venta, o es otra cosa?
//
// El mismo criterio que ya se usa con los cargos, pero al revés y con más
// cuidado. En compras, colar un cargo en "no lleva factura" cuesta un IVA que
// el cliente no se deduce. En ventas, colar un ingreso en "no es una venta"
// esconde una venta sin declarar — y eso es lo que le puede caer encima al
// cliente en una inspección.
//
// Por eso el reparto es todavía más asimétrico: ante cualquier duda, el ingreso
// va al bloque de VENTAS SIN FACTURA, que es el que se revisa. Se prefiere que
// el gestor descarte a mano un traspaso a que un cobro se quede escondido.
//
// Y ESTO NO ESCONDE NADA. Igual que en los cargos, aquí solo se decide en qué
// bloque se enseña un ingreso. Todos se enseñan.

import "server-only";
import { normalizar } from "./gestoria-clasificacion";

export type GrupoNoEsVenta =
  | "traspaso" | "devolucion" | "prestamo" | "subvencion" | "hacienda" | "banco";

export const ETIQUETA_INGRESO: Record<GrupoNoEsVenta, string> = {
  traspaso: "Traspasos entre cuentas propias",
  devolucion: "Devoluciones de proveedores",
  prestamo: "Préstamos y aportaciones de socios",
  subvencion: "Subvenciones y ayudas",
  hacienda: "Devoluciones de Hacienda y organismos",
  banco: "Intereses y abonos del banco",
};

/**
 * Señales de que el ingreso SÍ es un cobro de cliente. Se miran las primeras y
 * ganan: un TPV es la caja del negocio, y "TRANSF RECIBIDA" a secas es un cobro
 * mucho más veces que un traspaso.
 */
const SI_ES_VENTA = [
  "TPV", "COMERCIO", "TARJETA", "VISA", "MASTERCARD", "BIZUM", "COBRO",
  "FACTURA", "FRA", "N FACTURA", "PAGO DE", "INGRESO EFECTIVO", "INGRESO CHEQUE",
  "REDSYS", "STRIPE", "PAYPAL", "SUMUP", "IZETTLE", "SQUARE", "GLOVO",
  "UBER EATS", "JUST EAT", "DELIVEROO", "BOOKING", "AIRBNB", "AMAZON PAGO",
];

/**
 * Solo lo que de verdad NO puede ser una venta. La lista es corta a propósito.
 * Un literal genérico de transferencia NO entra aquí: en un extracto real la
 * mayoría de las transferencias recibidas son cobros de clientes.
 */
const LISTAS: Array<[GrupoNoEsVenta, string[]]> = [
  ["traspaso", ["A MI CUENTA", "ENTRE CUENTAS PROPIAS", "TRASPASO ENTRE CUENTAS", "TRASPASO PROPIA"]],
  ["devolucion", [
    "DEVOLUCION COMPRA", "ABONO PROVEEDOR", "DEVOLUCION PROVEEDOR", "RETROCESION",
    "ANULACION COMPRA", "REEMBOLSO PROVEEDOR",
    // Una transferencia devuelta es dinero que vuelve porque un pago rebotó, no
    // un cobro. Sale tal cual en el extracto real de la gestoría de prueba.
    "DEVOLUCION TRANSF", "DEVOLUCION RECIBO", "DEVOLUCION ADEUDO",
  ]],
  ["prestamo", [
    "PRESTAMO", "DISPOSICION PRESTAMO", "POLIZA DE CREDITO", "DISPOSICION CREDITO",
    "APORTACION SOCIO", "APORTACION SOCIOS", "AMPLIACION CAPITAL", "LEASING DISPOSICION",
  ]],
  ["subvencion", [
    "SUBVENCION", "AYUDA", "JUNTA DE ANDALUCIA AY", "SEPE", "FONDO EUROPEO",
    "NEXT GENERATION", "IDEA AGENCIA",
  ]],
  ["hacienda", [
    "DEVOLUCION AEAT", "DEVOLUCION HACIENDA", "AEAT DEVOLUCION", "DEVOLUCION IVA",
    "DEVOLUCION RENTA", "TGSS DEVOLUCION", "DEVOLUCION SEGURIDAD",
  ]],
  ["banco", ["ABONO INTERESES", "LIQUIDACION INTERESES", "REGULARIZACION COMISION", "DEVOLUCION COMISION"]],
];

/** Una palabra suelta solo cuenta si va sola, no dentro de otra. */
function palabraSuelta(texto: string, palabra: string): boolean {
  return new RegExp(`(^| )${palabra}( |$)`).test(texto);
}

/**
 * Devuelve el grupo si el ingreso NO puede ser una venta, y null si sí puede
 * (o si hay la más mínima duda).
 */
export function grupoDelIngreso(concepto: string): GrupoNoEsVenta | null {
  const t = normalizar(concepto);
  if (!t) return null;
  for (const s of SI_ES_VENTA) if (t.includes(normalizar(s))) return null;
  for (const [grupo, literales] of LISTAS) {
    for (const l of literales) {
      const n = normalizar(l);
      const encaja = n.includes(" ") ? t.includes(n) : palabraSuelta(t, n);
      if (encaja) return grupo;
    }
  }
  return null;
}
