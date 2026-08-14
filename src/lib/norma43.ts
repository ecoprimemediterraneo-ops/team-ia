// =============================================================================
// NORMA 43 — el cuaderno del extracto bancario español.
// =============================================================================
//
// Formato estándar del sector: el mismo fichero sirve para cualquier banco
// español, así que con este parser entran todos sin caso particular por entidad.
// Extensiones habituales: .csb, .n43, .txt.
//
// Estructura, en lo que aquí importa:
//   11  → cabecera de cuenta        (se ignora)
//   22  → MOVIMIENTO                 (lo que se lee)
//   23  → concepto ampliado del movimiento anterior. Los "2301" traen el texto.
//   33  → totales de cuenta          (se ignora)
//   88  → fin de fichero             (se ignora)
//
// DOS DETALLES QUE PARECEN MENORES Y NO LO SON:
//
//   · Encoding LATIN-1, no UTF-8. Los bancos siguen mandando ISO-8859-1 y si se
//     lee como UTF-8 los conceptos salen con caracteres rotos justo donde hay
//     eñes y acentos, que en un concepto español es casi siempre.
//   · El importe viene como ENTERO en céntimos. Dividir entre 100 al final, no
//     antes: hacerlo con decimales por el camino introduce error de coma
//     flotante en una cifra contable.
//
// Los índices de campo están VERIFICADOS sobre un fichero real y son base 0:
// fecha en [10,16) como AAMMDD, signo en [27,28) ("1" cargo, "2" abono) e
// importe en [28,42).

import "server-only";

export type MovimientoN43 = {
  /** "YYYY-MM-DD" */
  fecha: string;
  signo: "cargo" | "abono";
  /** En euros, ya dividido entre 100. Siempre positivo. */
  importe: number;
  concepto: string;
  referencia: string;
};

export type ResultadoN43 = {
  movimientos: MovimientoN43[];
  /** Control para enseñar al terminar: si esto no cuadra, el fichero no era. */
  control: {
    total: number;
    desde: string | null;
    hasta: string | null;
    cargos: number;
    sumaCargos: number;
    abonos: number;
    sumaAbonos: number;
    lineasIgnoradas: number;
  };
};

/** AAMMDD → "YYYY-MM-DD". El siglo se resuelve con la ventana habitual. */
function fechaN43(aammdd: string): string | null {
  if (!/^\d{6}$/.test(aammdd)) return null;
  const aa = Number(aammdd.slice(0, 2));
  const mm = aammdd.slice(2, 4);
  const dd = aammdd.slice(4, 6);
  // Un extracto bancario no es de 1970: dos dígitos bajos son de este siglo.
  const anio = aa <= 79 ? 2000 + aa : 1900 + aa;
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  return `${anio}-${mm}-${dd}`;
}

/**
 * Parsea el contenido de un fichero Norma 43.
 *
 * Recibe el BUFFER, no una cadena, porque el decodificado latin-1 es parte del
 * trabajo: si quien llama lo convierte antes a texto, ya lo ha roto.
 */
export function parseNorma43(buffer: Buffer): ResultadoN43 {
  // latin1 es exactamente ISO-8859-1, que es lo que mandan los bancos.
  const texto = buffer.toString("latin1");
  const lineas = texto.split(/\r\n|\r|\n/);

  const movimientos: MovimientoN43[] = [];
  let ignoradas = 0;

  for (const linea of lineas) {
    if (!linea.trim()) continue;

    // Concepto ampliado: se pega al ÚLTIMO movimiento leído.
    if (linea.startsWith("2301")) {
      const ultimo = movimientos[movimientos.length - 1];
      if (ultimo) {
        const texto23 = linea.slice(4).trim().replace(/\s+/g, " ");
        ultimo.concepto = `${ultimo.concepto} ${texto23}`.trim();
      }
      continue;
    }

    // Movimiento. La longitud mínima evita tragarse una línea "22" truncada.
    if (linea.startsWith("22") && linea.length > 60) {
      const fecha = fechaN43(linea.slice(10, 16));
      const signoRaw = linea.slice(27, 28);
      const importeRaw = linea.slice(28, 42).trim();
      const centimos = Number(importeRaw);

      if (!fecha || !Number.isFinite(centimos)) {
        ignoradas++;
        continue;
      }

      movimientos.push({
        fecha,
        signo: signoRaw === "1" ? "cargo" : "abono",
        // El entero está en céntimos: la división va AQUÍ, una sola vez.
        importe: Math.round(centimos) / 100,
        concepto: "",
        // Referencia del propio registro, útil para casar y para el gestor.
        referencia: linea.slice(42, 52).trim(),
      });
      continue;
    }

    // 11 / 33 / 88 y cualquier otra cosa: cabeceras y totales.
    ignoradas++;
  }

  const fechas = movimientos.map((m) => m.fecha).sort();
  const cargos = movimientos.filter((m) => m.signo === "cargo");
  const abonos = movimientos.filter((m) => m.signo === "abono");
  const suma = (l: MovimientoN43[]) => Math.round(l.reduce((s, m) => s + m.importe, 0) * 100) / 100;

  return {
    movimientos,
    control: {
      total: movimientos.length,
      desde: fechas[0] ?? null,
      hasta: fechas[fechas.length - 1] ?? null,
      cargos: cargos.length,
      sumaCargos: suma(cargos),
      abonos: abonos.length,
      sumaAbonos: suma(abonos),
      lineasIgnoradas: ignoradas,
    },
  };
}

/**
 * Huella de un movimiento para detectar duplicados entre importaciones.
 *
 * Fecha + importe + concepto. OJO: la huella NO identifica un apunte, identifica
 * una CLASE de apunte, y hay que contarlas.
 *
 * Se dio por hecho que dos cargos idénticos el mismo día eran el mismo apunte
 * reimportado, y no lo son: en el extracto real de un cliente había tres compras
 * de 88,92 € en la misma frutería el mismo día, dos de 40,00 € en la misma
 * gasolinera, y dos comisiones iguales. Con la huella a secas se tiraban 5
 * cargos legítimos (253,74 €) en la PRIMERA importación de un fichero limpio:
 * el banco los había cobrado y en el panel no existían, así que ni se conciliaban
 * ni se reclamaban. Quien importa debe comparar CUÁNTAS veces aparece cada
 * huella, no si aparece. Ver `contarPorHuella`.
 */
export const huellaMovimiento = (m: { fecha: string; importe: number; concepto: string }): string =>
  `${m.fecha}|${m.importe.toFixed(2)}|${m.concepto.trim().toUpperCase().replace(/\s+/g, " ")}`;

/** Cuántas veces aparece cada huella en una lista. La base del descarte. */
export function contarPorHuella(
  movs: Array<{ fecha: string; importe: number; concepto: string }>,
): Map<string, number> {
  const c = new Map<string, number>();
  for (const m of movs) {
    const k = huellaMovimiento(m);
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  return c;
}
