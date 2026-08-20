// Leer un documento que ha entrado en la gestoría.
//
// LO PRIMERO NO ES SACAR DATOS, ES DECIDIR QUÉ ES.
// -----------------------------------------------
// Todo lo que entra por WhatsApp o por correo se trataba como "factura". No lo
// es. Un albarán no lleva IVA y no es documento contable; un ticket lleva IVA
// pero sin el NIF del destinatario, así que **no permite deducir el IVA** y hay
// que pedirle al proveedor la factura completa; un abono resta en vez de sumar.
// Dar por buena una factura que no lo es le mete al gestor un IVA que Hacienda
// le va a quitar, y eso lo descubre meses después.
//
// Por eso la clase va ANTES que cualquier dato en la tarjeta, y ante la duda
// entre dos clases se elige LA QUE MENOS AFIRMA y se dice por qué. Un clic de
// más al gestor es barato; una deducción mal dada, no.
//
// LO QUE ESTA LECTURA NO HACE, Y NO VA A HACER
// --------------------------------------------
// Adivinar de qué cliente de la gestoría es el documento. Eso lo dice el
// remitente o lo pone el gestor a mano, nunca el contenido. Un proveedor sale
// en las facturas de veinte clientes distintos.

import "server-only";
import { anthropic, MODELS } from "./claude";

export type ClaseDocumento =
  | "factura_completa"
  | "ticket"
  | "albaran"
  | "abono"
  | "presupuesto"
  | "otro";

/** Un dato leído. `seguro:false` = la IA no lo ha visto claro; se marca en el panel. */
export type Campo<T> = { valor: T | null; seguro: boolean };

export type LineaIVA = {
  /** 21, 10, 4, 0… */
  tipo: number | null;
  base: number | null;
  cuota: number | null;
};

export type Lectura = {
  clase: ClaseDocumento;
  /** Cuánto se fía la IA de la CLASE, que es lo que más importa acertar. */
  confianza: "alta" | "media" | "baja";
  /** En una frase, por qué esa clase y no otra. Se enseña al gestor. */
  porQue: string;
  emisor: Campo<string>;
  nifEmisor: Campo<string>;
  /** El que decide si un documento con IVA es factura o ticket. */
  nifDestinatario: Campo<string>;
  numero: Campo<string>;
  fecha: Campo<string>;
  lineas: LineaIVA[];
  total: Campo<number>;
  /** Solo en abonos: a qué factura rectifica, si lo dice. */
  rectificaA: Campo<string>;
  /**
   * true = venía como factura pero se ha bajado de clase por no traer el IVA
   * desglosado. Sirve para que la ficha diga POR QUÉ y no parezca un capricho.
   */
  degradadaSinIva?: boolean;
  /** Lo que el gestor tiene que saber antes de contar con este documento. */
  avisos: string[];
  leidoEn: string;
  modelo: string;
  /** Lo que ha costado leerlo. Alimenta el contador de gasto del panel. */
  tokens?: { entrada: number; salida: number };
};

export const ETIQUETA_CLASE: Record<ClaseDocumento, string> = {
  factura_completa: "Factura completa",
  ticket: "Ticket / factura simplificada",
  albaran: "Albarán",
  abono: "Abono / rectificativa",
  presupuesto: "Presupuesto o proforma",
  otro: "Sin clasificar",
};

/**
 * ¿Cuenta como documento contable? Decide si entra en el cruce con el banco.
 *
 * Un albarán o un presupuesto cruzándose con un cargo daría por justificado un
 * pago que no lo está: el gestor vería el mes cuadrado y le faltaría la factura.
 */
export const ES_CONTABLE: Record<ClaseDocumento, boolean> = {
  factura_completa: true,
  ticket: true,
  abono: true,
  albaran: false,
  presupuesto: false,
  otro: false,
};

/** ¿Con este documento se puede deducir el IVA? Solo la factura completa. */
export const DEDUCE_IVA: Record<ClaseDocumento, boolean> = {
  factura_completa: true,
  ticket: false,
  abono: true,
  albaran: false,
  presupuesto: false,
  otro: false,
};

const INSTRUCCIONES = `Eres el ayudante de una gestoría española. Te llega un documento escaneado o fotografiado.

TU PRIMERA DECISIÓN, y la más importante, es QUÉ CLASE de documento es:

- "factura_completa": lleva NIF del EMISOR **Y** NIF del DESTINATARIO (el cliente), número de factura, fecha e IVA DESGLOSADO. Las cuatro cosas. Es la única que permite deducir el IVA.
- "ticket": lleva IVA desglosado y NIF del emisor, pero **NO** lleva NIF del destinatario. Tickets de bar, gasolinera, supermercado. Aunque ponga "FACTURA SIMPLIFICADA", es un ticket.
- "albaran": nota de entrega de mercancía. No lleva IVA ni importe fiscal, o los lleva como "valorado" sin ser documento de cobro.
- "abono": factura rectificativa o nota de abono. Los importes van en negativo o dice "abono"/"rectificativa". Corrige una factura anterior.
- "presupuesto": presupuesto, proforma, pedido u oferta. No es documento contable.
- "otro": cualquier cosa que no encaje limpiamente en las anteriores. Una carta, un extracto, una foto borrosa, un contrato.

REGLA DEL IVA DESGLOSADO (dictada por el gestor, no la saltes):
Un documento SIN IVA desglosado NO ES UNA FACTURA, aunque ponga "factura" en grande.
"Desglosado" significa que se ven POR SEPARADO la base imponible, el tipo de IVA y la cuota de IVA,
y que base + cuota da el total (con un margen de céntimos por redondeo).
- Si solo ves un importe total, sin base ni cuota separadas: NO es "factura_completa".
  Es "ticket" si parece una compra con su importe cobrado, y "albaran" si no parece un documento de cobro.
- No calcules tú la base ni la cuota a partir del total. Si no están escritas en el papel, no están: pon null.

REGLA QUE MANDA SOBRE TODAS: ante la duda entre dos clases, elige **la que menos afirma** y baja la confianza.
El orden de menos a más afirmativo es: otro < presupuesto < albaran < ticket < abono < factura_completa.
Si no ves con seguridad el NIF del destinatario, NO es factura_completa: es ticket.
No fuerces una clasificación. "otro" con confianza alta es una respuesta correcta y útil.

Después saca los datos que veas. Si un dato no está o no lo lees con seguridad, pon null y marca seguro=false. NO inventes ni completes.

Los importes en número, con punto decimal (15.18, no "15,18 €"). Las fechas en formato AAAA-MM-DD.
Si hay varios tipos de IVA, una línea por tipo.

NO intentes adivinar a qué cliente de la gestoría pertenece el documento. No es asunto tuyo.

Responde SOLO con un JSON con esta forma exacta, sin texto alrededor y sin markdown:
{
  "clase": "...",
  "confianza": "alta|media|baja",
  "porQue": "una frase corta explicando por qué esa clase y no otra",
  "emisor": {"valor": "...", "seguro": true},
  "nifEmisor": {"valor": "...", "seguro": true},
  "nifDestinatario": {"valor": null, "seguro": false},
  "numero": {"valor": "...", "seguro": true},
  "fecha": {"valor": "2026-08-19", "seguro": true},
  "lineas": [{"tipo": 10, "base": 15.18, "cuota": 1.52}],
  "total": {"valor": 16.70, "seguro": true},
  "rectificaA": {"valor": null, "seguro": false},
  "avisos": []
}`;

/**
 * ¿El documento trae el IVA DESGLOSADO de verdad?
 *
 * Regla de negocio de José: sin base imponible y cuota de IVA por separado no
 * hay factura, por mucho que el papel diga "FACTURA". Se comprueba AQUÍ y no
 * solo en el prompt porque de esto depende deducir o no deducir el IVA, y una
 * regla fiscal no se deja en manos de lo que el modelo se acuerde de escribir.
 *
 * Se exige base y cuota; el TIPO (21, 10, 4) no se exige porque se deduce de
 * las otras dos y muchas facturas lo imprimen dentro del concepto.
 */
export function tieneDesgloseIva(lineas: LineaIVA[], total: number | null): boolean {
  const utiles = lineas.filter((l) => l.base !== null && l.cuota !== null);
  if (utiles.length === 0) return false;
  if (total === null) return true; // hay desglose aunque no hayamos leído el total
  const suma = utiles.reduce((s, l) => s + (l.base ?? 0) + (l.cuota ?? 0), 0);
  // Tolerancia de céntimos: los redondeos por línea no pueden tumbar una factura buena.
  return Math.abs(suma - total) <= 0.02;
}

function normalizarCampo<T>(x: unknown): Campo<T> {
  if (x && typeof x === "object" && "valor" in x) {
    const c = x as { valor: unknown; seguro?: unknown };
    return { valor: (c.valor ?? null) as T | null, seguro: c.seguro === true };
  }
  // Algunos modelos devuelven el valor pelado. Se acepta, pero sin darlo por
  // seguro: quien no ha dicho que lo esté, no lo está.
  return { valor: (x ?? null) as T | null, seguro: false };
}

const num = (x: unknown): number | null => {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = Number(x.replace(/[^\d,.-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * Los avisos que el gestor tiene que ver SÍ O SÍ, calculados aquí y no pedidos
 * a la IA: son consecuencia de la clase, y una regla fiscal no se delega a un
 * modelo que puede olvidarse de escribirla.
 */
function avisosDeLaClase(l: Omit<Lectura, "avisos" | "leidoEn" | "modelo">, delModelo: string[]): string[] {
  const avisos: string[] = [];

  // Si se ha degradado por falta de IVA desglosado, el motivo de abajo ya lo
  // explica: repetir aquí "no lleva el NIF del destinatario" sería mentirle al
  // gestor sobre por qué este papel no le vale.
  if (l.clase === "ticket" && !l.degradadaSinIva) {
    avisos.push(
      "Esto NO sirve para deducir el IVA: es un ticket, no lleva el NIF del destinatario. Pídele al proveedor la factura completa.",
    );
  }
  if (l.clase === "albaran" && !l.degradadaSinIva) {
    avisos.push("Un albarán no es documento contable. No cuenta como factura ni entra en el cruce con el banco.");
  }
  if (l.clase === "presupuesto") {
    avisos.push("Un presupuesto o proforma no es documento contable. Se guarda, pero no cuenta.");
  }
  if (l.clase === "abono") {
    avisos.push("Es un abono: RESTA en vez de sumar.");
  }
  if (l.clase === "otro") {
    avisos.push("No se ha podido clasificar. Míralo y dile tú qué es.");
  }
  if (l.degradadaSinIva) {
    avisos.push("Sin IVA desglosado: no es factura, no deduce IVA. Pídele al proveedor la factura completa con base y cuota.");
  }
  if (l.confianza === "baja") {
    avisos.push("La lectura no está clara. Comprueba la clase antes de contar con este documento.");
  }
  // El descuadre se calcula, no se pregunta: base + cuota tiene que dar el total.
  const suma = l.lineas.reduce((s, x) => s + (x.base ?? 0) + (x.cuota ?? 0), 0);
  if (l.total.valor !== null && l.lineas.length > 0 && Math.abs(suma - l.total.valor) > 0.02) {
    avisos.push(`Las bases y cuotas suman ${suma.toFixed(2)} y el total dice ${l.total.valor.toFixed(2)}. Revísalo.`);
  }
  for (const a of delModelo) if (typeof a === "string" && a.trim()) avisos.push(a.trim());
  return avisos;
}

/**
 * El modelo que lee. **Haiku**, no Sonnet.
 *
 * Leer una factura no es razonar: los datos están escritos en el papel. Se
 * comprobó campo a campo con los tres documentos de prueba —ticket, albarán y
 * abono— y Haiku acierta la clase, la confianza y todos los campos igual que
 * Sonnet, por una quinta parte del precio de salida. Con cincuenta clientes
 * mandando facturas todo el mes, esa diferencia es el margen de la gestoría.
 */
export const MODELO_LECTURA = MODELS.fast;

export type ResultadoLectura = { ok: true; lectura: Lectura } | { ok: false; error: string };

/**
 * Lee un documento y devuelve qué es y qué pone.
 *
 * Nunca lanza: un fallo de lectura no puede impedir que el documento se guarde.
 * Perder la factura es peor que no saber lo que pone.
 */
export async function leerDocumento(opts: {
  contenido: Buffer;
  mime: string;
  nombre?: string;
  /** Solo para comparar modelos. En producción manda MODELO_LECTURA. */
  modelo?: string;
}): Promise<ResultadoLectura> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "No hay ANTHROPIC_API_KEY: el documento se guarda pero no se lee." };
  }

  const esPdf = opts.mime.includes("pdf") || (opts.nombre || "").toLowerCase().endsWith(".pdf");
  const b64 = opts.contenido.toString("base64");

  // Los tipos que acepta Meta y no acepta la API de visión (heic, por ejemplo)
  // se rechazan aquí con un motivo legible en vez de reventar dentro del SDK.
  const mimeImagen = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!esPdf && !mimeImagen.includes(opts.mime)) {
    return { ok: false, error: `No se puede leer un ${opts.mime}. Conviértelo a JPG o PDF.` };
  }

  const bloque = esPdf
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: b64 } }
    : {
        type: "image" as const,
        source: { type: "base64" as const, media_type: opts.mime as "image/jpeg", data: b64 },
      };

  try {
    const res = await anthropic.messages.create(
      {
        model: opts.modelo ?? MODELO_LECTURA,
        max_tokens: 1500,
        system: INSTRUCCIONES,
        messages: [{ role: "user", content: [bloque, { type: "text", text: "Clasifica y lee este documento." }] }],
      },
      { timeout: 60_000 },
    );

    const texto = res.content
      .filter((b): b is { type: "text"; text: string; citations: never } => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // El modelo a veces envuelve el JSON en ```json. Se recorta al primer { y al
    // último }: es más fiable que pedirle otra vez que no lo haga.
    const desde = texto.indexOf("{");
    const hasta = texto.lastIndexOf("}");
    if (desde < 0 || hasta <= desde) return { ok: false, error: `La lectura no ha devuelto JSON: ${texto.slice(0, 160)}` };

    const j = JSON.parse(texto.slice(desde, hasta + 1)) as Record<string, unknown>;

    const clases: ClaseDocumento[] = ["factura_completa", "ticket", "albaran", "abono", "presupuesto", "otro"];
    let clase = clases.includes(j.clase as ClaseDocumento) ? (j.clase as ClaseDocumento) : "otro";

    const nifDest = normalizarCampo<string>(j.nifDestinatario);
    const lineas: LineaIVA[] = Array.isArray(j.lineas)
      ? (j.lineas as unknown[]).map((l) => {
          const o = (l ?? {}) as Record<string, unknown>;
          return { tipo: num(o.tipo), base: num(o.base), cuota: num(o.cuota) };
        })
      : [];

    // RED DE SEGURIDAD, y no sobra: sin NIF del destinatario no hay factura
    // completa, lo diga el modelo o no. Es la regla que separa deducir el IVA de
    // no deducirlo, y es demasiado cara para dejarla solo en el prompt.
    let porQue = typeof j.porQue === "string" ? j.porQue : "";
    let confianza = (["alta", "media", "baja"] as const).includes(j.confianza as "alta")
      ? (j.confianza as "alta" | "media" | "baja")
      : "media";
    if (clase === "factura_completa" && (!nifDest.valor || !nifDest.seguro)) {
      clase = "ticket";
      porQue = `Se ha bajado a ticket: no se lee con seguridad el NIF del destinatario. ${porQue}`.trim();
      if (confianza === "alta") confianza = "media";
    }

    // SEGUNDA RED: sin IVA desglosado no hay factura, lo diga el modelo o no.
    // Va DESPUÉS de la del NIF porque las dos degradan y esta manda sobre el
    // resultado: un papel sin base ni cuota no es ni siquiera un ticket si
    // encima no parece un cobro.
    const totalLeido = num(normalizarCampo<unknown>(j.total).valor);
    let degradadaSinIva = false;
    if (clase === "factura_completa" && !tieneDesgloseIva(lineas, totalLeido)) {
      // ¿Parece una compra cobrada? Si hay un importe, sí: es un ticket. Si no
      // hay ni importe, es una nota de entrega: albarán.
      clase = totalLeido !== null && totalLeido !== 0 ? "ticket" : "albaran";
      degradadaSinIva = true;
      porQue = `No trae el IVA desglosado (base y cuota por separado), así que no es factura. ${porQue}`.trim();
      if (confianza === "alta") confianza = "media";
    }

    const base: Omit<Lectura, "avisos" | "leidoEn" | "modelo"> = {
      clase,
      confianza,
      porQue,
      emisor: normalizarCampo<string>(j.emisor),
      nifEmisor: normalizarCampo<string>(j.nifEmisor),
      nifDestinatario: nifDest,
      numero: normalizarCampo<string>(j.numero),
      fecha: normalizarCampo<string>(j.fecha),
      lineas,
      total: (() => {
        const c = normalizarCampo<unknown>(j.total);
        return { valor: num(c.valor), seguro: c.seguro };
      })(),
      rectificaA: normalizarCampo<string>(j.rectificaA),
      degradadaSinIva,
    };

    return {
      ok: true,
      lectura: {
        ...base,
        avisos: avisosDeLaClase(base, Array.isArray(j.avisos) ? (j.avisos as string[]) : []),
        leidoEn: new Date().toISOString(),
        modelo: opts.modelo ?? MODELO_LECTURA,
        tokens: { entrada: res.usage.input_tokens, salida: res.usage.output_tokens },
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Los datos que van al registro de la factura a partir de la lectura. */
export function datosDeLectura(l: Lectura): {
  importe: number | null;
  fechaFactura: string | null;
  proveedor: string | null;
} {
  const total = l.total.valor;
  return {
    // Un abono resta: se guarda en negativo para que el cruce con el banco no
    // lo sume como si fuera una compra más.
    importe: total === null ? null : l.clase === "abono" ? -Math.abs(total) : total,
    fechaFactura: l.fecha.valor,
    proveedor: l.emisor.valor,
  };
}
