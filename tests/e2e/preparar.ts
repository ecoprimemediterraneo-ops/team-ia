// Antes de todo: el Graph de mentira y el tenant de pruebas limpio.
// Al acabar: se borra el tenant de pruebas y se apaga el Graph.
import fs from "node:fs";
import path from "node:path";
import { arrancarGraphFalso } from "./graph-falso";

// LAS PRUEBAS NUNCA DEJAN HUELLA EN LOS DATOS LOCALES. Antes de empezar se hace
// una copia de `data/` y al acabar se devuelve tal cual estaba: lo que las
// pruebas escriben (el tenant de pruebas, citas, mensajes) vive en esa tanda y
// desaparece. Así un fallo a mitad de prueba no puede dejar el fichero de
// negocios a medias (pasó el 28/09/2026: se perdieron los negocios de prueba).
const DATA = path.join(process.cwd(), "data");
const COPIA = path.join(process.cwd(), "tests", ".data-antes-de-e2e");
function copiar() {
  fs.rmSync(COPIA, { recursive: true, force: true });
  if (fs.existsSync(DATA)) fs.cpSync(DATA, COPIA, { recursive: true });
}
function restaurar() {
  if (!fs.existsSync(COPIA)) return;
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.cpSync(COPIA, DATA, { recursive: true });
  fs.rmSync(COPIA, { recursive: true, force: true });
}
import { BASE, admin, PASSWORD } from "./ayuda";

export default async function preparar() {
  const r0 = await fetch(`${BASE}/api/admin/e2e`, { headers: admin() }).catch(() => null);
  if (!r0) throw new Error(`No responde el servidor local en ${BASE}. Arráncalo con: npm run dev`);
  // Si una tanda anterior se cortó sin restaurar, primero se deja data/ como estaba.
  restaurar();
  copiar();
  const graph = await arrancarGraphFalso();
  const r = await fetch(`${BASE}/api/admin/e2e`, {
    method: "POST",
    headers: { ...admin(), "Content-Type": "application/json" },
    body: JSON.stringify({ accion: "preparar", password: PASSWORD }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`No se ha podido preparar el tenant de pruebas: ${JSON.stringify(j)}`);
  return async () => {
    if (!process.env.E2E_CONSERVAR) {
      await fetch(`${BASE}/api/admin/e2e`, {
        method: "POST",
        headers: { ...admin(), "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "limpiar" }),
      }).catch(() => {});
    }
    await new Promise((ok) => graph.close(() => ok(null)));
    if (!process.env.E2E_CONSERVAR) restaurar();
  };
}
