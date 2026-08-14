// ¿Este cargo lleva factura de proveedor, o no la lleva?
//
// Es la pregunta que reparte la pantalla de conciliación en dos mitades: lo que
// hay que pedirle al cliente y lo que no se le puede pedir por más que falte.
// Una multa de tráfico no tiene factura. Una nómina tampoco. Perseguirlas es
// trabajo tirado, y peor todavía: escribirle al cliente pidiéndole la factura de
// su propia nómina hace quedar mal a la gestoría.
//
// LO QUE ESTE MÓDULO NO HACE: esconder. Antes esto era un filtro que quitaba
// cargos de la lista, y esconder un cargo es peor que enseñarlo — el gestor
// tiene que ver la multa de 534 € aunque no pueda pedir factura de ella. Aquí
// solo se decide EN QUÉ BLOQUE se enseña. Todos se enseñan.
//
// CÓMO SE DECIDE, por orden y sin trampa:
//   1. Lo que el gestor haya movido a mano manda siempre. Se resuelve fuera.
//   2. Señales de que SÍ hay factura (un "PAGO FAC", un suministro, un taller).
//      Ganan sobre todo lo demás: en el extracto real hay pagos a proveedores
//      hechos por transferencia interna, y "TRANSF. INTERNA" a secas los habría
//      mandado al saco de los traspasos.
//   3. Las listas de abajo, que son cortas a propósito.
//   4. Ante CUALQUIER duda, al bloque de trabajo, que es el que se revisa.
//
// Un cargo mal puesto en "no lleva factura" es una factura que nadie pide y que
// no aparece en ningún sitio. Un cargo de más en el bloque de trabajo solo
// cuesta un vistazo. Por eso el reparto es asimétrico a conciencia.
//
// Los literales están tal como los escribe el banco, TRUNCADOS A 20 CARACTERES
// incluidos ("COMISION TRANSFERENC", "S/O/TRANF SEPA NOMIN"). No es un descuido:
// es lo que llega en el fichero.

import "server-only";

/**
 * Los ÚNICOS grupos que no llevan factura mire quien lo mire.
 *
 * Se han caído de aquí los grupos que en realidad describían una FORMA DE PAGAR
 * y no un tipo de gasto: transferencias internas, traspasos, remesas, pagarés,
 * cheques, confirming, factoring, anticipos de facturas. Motivo, y es serio: en
 * el extracto real de ECOPRIME, 13 de 14 cargos con literal de transferencia
 * interna eran pagos a proveedor, y solo se libraron de esconderse porque ese
 * banco escribe "PAGO FAC" en el concepto. Eso es una costumbre de un banco
 * concreto, no algo con lo que se pueda contar: con otro extracto, esas 13
 * facturas habrían desaparecido de la lista de lo que hay que pedir. Un pagaré
 * paga una factura; una nómina no. Solo lo segundo va aquí.
 */
export type GrupoSinFactura =
  | "hacienda" | "tasas" | "multas" | "nomina" | "seg_social"
  | "banco" | "traspaso";

export const ETIQUETA_GRUPO: Record<GrupoSinFactura, string> = {
  hacienda: "Pagos a Hacienda",
  tasas: "Tasas y ayuntamiento",
  multas: "Multas y sanciones",
  nomina: "Nóminas y personal",
  seg_social: "Cuotas de la Seguridad Social",
  banco: "Comisiones y gastos del banco",
  traspaso: "Traspasos entre cuentas propias",
};

/** Mayúsculas, sin tildes y sin signos: como si lo leyera cualquiera. */
export function normalizar(t: string): string {
  return (t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

// -----------------------------------------------------------------------------
// Lo que SÍ lleva factura. Se mira lo primero y gana.
// -----------------------------------------------------------------------------
//
// Un pago a proveedor puede salir por cualquier vía —transferencia interna, TPV,
// recibo domiciliado— y el concepto lo delata. También van aquí los suministros,
// los seguros normales y el software, aunque lo cobre una empresa extranjera.

const SI_LLEVA_FACTURA = [
  // El concepto dice que paga una factura.
  "PAGO FAC", "PAGO FACTURA", "FACTURA", "FAC N", "S FACTURA", "N FACTURA", "FRA",
  // Suministros y servicios corrientes.
  "RCBO TELEFONO", "TELEFONO", "IBERDROLA", "ENDESA", "NATURGY", "REPSOL", "CEPSA",
  "IGNIS", "LUZ", "AGUA", "EMASA", "HIDRALIA", "ACOSOL", "GAS", "FIBRA", "MOVISTAR",
  "VODAFONE", "ORANGE", "JAZZTEL", "DIGI", "PEPEPHONE",
  // Software y suscripciones, vengan en el idioma que vengan.
  "GOOGLE", "WORKSPACE", "ANTHROPIC", "OPENAI", "MICROSOFT", "ADOBE", "DROPBOX",
  "AMAZON", "AWS", "FACTURAONE", "HOLDED", "SAGE", "A3", "CANVA", "NOTION",
  "SLACK", "ZOOM", "APPLE", "SPOTIFY", "GITHUB", "VERCEL", "HOSTINGER", "IONOS",
  // Servicios profesionales y del día a día del negocio.
  "PROSEGUR", "SEGURIDAD PRIVADA", "ALQUILER", "ARRENDAMIENTO", "RENTING",
  "GESTORIA", "ASESORIA", "NOTARIA", "NOTARIO", "REGISTRO MERCANTIL", "REGISTRADORES",
  "ABOGADO", "PROCURADOR", "TALLER", "TALLERES", "ITV", "NEUMATICOS", "CARBU",
  "GASOLINERA", "COMBUSTIBLE", "MENSAJERIA", "TRANSPORTE", "CORREOS EXPRESS",
  "SEUR", "MRW", "GLS", "DHL", "PUBLICIDAD", "IMPRENTA", "ROTULOS", "LIMPIEZA",
  "MANTENIMIENTO ASCENS", "EXTINTORES", "PREVENCION",
];

// -----------------------------------------------------------------------------
// Lo que NO lleva factura de proveedor
// -----------------------------------------------------------------------------

const LISTAS: Array<[GrupoSinFactura, string[]]> = [
  ["hacienda", [
    "IMPUESTOS HACIENDA", "IMP VIA EJECUTIVA", "AEAT", "A E A T", "AGENCIA TRIBUTARIA",
    "HACIENDA", "TRIBUTARIA", "HACIENDA AUTONOMICA", "RECAUDACION", "APREMIO",
    "RECARGO", "EMBARGO", "DILIGENCIA DE EMBARGO", "IVA", "IRPF", "RETENCION",
    "PLUSVALIA",
  ]],
  ["tasas", [
    "TASA", "TASAS", "IBI", "IAE", "BASURA", "VADO", "IMPUESTO CIRCULACION",
    "AYUNTAMIENTO", "DIPUTACION", "JUNTA DE ANDALUCIA", "JUNTA ANDALUC",
  ]],
  ["multas", ["MULTA", "SANCION", "DGT", "TRAFICO", "JUZGADO"]],
  ["nomina", [
    "NOMINA", "NOMINAS", "S O TRANF SEPA NOMIN", "TRANF SEPA NOMIN", "PAGO NOMINAS",
    "FINIQUITO", "INDEMNIZACION", "ANTICIPO NOMINA",
  ]],
  ["seg_social", [
    "CUOTAS SEG SOCIALES", "SEGURIDAD SOCIAL", "SEG SOCIAL", "TGSS",
    "TESORERIA GENERAL", "RETA", "AUTONOMOS",
  ]],
  ["banco", [
    "COMISION", "COMISIONES", "COMISION TRANSFERENC", "GASTOS ADMINISTRACION",
    "GASTOS CORREO", "MANTENIMIENTO CUENTA", "INTERESES", "INTERES DEUDOR",
    "DESCUBIERTO", "EXCEDIDO", "LIQUIDACION CUENTA", "REDONDEO",
    "RECLAMACION POSICION DEUDORA", "RECLAMACION POSICION",
  ]],
  // Traspaso SOLO cuando el destino es una cuenta del propio cliente. Ahí no hay
  // duda posible. Un "TRASPASO" a secas, no: puede estar pagando a cualquiera.
  ["traspaso", ["A MI CUENTA", "ENTRE CUENTAS PROPIAS", "A MIS CUENTAS", "CUENTA PROPIA"]],
];

/** Modelos de Hacienda que se reconocen sueltos, sin la palabra "MODELO". */
const MODELOS = ["111", "115", "123", "130", "131", "180", "190", "200", "202", "216", "303", "347", "349", "368", "390", "720"];

/**
 * ¿Aparece el literal? Se prueba entero y también recortado a 20 caracteres,
 * que es como llega del banco ("COMISION TRANSFERENCIA" → "COMISION TRANSFERENC").
 */
function aparece(concepto: string, literal: string): boolean {
  const l = normalizar(literal);
  if (!l) return false;
  if (concepto.includes(l)) return true;
  const cortado = l.slice(0, 20).trim();
  return cortado.length >= 6 && concepto.includes(cortado);
}

/** Palabra suelta, no trozo de otra: "TASA" no puede casar dentro de "TASACION". */
const palabraSuelta = (concepto: string, p: string) =>
  new RegExp(`(^| )${normalizar(p)}( |$)`).test(concepto);

/**
 * En qué grupo del bloque "no lleva factura" cae este cargo, o null si sí la
 * lleva (o si no hay forma de saberlo, que para el caso es lo mismo: se revisa).
 */
export function clasificarSinFactura(conceptoCrudo: string): GrupoSinFactura | null {
  const c = normalizar(conceptoCrudo);
  if (!c) return null;

  // 1. Señales de factura: ganan sobre todo lo demás.
  //
  // Las de una sola palabra se exigen sueltas. Buscarlas como trozo dejaría
  // "LUZ" dentro de "ANDALUZA" y "GAS" dentro de "GASTOS", y de ahí a dar por
  // bueno un cargo que no lo es hay un paso.
  for (const s of SI_LLEVA_FACTURA) {
    if (s.trim().includes(" ") ? aparece(c, s) : palabraSuelta(c, s)) return null;
  }

  // 2. Modelos de Hacienda, con o sin la palabra delante.
  if (/(^| )MODELO \d{3}( |$)/.test(c)) return "hacienda";
  for (const m of MODELOS) if (palabraSuelta(c, m)) return "hacienda";

  // 3. Las listas. El orden importa: lo más específico primero.
  for (const [grupo, literales] of LISTAS) {
    for (const l of literales) {
      const multipalabra = l.trim().includes(" ");
      if (multipalabra ? aparece(c, l) : palabraSuelta(c, l)) return grupo;
    }
  }

  // 4. Ante la duda, al bloque que se revisa.
  return null;
}
