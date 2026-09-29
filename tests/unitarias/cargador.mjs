// Cargador para ejecutar el código REAL de `src/` con Node, sin Next:
// `server-only` vacío, alias `@/` y extensiones `.ts`.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const SRC = fileURLToPath(new URL("../../src", import.meta.url));
const tryExt = (p) => { for (const c of [p, p + ".ts", p + ".tsx", path.join(p, "index.ts")]) { if (existsSync(c) && statSync(c).isFile()) return c; } return null; };
export async function resolve(spec, ctx, next) {
  if (spec === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (spec === "next/server" || spec === "next/headers") return next(`${spec}.js`, ctx);
  if (spec.startsWith("@/")) { const f = tryExt(path.join(SRC, spec.slice(2))); if (f) return { url: pathToFileURL(f).href, shortCircuit: true }; }
  if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:")) {
    const f = tryExt(path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec));
    if (f && !spec.endsWith(".json")) return { url: pathToFileURL(f).href, shortCircuit: true };
  }
  return next(spec, ctx);
}
