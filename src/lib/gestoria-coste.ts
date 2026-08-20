// Lo que llevamos gastado leyendo documentos.
//
// POR QUÉ: cada documento que entra es una llamada a un modelo. Con cincuenta
// clientes mandando facturas todo el mes eso es dinero real por gestoría, y sin
// verlo no hay forma de saber si el precio de 149 al mes aguanta. Se cuenta lo
// que se gasta, no lo que se estima.
//
// Los precios son los de la API pública, por millón de tokens. Están aquí y no
// en el código de la lectura porque cambian por su cuenta y con el tiempo, y
// porque el día que se cambie de modelo hay que tocar UN sitio.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";

/** Dólares por millón de tokens. */
export const PRECIOS: Record<string, { entrada: number; salida: number }> = {
  "claude-haiku-4-5-20251001": { entrada: 1, salida: 5 },
  "claude-haiku-4-5": { entrada: 1, salida: 5 },
  "claude-sonnet-4-5": { entrada: 3, salida: 15 },
};

export type ConsumoLecturas = {
  documentos: number;
  tokens_entrada: number;
  tokens_salida: number;
  /** Por modelo, para ver el efecto de un cambio de modelo sin perder el histórico. */
  porModelo: Record<string, { documentos: number; entrada: number; salida: number }>;
  desde: string;
  ultima?: string;
};

const CLAVE = (t: string) => `gestoria:coste-lecturas:${t}`;
const FICHERO = path.join(process.cwd(), "data", "gestoria-coste.json");

const VACIO = (): ConsumoLecturas => ({
  documentos: 0, tokens_entrada: 0, tokens_salida: 0, porModelo: {}, desde: new Date().toISOString(),
});

async function leer(tenantId: string): Promise<ConsumoLecturas> {
  if (supabaseEnabled()) return (await kvGet<ConsumoLecturas>(CLAVE(tenantId))) ?? VACIO();
  try {
    const todo = JSON.parse(await fs.readFile(FICHERO, "utf-8")) as Record<string, ConsumoLecturas>;
    return todo[tenantId] ?? VACIO();
  } catch { return VACIO(); }
}

async function guardar(tenantId: string, c: ConsumoLecturas): Promise<void> {
  if (supabaseEnabled()) { await kvSet(CLAVE(tenantId), c); return; }
  await fs.mkdir(path.dirname(FICHERO), { recursive: true });
  let todo: Record<string, ConsumoLecturas> = {};
  try { todo = JSON.parse(await fs.readFile(FICHERO, "utf-8")); } catch { /* primera vez */ }
  todo[tenantId] = c;
  await fs.writeFile(FICHERO, JSON.stringify(todo, null, 2));
}

/** Suma una lectura. No lanza: contar el gasto no puede tumbar una factura. */
export async function anotarLectura(opts: {
  tenantId: string; modelo: string; entrada: number; salida: number;
}): Promise<void> {
  try {
    const c = await leer(opts.tenantId);
    const m = c.porModelo[opts.modelo] ?? { documentos: 0, entrada: 0, salida: 0 };
    await guardar(opts.tenantId, {
      ...c,
      documentos: c.documentos + 1,
      tokens_entrada: c.tokens_entrada + opts.entrada,
      tokens_salida: c.tokens_salida + opts.salida,
      porModelo: {
        ...c.porModelo,
        [opts.modelo]: {
          documentos: m.documentos + 1,
          entrada: m.entrada + opts.entrada,
          salida: m.salida + opts.salida,
        },
      },
      ultima: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[gestoria-coste] no se ha podido anotar:", e);
  }
}

export function dolares(modelo: string, entrada: number, salida: number): number {
  const p = PRECIOS[modelo];
  // Un modelo sin precio en la tabla cuenta como 0 y se dice en el panel, en vez
  // de inventarse una cifra que parecería real.
  if (!p) return 0;
  return (entrada / 1_000_000) * p.entrada + (salida / 1_000_000) * p.salida;
}

export type ResumenCoste = {
  documentos: number;
  dolares: number;
  porDocumento: number;
  desde: string;
  ultima?: string;
  detalle: Array<{ modelo: string; documentos: number; dolares: number; conPrecio: boolean }>;
};

export async function resumenCoste(tenantId: string): Promise<ResumenCoste> {
  const c = await leer(tenantId);
  const detalle = Object.entries(c.porModelo).map(([modelo, m]) => ({
    modelo,
    documentos: m.documentos,
    dolares: dolares(modelo, m.entrada, m.salida),
    conPrecio: !!PRECIOS[modelo],
  }));
  const total = detalle.reduce((s, d) => s + d.dolares, 0);
  return {
    documentos: c.documentos,
    dolares: total,
    porDocumento: c.documentos ? total / c.documentos : 0,
    desde: c.desde,
    ultima: c.ultima,
    detalle,
  };
}
