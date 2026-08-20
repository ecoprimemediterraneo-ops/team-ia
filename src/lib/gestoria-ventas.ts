// Las VENTAS del cliente: sus facturas emitidas.
//
// POR QUÉ ES OTRO CAMINO Y NO EL DE SIEMPRE
// -----------------------------------------
// Las compras llegan de una en una: el cliente hace la foto del ticket y la
// manda. Las ventas no. El cliente emite desde su programa de facturación y lo
// que le pasa a la gestoría es un LISTADO mensual —un Excel o un PDF con todas
// las facturas del mes—. Pedirle que mande sus ventas una a una sería pedirle
// que trabaje el doble para dárnoslo peor.
//
// Y LO QUE SE BUSCA ES LO CONTRARIO
// ---------------------------------
// En compras se busca la factura que falta para un cargo: sin ella el cliente
// pierde el IVA, y eso es dinero suyo. En ventas se busca el INGRESO que no
// tiene factura emitida detrás. Eso ya no es dinero perdido: es una venta sin
// declarar, y eso es un problema con Hacienda. Por eso el ingreso sin factura
// se enseña arriba y en rojo, no en el mismo saco que un ticket de bar.
//
// CÓMO SE LEE EL LISTADO, y por qué no se le pide todo a la IA
// ------------------------------------------------------------
// Un listado de ventas trae doscientas filas de números. Pedirle a un modelo que
// transcriba doscientas filas es caro y es la forma más fácil de que se cuele un
// importe cambiado, que aquí significa una base imponible mal declarada.
//
// Así que se parte en dos: la IA dice QUÉ COLUMNA ES CADA UNA mirando la
// cabecera y tres filas de muestra —eso sí lo hace bien y cuesta cuatro duros—, y
// **el código lee las filas**. Los números no pasan por el modelo. Solo cuando
// el listado viene en PDF, que no tiene columnas que leer, se transcribe entero.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";
import { anthropic, MODELS } from "./claude";

export type EstadoVenta = "pendiente" | "conciliada" | "descartada";

export type FacturaEmitida = {
  id: string;
  tenant_id: string;
  /** El cliente de la gestoría que EMITE la factura. */
  cliente_id: string;
  fecha: string;            // "AAAA-MM-DD"
  numero: string;
  /** A quién se la emitió. Informativo: no se cruza por él. */
  destinatario: string | null;
  base: number | null;
  iva: number | null;
  total: number;
  estado: EstadoVenta;
  movimiento_id: string | null;
  lote_id: string;
  fecha_importacion: string;
  /** De qué fila del listado salió, para poder discutirla. */
  fila?: number;
};

const KEY = (t: string) => `gestoria:ventas:${t}`;
const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "gestoria-ventas.json");

async function leerLocal(tenantId: string): Promise<FacturaEmitida[]> {
  try {
    const all = JSON.parse(await fs.readFile(FILE, "utf-8")) as Record<string, FacturaEmitida[]>;
    return all[tenantId] ?? [];
  } catch { return []; }
}

export async function listarVentas(tenantId: string, clienteId?: string): Promise<FacturaEmitida[]> {
  const todas = supabaseEnabled()
    ? (await kvGet<FacturaEmitida[]>(KEY(tenantId))) ?? []
    : await leerLocal(tenantId);
  const suyas = clienteId ? todas.filter((v) => v.cliente_id === clienteId) : todas;
  return suyas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero));
}

export async function guardarVentas(tenantId: string, lista: FacturaEmitida[]): Promise<void> {
  if (supabaseEnabled()) { await kvSet(KEY(tenantId), lista); return; }
  await fs.mkdir(DATA_DIR, { recursive: true });
  let all: Record<string, FacturaEmitida[]> = {};
  try { all = JSON.parse(await fs.readFile(FILE, "utf-8")); } catch { /* primera vez */ }
  all[tenantId] = lista;
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

// -----------------------------------------------------------------------------
// Números y fechas tal y como los escribe un programa de facturación español
// -----------------------------------------------------------------------------

/** "1.234,56 €" → 1234.56. Devuelve null si no hay número. */
export function numeroEs(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const limpio = v.replace(/[^\d,.\-]/g, "").trim();
  if (!limpio) return null;
  // Si hay coma, la coma es el decimal y el punto es el separador de miles.
  const n = limpio.includes(",")
    ? Number(limpio.replace(/\./g, "").replace(",", "."))
    : Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** "14/08/2026", "2026-08-14" o una fecha de Excel → "AAAA-MM-DD". */
export function fechaEs(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const es = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (es) {
    const a = es[3].length === 2 ? `20${es[3]}` : es[3];
    return `${a}-${es[2].padStart(2, "0")}-${es[1].padStart(2, "0")}`;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Leer el listado
// -----------------------------------------------------------------------------

export type LineaLeida = {
  fecha: string | null;
  numero: string;
  destinatario: string | null;
  base: number | null;
  iva: number | null;
  total: number | null;
  fila: number;
};

export type LecturaListado = {
  lineas: LineaLeida[];
  /** Qué columna se ha usado para cada campo. Se enseña: el gestor tiene que poder discutirlo. */
  columnas: Record<string, string | null>;
  /** Filas que se han saltado y por qué. Nunca se tiran en silencio. */
  descartadas: Array<{ fila: number; motivo: string }>;
  formato: "hoja" | "pdf";
  modelo: string;
  tokens?: { entrada: number; salida: number };
};

export type ResultadoListado = { ok: true; lectura: LecturaListado } | { ok: false; error: string };

const CABECERA = `Eres el ayudante de una gestoría española. Te doy la cabecera y unas filas de muestra de un listado de FACTURAS EMITIDAS que ha mandado un cliente.

Dime qué columna corresponde a cada campo, usando el NOMBRE EXACTO de la cabecera:
- fecha: la fecha de emisión de la factura
- numero: el número de factura
- destinatario: a quién se le emitió (cliente del cliente)
- base: la base imponible
- iva: la cuota de IVA (no el porcentaje: el importe)
- total: el total de la factura

Si una columna no existe, pon null. NO INVENTES nombres de columna: solo valen los que te doy.
Ojo con las trampas: una columna "IVA" puede ser el PORCENTAJE (21) y no la cuota — si ves valores como 21, 10 o 4 en todas las filas, esa columna es el tipo, no la cuota: ponla a null.

Responde SOLO con JSON, sin markdown:
{"fecha":"...","numero":"...","destinatario":null,"base":"...","iva":"...","total":"..."}`;

const PDF = `Eres el ayudante de una gestoría española. Te doy un listado de FACTURAS EMITIDAS en PDF.

Saca UNA LÍNEA POR FACTURA con: fecha (AAAA-MM-DD), numero, destinatario, base, iva (la cuota en euros, no el porcentaje), total.
Los importes en número con punto decimal. Si un dato no está, null.
NO INVENTES filas ni importes. Si no puedes leer una fila con seguridad, no la pongas.

Responde SOLO con JSON, sin markdown:
{"lineas":[{"fecha":"2026-08-14","numero":"2026/001","destinatario":"...","base":100.0,"iva":21.0,"total":121.0}]}`;

/** Convierte una hoja de cálculo en filas de texto. Primera hoja, que es donde está el listado. */
async function filasDeHoja(contenido: Buffer): Promise<string[][]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(contenido as unknown as ArrayBuffer);
  const hoja = wb.worksheets[0];
  if (!hoja) return [];
  const filas: string[][] = [];
  hoja.eachRow({ includeEmpty: false }, (row) => {
    const vals: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, i) => {
      const v = cell.value;
      let s: string;
      if (v == null) s = "";
      else if (v instanceof Date) s = v.toISOString().slice(0, 10);
      else if (typeof v === "object" && "result" in v) s = String((v as { result: unknown }).result ?? "");
      else if (typeof v === "object" && "text" in v) s = String((v as { text: unknown }).text ?? "");
      else s = String(v);
      vals[i - 1] = s.trim();
    });
    filas.push(vals);
  });
  return filas;
}

function filasDeCsv(texto: string): string[][] {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());

  // El separador se decide MIRANDO TODO EL FICHERO, no la primera línea.
  //
  // Antes se miraba solo la primera, y los listados de verdad empiezan con el
  // nombre del negocio y el periodo —líneas sueltas sin ningún separador—, así
  // que salía coma y el fichero entero se partía por los decimales. Los
  // importes acababan troceados ("5.656" y "33") y el mapa de columnas se hacía
  // sobre basura.
  //
  // Punto y coma primero cuando empatan: es lo que exporta cualquier programa
  // español, porque la coma ya la usa el decimal.
  const cuenta = (sep: string) =>
    lineas.reduce((s, l) => s + (l.split(sep).length - 1), 0);
  const sep = cuenta(";") >= cuenta("\t") && cuenta(";") >= cuenta(",") ? ";"
    : cuenta("\t") > cuenta(",") ? "\t" : ",";

  return lineas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")));
}

export async function leerListadoVentas(opts: {
  contenido: Buffer;
  mime: string;
  nombre?: string;
}): Promise<ResultadoListado> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "No hay ANTHROPIC_API_KEY: el listado no se puede leer." };
  }

  const nombre = (opts.nombre || "").toLowerCase();
  const esHoja = nombre.endsWith(".xlsx") || nombre.endsWith(".xlsm") || opts.mime.includes("spreadsheet");
  const esCsv = nombre.endsWith(".csv") || nombre.endsWith(".txt") || opts.mime.includes("csv");
  const esPdf = nombre.endsWith(".pdf") || opts.mime.includes("pdf");

  // --- Hoja de cálculo o CSV: la IA mapea columnas, el código lee las filas ---
  if (esHoja || esCsv) {
    let filas: string[][];
    try {
      filas = esHoja ? await filasDeHoja(opts.contenido) : filasDeCsv(opts.contenido.toString("utf-8"));
    } catch (e) {
      return { ok: false, error: `no se ha podido abrir el fichero: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (filas.length < 2) return { ok: false, error: "el listado no tiene filas" };

    // La cabecera no siempre es la primera fila: los programas meten título y
    // logo arriba. Se busca la primera fila con varias celdas con texto.
    const iCab = filas.findIndex((f) => f.filter((c) => c && c.length > 1).length >= 3);
    if (iCab < 0) return { ok: false, error: "no se ha encontrado la cabecera del listado" };
    const cabecera = filas[iCab].map((c, i) => c || `columna_${i + 1}`);
    const muestra = filas.slice(iCab + 1, iCab + 4);

    const res = await anthropic.messages.create(
      {
        model: MODELS.fast,
        max_tokens: 400,
        system: CABECERA,
        messages: [{
          role: "user",
          content: `CABECERA: ${JSON.stringify(cabecera)}\n\nFILAS DE MUESTRA:\n${muestra.map((f) => JSON.stringify(f)).join("\n")}`,
        }],
      },
      { timeout: 30_000 },
    );
    const t = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const d = t.indexOf("{"), h = t.lastIndexOf("}");
    if (d < 0 || h <= d) return { ok: false, error: `no ha devuelto el mapa de columnas: ${t.slice(0, 160)}` };
    const mapa = JSON.parse(t.slice(d, h + 1)) as Record<string, string | null>;

    const idx = (campo: string): number => {
      const nombreCol = mapa[campo];
      if (!nombreCol) return -1;
      return cabecera.findIndex((c) => c.toLowerCase() === String(nombreCol).toLowerCase());
    };
    const iFecha = idx("fecha"), iNum = idx("numero"), iDest = idx("destinatario");
    const iBase = idx("base"), iIva = idx("iva"), iTotal = idx("total");

    if (iTotal < 0 && iBase < 0) {
      // Se dice QUÉ ha entendido y QUÉ columnas había: sin eso, "no encuentro la
      // columna" no se puede arreglar sin abrir el código.
      return {
        ok: false,
        error: `no se ha encontrado ni la columna de total ni la de base imponible. ` +
          `Cabecera leída: ${JSON.stringify(cabecera)}. Mapa propuesto: ${JSON.stringify(mapa)}`,
      };
    }

    const lineas: LineaLeida[] = [];
    const descartadas: Array<{ fila: number; motivo: string }> = [];

    // Los listados acaban en una fila de totales ("TOTAL MES", "SUMA"). Sus
    // importes son la suma de todo lo de arriba, así que colarla como una
    // factura más metería una venta fantasma de veinte mil euros en el cruce.
    // Se reconoce por lo que le falta: una factura de verdad SIEMPRE lleva
    // número.
    const esFilaDeTotales = (f: string[]): boolean => {
      const primera = (f.find((c) => c && c.trim()) || "").toUpperCase();
      if (/^(TOTAL|TOTALES|SUMA|SUBTOTAL|RESUMEN)/.test(primera)) return true;
      return iNum >= 0 && !(f[iNum] || "").trim();
    };

    for (let i = iCab + 1; i < filas.length; i++) {
      const f = filas[i];

      if (esFilaDeTotales(f)) {
        if (f.some((c) => c)) descartadas.push({ fila: i + 1, motivo: "fila de totales, no es una factura" });
        continue;
      }

      const numero = (iNum >= 0 ? f[iNum] : "")?.trim() || "";
      const base = iBase >= 0 ? numeroEs(f[iBase]) : null;
      const iva = iIva >= 0 ? numeroEs(f[iIva]) : null;
      let total = iTotal >= 0 ? numeroEs(f[iTotal]) : null;
      // Sin total pero con base y cuota, el total se calcula: es aritmética, no
      // adivinar.
      if (total === null && base !== null) total = base + (iva ?? 0);

      if (total === null) {
        // Las filas de totales del listado ("TOTAL MES") no tienen número: se
        // dicen y se dejan fuera, no se tiran en silencio.
        if (f.some((c) => c)) descartadas.push({ fila: i + 1, motivo: "sin importe legible" });
        continue;
      }
      lineas.push({
        fecha: iFecha >= 0 ? fechaEs(f[iFecha]) : null,
        numero: numero || `fila ${i + 1}`,
        destinatario: iDest >= 0 ? (f[iDest] || null) : null,
        base, iva, total, fila: i + 1,
      });
    }

    return {
      ok: true,
      lectura: {
        lineas, descartadas, formato: "hoja",
        columnas: { fecha: mapa.fecha ?? null, numero: mapa.numero ?? null, destinatario: mapa.destinatario ?? null,
                    base: mapa.base ?? null, iva: mapa.iva ?? null, total: mapa.total ?? null },
        modelo: MODELS.fast,
        tokens: { entrada: res.usage.input_tokens, salida: res.usage.output_tokens },
      },
    };
  }

  // --- PDF: no hay columnas que mapear, se transcribe ---
  if (!esPdf) return { ok: false, error: `no se puede leer un ${opts.mime || nombre}. Manda el listado en Excel, CSV o PDF.` };

  const res = await anthropic.messages.create(
    {
      model: MODELS.fast,
      max_tokens: 8000,
      system: PDF,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: opts.contenido.toString("base64") } },
          { type: "text", text: "Saca las líneas de este listado." },
        ],
      }],
    },
    { timeout: 120_000 },
  );
  const t = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  const d = t.indexOf("{"), h = t.lastIndexOf("}");
  if (d < 0 || h <= d) return { ok: false, error: `no ha devuelto JSON: ${t.slice(0, 160)}` };
  const j = JSON.parse(t.slice(d, h + 1)) as { lineas?: unknown[] };

  const lineas: LineaLeida[] = (j.lineas ?? []).map((x, i) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const base = numeroEs(o.base), iva = numeroEs(o.iva);
    let total = numeroEs(o.total);
    if (total === null && base !== null) total = base + (iva ?? 0);
    return {
      fecha: fechaEs(o.fecha),
      numero: String(o.numero ?? `linea ${i + 1}`),
      destinatario: typeof o.destinatario === "string" ? o.destinatario : null,
      base, iva, total, fila: i + 1,
    };
  }).filter((l) => l.total !== null);

  return {
    ok: true,
    lectura: {
      lineas, descartadas: [], formato: "pdf",
      columnas: { fecha: "(pdf)", numero: "(pdf)", destinatario: "(pdf)", base: "(pdf)", iva: "(pdf)", total: "(pdf)" },
      modelo: MODELS.fast,
      tokens: { entrada: res.usage.input_tokens, salida: res.usage.output_tokens },
    },
  };
}

// -----------------------------------------------------------------------------
// Alta en el almacén
// -----------------------------------------------------------------------------

const nuevoId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Guarda las líneas leídas. Una factura ya cargada NO se duplica: la misma
 * pareja de número y fecha del mismo cliente es la misma factura, aunque el
 * gestor vuelva a subir el listado del mes (que lo hace, cuando el cliente le
 * manda una corrección).
 */
export async function importarVentas(opts: {
  tenantId: string;
  clienteId: string;
  lineas: LineaLeida[];
}): Promise<{ creadas: number; repetidas: number; lote: string; ventas: FacturaEmitida[] }> {
  const previas = await listarVentas(opts.tenantId);
  const yaHay = new Set(
    previas.filter((v) => v.cliente_id === opts.clienteId).map((v) => `${v.numero}|${v.fecha}`),
  );
  const lote = nuevoId("lote");
  const ahora = new Date().toISOString();
  const nuevas: FacturaEmitida[] = [];
  let repetidas = 0;

  for (const l of opts.lineas) {
    const clave = `${l.numero}|${l.fecha ?? ""}`;
    if (yaHay.has(clave)) { repetidas++; continue; }
    yaHay.add(clave);
    nuevas.push({
      id: nuevoId("ven"),
      tenant_id: opts.tenantId,
      cliente_id: opts.clienteId,
      fecha: l.fecha ?? ahora.slice(0, 10),
      numero: l.numero,
      destinatario: l.destinatario,
      base: l.base,
      iva: l.iva,
      total: l.total ?? 0,
      estado: "pendiente",
      movimiento_id: null,
      lote_id: lote,
      fecha_importacion: ahora,
      fila: l.fila,
    });
  }

  await guardarVentas(opts.tenantId, [...previas, ...nuevas]);
  return { creadas: nuevas.length, repetidas, lote, ventas: nuevas };
}
