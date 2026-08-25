// Traerse los clientes de la gestoría desde una hoja de cálculo.
//
// POR QUÉ HACE FALTA
// ------------------
// Jose tiene más de cien clientes en Bilky. Hasta ahora la única forma de
// meterlos era uno a uno, a mano, en la ficha: cien NIF, cien teléfonos, cien
// correos. Nadie hace eso, así que en la práctica las fichas se quedaban vacías
// — y sin NIF las facturas no se colocan solas, que es media razón de ser del
// módulo.
//
// NO SE ASUME NINGÚN FORMATO. Cada programa exporta como le da la gana, así que
// se lee la primera fila como cabecera, se adivina qué es cada columna por su
// nombre, y el gestor corrige lo que haga falta antes de guardar.
//
// LAS DOS REGLAS QUE NO SE SALTAN
// -------------------------------
//   1. NADA SE GUARDA SIN VISTA PREVIA. Primero se dice qué va a pasar —cuántos
//      nuevos, cuántos actualizados, cuántos se saltan y por qué— y el gestor
//      confirma. Una importación que escribe a ciegas sobre cien fichas es
//      exactamente el tipo de cosa que no se puede deshacer.
//   2. AL ACTUALIZAR SE FUSIONA, NUNCA SE PISA. Una columna vacía en el Excel no
//      significa "borra lo que tengas": significa que ese dato no venía. Ya
//      pasó una vez —guardar solo los modelos le borró el NIF a un cliente— y
//      no vuelve a pasar.

import "server-only";
import { normalizarNif, soloDigitos, normalizarEmail, comprobarNif } from "./gestoria-identidad";

/** Lo que sabemos guardar de un cliente. Lo demás del fichero se ignora. */
export type CampoCliente = "nombre" | "nif" | "telefono" | "email";

export const ETIQUETA_CAMPO: Record<CampoCliente, string> = {
  nombre: "Nombre del cliente",
  nif: "NIF o DNI",
  telefono: "Teléfono(s)",
  email: "Correo(s)",
};

/**
 * Cómo se adivina qué es cada columna.
 *
 * Por el nombre de la cabecera, sin acentos y en minúscula. Es una lista corta a
 * propósito: adivinar de más es peor que no adivinar — el gestor ve la columna
 * emparejada con algo raro, se fía, y mete teléfonos en el campo del NIF.
 */
const PISTAS: Record<CampoCliente, string[]> = {
  nombre: ["nombre", "cliente", "razonsocial", "razon", "empresa", "denominacion", "titular", "apellidos"],
  nif: ["nif", "cif", "dni", "nifcif", "documento", "identificacion", "vat"],
  telefono: ["telefono", "tlf", "tfno", "movil", "celular", "phone", "contacto"],
  email: ["email", "correo", "mail", "ecorreo", "correoelectronico"],
};

const limpiar = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/** Empareja cada columna con un campo, o con nada. Se puede cambiar después. */
export function adivinarMapa(cabecera: string[]): Array<CampoCliente | null> {
  return cabecera.map((col) => {
    const c = limpiar(col);
    if (!c) return null;
    for (const campo of ["nif", "email", "telefono", "nombre"] as CampoCliente[]) {
      // El orden importa: "nif" antes que "nombre" para que "nifCliente" no caiga
      // en nombre por contener "cliente".
      if (PISTAS[campo].some((p) => c === p || c.includes(p))) return campo;
    }
    return null;
  });
}

// -----------------------------------------------------------------------------
// Leer el fichero
// -----------------------------------------------------------------------------

/** La hoja en filas de texto. Primera hoja: es donde está el listado. */
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
  // El separador se decide mirando TODO el fichero, no la primera línea: con
  // decimales por coma, mirar solo la cabecera parte el fichero entero mal.
  const cuenta = (sep: string) => lineas.reduce((s, l) => s + (l.split(sep).length - 1), 0);
  const sep =
    cuenta(";") >= cuenta("\t") && cuenta(";") >= cuenta(",") ? ";"
    : cuenta("\t") > cuenta(",") ? "\t" : ",";
  return lineas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")));
}

export async function leerFichero(opts: { contenido: Buffer; nombre: string }): Promise<string[][]> {
  const esCsv = /\.(csv|txt|tsv)$/i.test(opts.nombre);
  return esCsv ? filasDeCsv(opts.contenido.toString("utf-8")) : filasDeHoja(opts.contenido);
}

// -----------------------------------------------------------------------------
// Normalizar
// -----------------------------------------------------------------------------

/**
 * Un teléfono español en el formato con el que se compara: 34XXXXXXXXX.
 *
 * Sin esto se crean duplicados a la primera: "+34 656 98 93 73", "656989373" y
 * "0034656989373" son el mismo número y tres claves distintas.
 */
export function normalizarTelefono(v: string): string | null {
  let d = soloDigitos(v);
  if (!d) return null;
  if (d.startsWith("0034")) d = d.slice(4);
  else if (d.startsWith("34") && d.length === 11) d = d.slice(2);
  // Nueve dígitos que empiezan por 6, 7, 8 o 9: un número español.
  if (d.length === 9 && /^[6789]/.test(d)) return `34${d}`;
  if (d.length === 11 && d.startsWith("34")) return d;
  // Otra cosa: se devuelve tal cual en dígitos. No se descarta —puede ser
  // extranjero— pero tampoco se inventa un prefijo.
  return d.length >= 6 ? d : null;
}

/** Varios valores en una celda: "a, b; c". Se parten y se limpian. */
const partir = (v: string): string[] =>
  (v || "").split(/[,;/|]+/).map((x) => x.trim()).filter(Boolean);

// -----------------------------------------------------------------------------
// La vista previa
// -----------------------------------------------------------------------------

export type FilaLeida = {
  /** Número de fila en el fichero, contando la cabecera. Para poder buscarla. */
  fila: number;
  nombre: string;
  nif: string;
  nifNormalizado: string;
  telefonos: string[];
  emails: string[];
};

export type Saltada = { fila: number; motivo: string; datos: string };

export type Plan = {
  /** Se van a crear. */
  nuevos: FilaLeida[];
  /** Ya existen por NIF: se FUSIONAN, no se pisan. */
  actualizar: Array<FilaLeida & { clienteId: string; clienteNombre: string }>;
  saltadas: Saltada[];
  /** Aviso de formato, pero no impide importar. */
  avisos: string[];
};

export type ClienteExistente = {
  id: string;
  nombre: string;
  nif?: string;
  telefonos?: string[];
  emails?: string[];
};

/**
 * Qué pasaría si se importara. NO toca nada.
 *
 * `mapa[i]` dice qué campo es la columna i, o `null` si se ignora.
 */
export function planificar(
  filas: string[][],
  mapa: Array<CampoCliente | null>,
  existentes: ClienteExistente[],
): Plan {
  const plan: Plan = { nuevos: [], actualizar: [], saltadas: [], avisos: [] };
  if (filas.length < 2) {
    plan.saltadas.push({ fila: 0, motivo: "El fichero no tiene filas debajo de la cabecera.", datos: "" });
    return plan;
  }

  const porNif = new Map(existentes.filter((c) => c.nif).map((c) => [normalizarNif(c.nif), c]));
  // Para avisar de NIF repetidos DENTRO del propio fichero.
  const vistosEnFichero = new Map<string, number>();

  const cols = (fila: string[], campo: CampoCliente): string[] => {
    const out: string[] = [];
    mapa.forEach((m, i) => {
      if (m === campo && fila[i]) out.push(fila[i]);
    });
    return out;
  };

  for (let f = 1; f < filas.length; f++) {
    const fila = filas[f];
    const numero = f + 1; // en la hoja, la cabecera es la 1
    const crudo = fila.filter(Boolean).join(" · ").slice(0, 120);

    const nombre = cols(fila, "nombre").join(" ").trim();
    const nifCrudo = cols(fila, "nif")[0]?.trim() ?? "";
    const nif = normalizarNif(nifCrudo);
    const telefonos = [...new Set(cols(fila, "telefono").flatMap(partir).map(normalizarTelefono).filter((x): x is string => !!x))];
    const emails = [...new Set(cols(fila, "email").flatMap(partir).map(normalizarEmail).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];

    // SIN NOMBRE NO HAY CLIENTE. Es lo único de verdad imprescindible: un
    // cliente sin nombre no se puede ni enseñar en una lista.
    if (!nombre) {
      plan.saltadas.push({ fila: numero, motivo: "Sin nombre", datos: crudo });
      continue;
    }
    // Y sin teléfono no hay id: la clave de un cliente en todo el módulo es su
    // teléfono en dígitos. Sin él no se puede dar de alta.
    if (!telefonos.length && !porNif.has(nif)) {
      plan.saltadas.push({
        fila: numero,
        motivo: "Sin teléfono: hace falta al menos uno para dar de alta al cliente",
        datos: crudo,
      });
      continue;
    }

    if (nif) {
      const antes = vistosEnFichero.get(nif);
      if (antes) {
        // DOS FILAS CON EL MISMO NIF. No se meten las dos ni se elige una: se
        // dice y se salta la segunda. Elegir en silencio es cómo se pierde un
        // cliente sin que nadie se entere.
        plan.saltadas.push({
          fila: numero,
          motivo: `NIF repetido en el fichero: ya sale en la fila ${antes}`,
          datos: crudo,
        });
        continue;
      }
      vistosEnFichero.set(nif, numero);

      const chequeo = comprobarNif(nifCrudo);
      if (!chequeo.valido && chequeo.aviso) {
        plan.avisos.push(`Fila ${numero} (${nombre}): ${chequeo.aviso}`);
      }
    }

    const leida: FilaLeida = { fila: numero, nombre, nif: nifCrudo, nifNormalizado: nif, telefonos, emails };

    const yaEsta = nif ? porNif.get(nif) : undefined;
    if (yaEsta) {
      plan.actualizar.push({ ...leida, clienteId: yaEsta.id, clienteNombre: yaEsta.nombre });
    } else {
      plan.nuevos.push(leida);
    }
  }

  return plan;
}

/** Las filas saltadas en CSV, para corregirlas y volver a subirlas. */
export function saltadasComoCsv(saltadas: Saltada[]): string {
  const cab = "fila;motivo;datos";
  const cuerpo = saltadas.map((s) => `${s.fila};"${s.motivo.replace(/"/g, "'")}";"${s.datos.replace(/"/g, "'")}"`);
  return [cab, ...cuerpo].join("\n");
}
