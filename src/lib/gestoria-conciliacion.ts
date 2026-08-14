// =============================================================================
// CRUCE del extracto contra el saco de facturas.
// =============================================================================
//
// La pregunta que contesta este módulo es UNA: ¿qué cargos del banco no tienen
// factura que los justifique? Todo lo demás es contexto.
//
// TRES REGLAS QUE MANDAN SOBRE EL RESTO:
//
//   1. Ante la duda, NO se elige. Si un importe casa con varias facturas, se
//      deja como SUGERENCIA para que lo confirme el gestor. Conciliar mal es
//      peor que no conciliar: deja un cargo por justificado que no lo está y
//      nadie vuelve a mirarlo.
//   2. Las facturas SIN importe no entran en el cruce. No hay OCR: mientras el
//      gestor no teclee importe y fecha, esa factura no puede casar con nada.
//   3. Nada de pagos parciales ni aplazados. Un pagaré no se persigue aquí.
//
// El módulo es PURO: recibe listas y devuelve decisiones. No escribe. Así se
// puede probar el cruce sin tocar disco y el panel enseña exactamente lo que
// haría la importación.

import "server-only";
import type { FacturaRecibida, MovimientoBanco } from "./gestoria-facturas";

/** Días arriba y abajo entre fecha de factura y fecha del cargo. */
export const VENTANA_DIAS = 5;

const diaAMs = (f: string) => new Date(`${f}T12:00:00Z`).getTime();

/** ¿Caen dentro de la ventana pactada? */
export function dentroDeVentana(fechaFactura: string, fechaMovimiento: string, dias = VENTANA_DIAS): boolean {
  const a = diaAMs(fechaFactura);
  const b = diaAMs(fechaMovimiento);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= dias * 86_400_000;
}

/** Importes iguales al céntimo. */
const mismoImporte = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100);

/**
 * Céntimos de margen. Un extracto y una factura pueden bailar un céntimo por
 * redondeo del IVA y es el mismo gasto.
 *
 * Lo que casa SOLO por este margen no se concilia solo: entra como sugerencia.
 * Aproximar importes en contabilidad se hace con el gestor mirando.
 */
export const TOLERANCIA_CENTIMOS = 2;

const casiMismoImporte = (a: number, b: number) =>
  Math.abs(Math.round(a * 100) - Math.round(b * 100)) <= TOLERANCIA_CENTIMOS;

/** Días de diferencia entre dos fechas ISO. */
const distanciaDias = (a: string, b: string) =>
  Math.round(Math.abs(diaAMs(a) - diaAMs(b)) / 86_400_000);

// -----------------------------------------------------------------------------
// ¿De qué habla este cargo?
// -----------------------------------------------------------------------------

const sinTildes = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

/**
 * Palabras que aparecen en CASI TODOS los conceptos bancarios y no identifican a
 * nadie. Si no se quitan, "PAGO" casaría un recibo de la luz con una factura de
 * neumáticos.
 */
const RUIDO = new Set([
  "COMP", "COMPRA", "TPV", "FISICO", "VIRTUAL", "NACI", "NACIONAL", "INTER",
  "TRANSF", "TRANSFERENCIA", "SEPA", "PAGO", "PAGOS", "RECIBO", "RECIBOS", "RCBO",
  "VARIOS", "ADEUDO", "DOMIC", "DOMICILIACION", "CARGO", "ABONO", "OTROS",
  "FACTURA", "FACTURAS", "FACT", "OPERACION", "CONCEPTO", "REFERENCIA", "NUMERO",
  "CLIENTE", "PROVEEDOR", "IMPORTE", "EUROS", "MES", "DEL", "LOS", "LAS", "POR",
  "CON", "SIN", "PARA", "SOCIEDAD", "LIMITADA", "ANONIMA",
]);

/** Trocea un texto en palabras que de verdad identifican algo. */
export function palabrasUtiles(texto: string): Set<string> {
  return new Set(
    sinTildes(texto || "")
      .split(/[^A-Z0-9]+/)
      .filter((p) => p.length >= 4 && !RUIDO.has(p) && !/^\d+$/.test(p)),
  );
}

/**
 * ¿Hablan de lo mismo el concepto del banco y la factura?
 *
 * Basta UNA palabra en común. Se mira contra el proveedor y también contra el
 * nombre del fichero, porque media España pone el número de factura en el
 * concepto de la transferencia ("Pago Fac A25/19378") y ahí está la prueba.
 *
 * Es comparación de texto, determinista. Aquí no entra ningún modelo.
 */
export function hablanDeLoMismo(concepto: string, factura: { proveedor?: string | null; nombre_original?: string }): boolean {
  const delBanco = palabrasUtiles(concepto);
  if (delBanco.size === 0) return false;
  const deLaFactura = palabrasUtiles(
    `${factura.proveedor ?? ""} ${(factura.nombre_original ?? "").replace(/\.[a-z0-9]+$/i, "")}`,
  );
  for (const p of deLaFactura) if (delBanco.has(p)) return true;
  return false;
}

// -----------------------------------------------------------------------------
// ¿Es un gasto de proveedor?
// -----------------------------------------------------------------------------

/**
 * Lo que NO es una factura de proveedor y por tanto nunca se le puede reclamar
 * al cliente: nóminas, impuestos, seguros sociales, lo que cobra el propio banco
 * y los traspasos entre cuentas del cliente.
 *
 * Se decide por el concepto, con listas cerradas. No se borra nada: solo deja de
 * salir en la lista de lo que hay que pedir, y el filtro se quita con un clic.
 */
const NO_ES_PROVEEDOR: Array<[RegExp, string]> = [
  [/NOMIN|N[OÓ]MIN|SALARIO|FINIQUITO/i, "nómina"],
  [/SEG\.?\s*SOCIAL|SEGURIDAD SOCIAL|CUOTAS SEG|TGSS|RETA/i, "seguridad social"],
  [/HACIENDA|A\.?E\.?A\.?T|AGENCIA TRIBUTARIA|IMPUESTO|TRIBUT|MODELO \d{3}/i, "impuestos"],
  [/COMISI[OÓ]N|COMIS\.|LIQUIDAC|INTERESES|MANTENIMIENTO DE CUENTA|GASTOS ADMIN/i, "gastos del banco"],
  [/TRASPASO|TRASP\./i, "traspaso entre cuentas propias"],
];

/** Devuelve el motivo por el que NO es gasto de proveedor, o null si sí lo es. */
export function motivoNoEsProveedor(concepto: string): string | null {
  for (const [re, motivo] of NO_ES_PROVEEDOR) if (re.test(concepto || "")) return motivo;
  return null;
}

export type Emparejamiento =
  | { movimiento: MovimientoBanco; factura: FacturaRecibida; tipo: "automatico" }
  | { movimiento: MovimientoBanco; candidatas: FacturaRecibida[]; tipo: "sugerencia" };

/** Por qué una pareja no se ha dado por buena sola. */
export type MotivoSugerencia =
  | "varias"        // más de una factura cuadra
  | "otro_asunto"   // el concepto del banco no habla de ese proveedor
  | "centimos"      // solo cuadra con el margen de céntimos
  | "agrupada";     // varias facturas suman el cargo

export type Sugerencia = {
  movimiento: MovimientoBanco;
  candidatas: FacturaRecibida[];
  motivo: MotivoSugerencia;
  /** En "agrupada", las candidatas van juntas: se aceptan o se rechazan a la vez. */
  enBloque?: boolean;
};

export type ResultadoCruce = {
  /** Se enlazan solos: un cargo, una factura, sin ambigüedad. */
  automaticos: Array<{ movimiento: MovimientoBanco; factura: FacturaRecibida }>;
  /** Necesitan un clic del gestor. NO cuentan como conciliadas ni se reclaman. */
  sugerencias: Sugerencia[];
  /** Cargos que se quedan sin nada. Esto es lo que se reclama. */
  sinFactura: MovimientoBanco[];
};

/**
 * Cruza cargos contra facturas. NO toca los abonos: a nadie se le reclama la
 * factura de un ingreso.
 */
export function cruzar(movimientos: MovimientoBanco[], facturas: FacturaRecibida[]): ResultadoCruce {
  // Los "ignorados" son los que el gestor marcó como "no corresponde": no
  // vuelven a proponerse ni a reclamarse.
  const cargos = movimientos.filter((m) => m.signo === "cargo" && m.estado !== "ignorado");

  // Solo entran facturas utilizables: con importe Y fecha, y sin descartar ni
  // conciliar ya. Las que no tienen importe se quedan fuera a propósito.
  const disponibles = facturas.filter(
    (f) => f.estado === "pendiente" && typeof f.importe === "number" && !!f.fecha_factura,
  );

  const automaticos: ResultadoCruce["automaticos"] = [];
  const sugerencias: Sugerencia[] = [];
  const sinFactura: MovimientoBanco[] = [];
  // Una factura no puede justificar dos cargos distintos.
  const yaUsadas = new Set<string>();

  // Candidatas de cada cargo, ordenadas por cercanía de fecha.
  //
  // ANTES el recorrido iba en el orden de la lista —que llega de más nueva a más
  // vieja— y la PRIMERA coincidencia se quedaba la factura. Con dos cargos del
  // mismo importe ganaba siempre el más reciente, aunque la factura fuese del
  // día del otro. Ahora se resuelven primero los que cuadran en fecha exacta.
  const candidatasDe = (mov: MovimientoBanco) =>
    disponibles
      .filter(
        (f) =>
          !yaUsadas.has(f.id) &&
          // Lo que el gestor ya rechazó para ESTE cargo no se vuelve a proponer.
          !(mov.sugerencias_rechazadas ?? []).includes(f.id) &&
          casiMismoImporte(f.importe as number, mov.importe) &&
          dentroDeVentana(f.fecha_factura as string, mov.fecha),
      )
      .sort(
        (a, b) =>
          distanciaDias(a.fecha_factura as string, mov.fecha) -
            distanciaDias(b.fecha_factura as string, mov.fecha) ||
          a.id.localeCompare(b.id),
      );

  // Orden de proceso: primero el cargo cuya mejor factura cuadra más ajustada de
  // fecha. A igualdad, el más antiguo, que es el que lleva más esperando.
  const porResolver = [...cargos].sort((a, b) => {
    const da = candidatasDe(a)[0];
    const db = candidatasDe(b)[0];
    const va = da ? distanciaDias(da.fecha_factura as string, a.fecha) : 99;
    const vb = db ? distanciaDias(db.fecha_factura as string, b.fecha) : 99;
    return va - vb || a.fecha.localeCompare(b.fecha);
  });

  const decidido = new Map<string, "auto" | "sugerencia">();

  for (const mov of porResolver) {
    const candidatas = candidatasDe(mov);

    if (candidatas.length > 1) {
      sugerencias.push({ movimiento: mov, candidatas, motivo: "varias" });
      decidido.set(mov.id, "sugerencia");
      continue;
    }

    if (candidatas.length === 1) {
      const f = candidatas[0];
      const exacto = mismoImporte(f.importe as number, mov.importe);
      const mismoDia = distanciaDias(f.fecha_factura as string, mov.fecha) === 0;

      // ATAJO: mismo día, importe exacto al céntimo y una sola candidata.
      //
      // Tres coincidencias a la vez son prueba de sobra, y exigir además que el
      // proveedor aparezca en el concepto dejaba en 2 los 10 emparejamientos que
      // el gestor tenía resueltos solos: media España pone "Alquiler enero" en
      // la transferencia y no el nombre de la inmobiliaria.
      //
      // CON UN CANDADO, y este no se quita: el atajo NO vale para lo que no es
      // un gasto de proveedor. El pago a la AEAT de 855,00 € cumple las tres
      // condiciones contra una factura de rótulos del mismo día y volvería a
      // colarse. Un pago a Hacienda, una nómina o una comisión del banco no los
      // justifica la factura de un proveedor, cuadren como cuadren: ahí se sigue
      // exigiendo que hablen de lo mismo, y como no lo harán nunca, se queda en
      // sugerencia para que decida el gestor.
      if (exacto && mismoDia && !motivoNoEsProveedor(mov.concepto)) {
        automaticos.push({ movimiento: mov, factura: f });
        yaUsadas.add(f.id);
        decidido.set(mov.id, "auto");
        continue;
      }

      // Fuera del atajo, manda el proveedor: sin una palabra en común no se
      // concilia solo.
      if (!hablanDeLoMismo(mov.concepto, f)) {
        sugerencias.push({ movimiento: mov, candidatas, motivo: "otro_asunto" });
        decidido.set(mov.id, "sugerencia");
        continue;
      }
      // Hablan de lo mismo, pero el importe solo cuadra con el margen de
      // céntimos: lo mira el gestor.
      if (!exacto) {
        sugerencias.push({ movimiento: mov, candidatas, motivo: "centimos" });
        decidido.set(mov.id, "sugerencia");
        continue;
      }
      automaticos.push({ movimiento: mov, factura: f });
      yaUsadas.add(f.id);
      decidido.set(mov.id, "auto");
      continue;
    }

    // Sin candidata suelta: puede ser un adeudo agrupado.
    const grupo = buscarGrupo(mov, disponibles, yaUsadas);
    if (grupo) {
      sugerencias.push({ movimiento: mov, candidatas: grupo, motivo: "agrupada", enBloque: true });
      decidido.set(mov.id, "sugerencia");
      continue;
    }
  }

  // Lo que no se decidió, se reclama. Se rehace en el orden original para no
  // devolver la lista barajada por el orden de proceso.
  for (const mov of cargos) if (!decidido.has(mov.id)) sinFactura.push(mov);

  return { automaticos, sugerencias, sinFactura };
}

/** Cuántas facturas como mucho se combinan para formar un adeudo agrupado. */
const MAX_EN_GRUPO = 3;
/** Tope de facturas del mismo proveedor que se combinan, para no dispararse. */
const TOPE_COMBINAR = 12;

/**
 * Adeudos agrupados: un solo cargo que paga varias facturas del mismo proveedor.
 *
 * Se prueban parejas y tríos del MISMO proveedor en fechas cercanas al cargo.
 * Nunca automático: sumar facturas hasta que cuadre es justo la clase de cosa
 * que acierta por casualidad, así que siempre sale como sugerencia.
 */
function buscarGrupo(
  mov: MovimientoBanco,
  disponibles: FacturaRecibida[],
  yaUsadas: Set<string>,
): FacturaRecibida[] | null {
  const cerca = disponibles.filter(
    (f) =>
      !yaUsadas.has(f.id) &&
      typeof f.importe === "number" &&
      (f.importe as number) < mov.importe &&
      dentroDeVentana(f.fecha_factura as string, mov.fecha),
  );

  const porProveedor = new Map<string, FacturaRecibida[]>();
  for (const f of cerca) {
    const k = sinTildes(f.proveedor ?? "").trim() || "(sin proveedor)";
    porProveedor.set(k, [...(porProveedor.get(k) ?? []), f]);
  }

  for (const lista of porProveedor.values()) {
    const ls = lista.slice(0, TOPE_COMBINAR);
    for (let i = 0; i < ls.length; i++) {
      for (let j = i + 1; j < ls.length; j++) {
        if (casiMismoImporte((ls[i].importe as number) + (ls[j].importe as number), mov.importe)) {
          return [ls[i], ls[j]];
        }
        if (MAX_EN_GRUPO < 3) continue;
        for (let k = j + 1; k < ls.length; k++) {
          const suma = (ls[i].importe as number) + (ls[j].importe as number) + (ls[k].importe as number);
          if (casiMismoImporte(suma, mov.importe)) return [ls[i], ls[j], ls[k]];
        }
      }
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// Vista del panel
// -----------------------------------------------------------------------------

export type ResumenConciliacion = {
  cargosSinFactura: MovimientoBanco[];
  sumaSinFactura: number;
  conciliados: Array<{ movimiento: MovimientoBanco; factura: FacturaRecibida | null }>;
  facturasSinMovimiento: FacturaRecibida[];
  sugerencias: ResultadoCruce["sugerencias"];
};

/**
 * Los tres bloques del panel, ya ordenados.
 *
 * Los cargos sin factura van por importe DESCENDENTE: lo primero que quiere ver
 * un gestor es el agujero más grande, no el más antiguo.
 */
export function resumenConciliacion(
  movimientos: MovimientoBanco[],
  facturas: FacturaRecibida[],
): ResumenConciliacion {
  const porId = new Map(facturas.map((f) => [f.id, f]));

  const cargosSinFactura = movimientos
    .filter((m) => m.signo === "cargo" && m.estado === "sin_factura")
    .sort((a, b) => b.importe - a.importe);

  const conciliados = movimientos
    .filter((m) => m.estado === "conciliado")
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((m) => ({ movimiento: m, factura: m.factura_id ? porId.get(m.factura_id) ?? null : null }));

  const facturasSinMovimiento = facturas
    .filter((f) => f.estado === "pendiente" && !f.movimiento_id)
    .sort((a, b) => b.fecha_recepcion.localeCompare(a.fecha_recepcion));

  const { sugerencias } = cruzar(movimientos, facturas);

  return {
    cargosSinFactura,
    sumaSinFactura: Math.round(cargosSinFactura.reduce((s, m) => s + m.importe, 0) * 100) / 100,
    conciliados,
    facturasSinMovimiento,
    sugerencias,
  };
}

// -----------------------------------------------------------------------------
// Reclamación al CLIENTE de la gestoría
// -----------------------------------------------------------------------------

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const euros = (n: number) =>
  `${n.toFixed(2).replace(".", ",")} EUR`;

const fechaLarga = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)} de ${MESES[Number(m) - 1] ?? m}`;
};

/** Envío real de la reclamación. FAIL-CLOSED, como todos los del sistema. */
export const reclamacionSendEnabled = (): boolean =>
  (process.env.GESTORIA_RECLAMACION_SEND_ENABLED || "").toLowerCase() === "true";

/**
 * La plantilla aprobada en Meta para pedir una factura.
 *
 * Hace falta SÍ o SÍ: una reclamación llega semanas después de la última
 * conversación, o sea siempre fuera de la ventana de 24 h de WhatsApp, y ahí
 * Meta solo deja pasar plantillas aprobadas. Un texto libre se rechaza.
 */
export const RECLAMACION_TEMPLATE = process.env.GESTORIA_RECLAMACION_TEMPLATE || "gestoria_falta_factura";
export const RECLAMACION_TEMPLATE_LANG = process.env.GESTORIA_RECLAMACION_TEMPLATE_LANG || "es";

/**
 * Las 5 variables del cuerpo de `gestoria_falta_factura`, EN EL ORDEN DE META:
 *
 *   {{1}} nombre del cliente        {{4}} importe
 *   {{2}} nombre de la gestoría     {{5}} concepto del banco
 *   {{3}} fecha del cargo
 *
 * El orden no es negociable ni se puede deducir: es el que se registró al crear
 * la plantilla. Si algún día se cambia allí, hay que cambiarlo aquí.
 *
 * Ningún parámetro puede ir vacío —Meta rechaza el envío entero— ni llevar
 * saltos de línea o tabuladores, así que se limpian y se recortan.
 */
export function paramsReclamacion(
  cliente: string,
  gestoria: string,
  mov: MovimientoBanco,
): [string, string, string, string, string] {
  const limpio = (t: string, tope = 120) =>
    (t || "").replace(/\s+/g, " ").trim().slice(0, tope) || "—";
  return [
    limpio(cliente, 60),
    limpio(gestoria, 60),
    limpio(fechaLarga(mov.fecha), 30),
    limpio(euros(mov.importe), 30),
    limpio(mov.concepto, 120),
  ];
}

/**
 * El mensaje que se le manda al CLIENTE DE LA GESTORÍA pidiéndole la factura.
 *
 * NUNCA al proveedor que emitió la factura: el sistema no tiene su contacto ni
 * debe tenerlo, y escribir a un tercero en nombre del cliente no es algo que se
 * hace solo.
 *
 * Y NO interpreta nada: dice que falta una factura de tal importe y tal fecha, y
 * se calla. Ni si es deducible, ni plazos, ni obligaciones.
 */
export function textoReclamacion(mov: MovimientoBanco): string {
  const concepto = mov.concepto.trim();
  return (
    `Hola, para cerrar la contabilidad me falta la factura de un pago de ${euros(mov.importe)} ` +
    `del ${fechaLarga(mov.fecha)}${concepto ? `, concepto ${concepto}` : ""}. ` +
    `¿Puedes mandármela por aquí?`
  );
}
