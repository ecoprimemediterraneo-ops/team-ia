// El cruce de las VENTAS: abonos del banco contra facturas emitidas.
//
// Es el espejo del cruce de compras (`gestoria-conciliacion.ts`), con dos
// diferencias que no son de forma:
//
// 1. LO QUE SE BUSCA ES EL INGRESO HUÉRFANO, no la factura que falta. En
//    compras, un cargo sin factura es IVA que el cliente no se deduce: dinero
//    suyo. En ventas, un ingreso sin factura emitida es una venta sin declarar.
//    Lo primero se reclama; lo segundo se avisa.
//
// 2. NO SE CRUZA POR PROVEEDOR. En compras se compara el concepto del banco con
//    el nombre del proveedor. Aquí el concepto trae al PAGADOR —el cliente del
//    cliente—, y una factura emitida no siempre dice a quién. Así que se cruza
//    por importe y fecha, y punto: inventarse una comparación de nombres daría
//    parejas que parecen buenas y no lo son.
//
// La ventana de fechas es MÁS ANCHA que en compras a propósito: una factura
// emitida se cobra a treinta o sesenta días. Un cargo se paga el día que se
// paga; un cobro llega cuando el cliente quiere.

import "server-only";
import type { MovimientoBanco } from "./gestoria-facturas";
import type { FacturaEmitida } from "./gestoria-ventas";
import { grupoDelIngreso, type GrupoNoEsVenta } from "./gestoria-ingresos";

/** Sesenta días: el plazo de cobro normal en España, más margen. */
export const VENTANA_COBRO_DIAS = 75;

export const TOLERANCIA_CENTIMOS = 2;

const diaAMs = (f: string) => new Date(`${f}T12:00:00Z`).getTime();
const distanciaDias = (a: string, b: string) => Math.abs(diaAMs(a) - diaAMs(b)) / 86_400_000;
const mismoImporte = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100);
const casiMismoImporte = (a: number, b: number) =>
  Math.abs(Math.round(a * 100) - Math.round(b * 100)) <= TOLERANCIA_CENTIMOS;

export type MotivoSugerenciaVenta = "varias" | "centimos" | "fuera_de_plazo";

export type SugerenciaVenta = {
  movimiento: MovimientoBanco;
  candidatas: FacturaEmitida[];
  motivo: MotivoSugerenciaVenta;
};

export type IngresoSinFactura = {
  movimiento: MovimientoBanco;
  /** null = puede ser una venta y no se le ha encontrado factura. Esto es lo grave. */
  grupo: GrupoNoEsVenta | null;
  /**
   * El ingreso cae en un mes del que NO se ha subido listado de ventas.
   *
   * Sin esto, la primera vez que un gestor sube el listado de enero contra un
   * extracto de todo el año, la pantalla le grita "112 ventas sin facturar" —
   * y son 112 meses que no ha cargado, no 112 delitos. Una cifra así, la
   * primera vez que la ves, no te hace revisar: te hace no volver a mirar.
   */
  fueraDelPeriodo: boolean;
};

export type ResultadoCruceVentas = {
  /** Un abono, una factura emitida, sin ambigüedad. */
  automaticos: Array<{ movimiento: MovimientoBanco; venta: FacturaEmitida }>;
  /** Necesitan un clic. No cuentan como cuadradas. */
  sugerencias: SugerenciaVenta[];
  /** Ingresos que se quedan sin factura. Los de `grupo: null` son el problema. */
  sinFactura: IngresoSinFactura[];
  /** Facturas emitidas que nadie ha cobrado todavía. Ojo: no es un fallo, es un impagado. */
  sinCobrar: FacturaEmitida[];
};

export function cruzarVentas(
  movimientos: MovimientoBanco[],
  ventas: FacturaEmitida[],
): ResultadoCruceVentas {
  const abonos = movimientos.filter((m) => m.signo === "abono" && m.estado !== "ignorado");
  const disponibles = ventas.filter((v) => v.estado === "pendiente" && v.total > 0);

  // Qué periodo cubren los listados cargados. Se ensancha por el final con la
  // ventana de cobro: una factura de finales de mes se cobra el mes siguiente.
  const fechas = ventas.map((v) => v.fecha).filter(Boolean).sort();
  const desde = fechas[0] ?? null;
  const hasta = fechas[fechas.length - 1] ?? null;
  const dentroDelPeriodo = (f: string): boolean => {
    if (!desde || !hasta) return false;
    return diaAMs(f) >= diaAMs(desde) - 15 * 86_400_000
        && diaAMs(f) <= diaAMs(hasta) + VENTANA_COBRO_DIAS * 86_400_000;
  };

  const automaticos: ResultadoCruceVentas["automaticos"] = [];
  const sugerencias: SugerenciaVenta[] = [];
  const sinFactura: IngresoSinFactura[] = [];
  const yaUsadas = new Set<string>();

  const candidatasDe = (mov: MovimientoBanco, tolerancia: boolean) =>
    disponibles
      .filter((v) => !yaUsadas.has(v.id))
      .filter((v) => (tolerancia ? casiMismoImporte(v.total, mov.importe) : mismoImporte(v.total, mov.importe)))
      .sort((a, b) => distanciaDias(a.fecha, mov.fecha) - distanciaDias(b.fecha, mov.fecha));

  // Igual que en compras: primero los que cuadran en el mismo día, para que un
  // cobro no se lleve la factura que le tocaba a otro.
  const orden = [...abonos].sort((a, b) => {
    const mejor = (m: MovimientoBanco) => {
      const c = candidatasDe(m, false)[0];
      return c ? distanciaDias(c.fecha, m.fecha) : 9999;
    };
    return mejor(a) - mejor(b);
  });

  for (const mov of orden) {
    const exactas = candidatasDe(mov, false);
    const enPlazo = exactas.filter((v) => distanciaDias(v.fecha, mov.fecha) <= VENTANA_COBRO_DIAS);

    if (enPlazo.length === 1) {
      yaUsadas.add(enPlazo[0].id);
      automaticos.push({ movimiento: mov, venta: enPlazo[0] });
      continue;
    }
    if (enPlazo.length > 1) {
      // Varias facturas del mismo importe: el gestor elige. Enlazar la más
      // cercana sería adivinar, y con dos facturas iguales del mismo cliente se
      // acierta la mitad de las veces.
      sugerencias.push({ movimiento: mov, candidatas: enPlazo.slice(0, 6), motivo: "varias" });
      continue;
    }
    if (exactas.length) {
      // Cuadra el importe pero se cobró mucho después. Casi siempre es la
      // buena; aun así se pregunta, porque a 90 días la coincidencia de importe
      // ya no es tan improbable.
      sugerencias.push({ movimiento: mov, candidatas: exactas.slice(0, 6), motivo: "fuera_de_plazo" });
      continue;
    }

    const porCentimos = candidatasDe(mov, true)
      .filter((v) => distanciaDias(v.fecha, mov.fecha) <= VENTANA_COBRO_DIAS);
    if (porCentimos.length) {
      sugerencias.push({ movimiento: mov, candidatas: porCentimos.slice(0, 6), motivo: "centimos" });
      continue;
    }

    sinFactura.push({
      movimiento: mov,
      grupo: grupoDelIngreso(mov.concepto),
      fueraDelPeriodo: !dentroDelPeriodo(mov.fecha),
    });
  }

  const cobradas = new Set([
    ...automaticos.map((a) => a.venta.id),
    ...ventas.filter((v) => v.estado === "conciliada").map((v) => v.id),
  ]);
  const sinCobrar = disponibles.filter((v) => !cobradas.has(v.id));

  return { automaticos, sugerencias, sinFactura, sinCobrar };
}

export type ResumenVentas = {
  abonos: number;
  cuadrados: number;
  porRevisar: number;
  /** Ingresos que pueden ser ventas y no tienen factura, DENTRO del periodo cargado. LA cifra. */
  ventasSinFacturar: number;
  importeSinFacturar: number;
  /** Ingresos de meses sin listado. No son un problema: son trabajo por cargar. */
  sinListado: number;
  /** Ingresos que no son ventas (traspasos, préstamos…). Se enseñan, no cuentan. */
  noSonVentas: number;
  facturasSinCobrar: number;
  importeSinCobrar: number;
};

export function resumenVentas(r: ResultadoCruceVentas): ResumenVentas {
  const sospechosos = r.sinFactura.filter((x) => x.grupo === null && !x.fueraDelPeriodo);
  return {
    abonos: r.automaticos.length + r.sugerencias.length + r.sinFactura.length,
    cuadrados: r.automaticos.length,
    porRevisar: r.sugerencias.length,
    ventasSinFacturar: sospechosos.length,
    importeSinFacturar: sospechosos.reduce((s, x) => s + x.movimiento.importe, 0),
    sinListado: r.sinFactura.filter((x) => x.grupo === null && x.fueraDelPeriodo).length,
    noSonVentas: r.sinFactura.filter((x) => x.grupo !== null).length,
    facturasSinCobrar: r.sinCobrar.length,
    importeSinCobrar: r.sinCobrar.reduce((s, v) => s + v.total, 0),
  };
}
