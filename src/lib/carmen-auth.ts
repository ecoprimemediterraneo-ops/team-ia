// El secreto compartido con Retell (`CARMEN_WEBHOOK_SECRET`), por `?secret=` o
// cabecera `x-carmen-secret`. Una sola comprobación para todas las funciones de Carmen.
import { timingSafeEqual } from "node:crypto";

function igual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function carmenAutorizada(req: Request): "ok" | "sin_secreto" | "no" {
  const esperado = process.env.CARMEN_WEBHOOK_SECRET || "";
  if (!esperado) return "sin_secreto";
  const q = new URL(req.url).searchParams.get("secret") || "";
  const h = req.headers.get("x-carmen-secret") || "";
  return (q && igual(q, esperado)) || (h && igual(h, esperado)) ? "ok" : "no";
}
/** Los argumentos de una función de Retell, estén donde estén (args/arguments/raíz). */
export function argsDeRetell(body: Record<string, unknown>): { get: (...k: string[]) => string | undefined; call: Record<string, unknown> } {
  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  const call = obj(body.call) || {};
  const c = [obj(body.args), obj(body.arguments), obj(body.parameters), body].filter(Boolean) as Record<string, unknown>[];
  return {
    call,
    get: (...ks) => { for (const o of c) for (const k of ks) { const v = o[k]; if (v !== undefined && v !== null && String(v).trim()) return String(v).trim(); } return undefined; },
  };
}
