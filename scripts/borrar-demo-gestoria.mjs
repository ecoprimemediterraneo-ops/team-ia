#!/usr/bin/env node
// Quita el juego de facturas de demostración de la gestoría.
//
// Solo toca lo que lleva la marca [DEMO] en las notas y lo del cliente indicado.
// El extracto del banco NO se borra salvo que se pida con --con-extracto: es el
// que da sentido a la pantalla y volver a subirlo tarda.
//
//   node scripts/borrar-demo-gestoria.mjs                 → quita las 10 facturas
//   node scripts/borrar-demo-gestoria.mjs --con-extracto  → además, el extracto y las pasadas
//
// Después, pulsa CONCILIAR en la pantalla para que se recalcule.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const TENANT = "tenant_demo_gestoria";
const CLIENTE = "600330033"; // Bar El Puerto
const MARCA = "[DEMO]";
const conExtracto = process.argv.includes("--con-extracto");

const DIR = path.join(process.cwd(), "data");
const leer = (f) => {
  const p = path.join(DIR, f);
  if (!existsSync(p)) return null;
  const raw = readFileSync(p, "utf-8").trim();
  return raw ? JSON.parse(raw) : {};
};
const escribir = (f, d) => writeFileSync(path.join(DIR, f), JSON.stringify(d, null, 2));

// --- Facturas de demostración ---
const facturas = leer("gestoria-facturas.json");
if (facturas?.[TENANT]) {
  const antes = facturas[TENANT].length;
  const quitadas = facturas[TENANT].filter((f) => (f.notas ?? "").includes(MARCA));
  facturas[TENANT] = facturas[TENANT].filter((f) => !(f.notas ?? "").includes(MARCA));
  escribir("gestoria-facturas.json", facturas);
  console.log(`facturas: ${antes} → ${facturas[TENANT].length}  (${quitadas.length} de demostración fuera)`);
}

// --- Movimientos: se sueltan los enlaces a esas facturas ---
const movs = leer("gestoria-movimientos.json");
if (movs?.[TENANT]) {
  if (conExtracto) {
    const antes = movs[TENANT].length;
    movs[TENANT] = movs[TENANT].filter((m) => m.cliente_id !== CLIENTE);
    console.log(`movimientos: ${antes} → ${movs[TENANT].length}  (extracto del cliente fuera)`);
  } else {
    let sueltos = 0;
    movs[TENANT] = movs[TENANT].map((m) => {
      if (m.cliente_id !== CLIENTE || m.signo !== "cargo") return m;
      sueltos++;
      return { ...m, estado: "sin_factura", factura_id: null, veces_sin_justificar: 0, resuelto_tras: undefined };
    });
    console.log(`movimientos: ${sueltos} cargos vueltos a "sin factura" (el extracto se queda)`);
  }
  escribir("gestoria-movimientos.json", movs);
}

// --- Histórico de pasadas ---
const pasadas = leer("gestoria-pasadas.json");
if (pasadas?.[TENANT]) {
  const antes = pasadas[TENANT].length;
  pasadas[TENANT] = pasadas[TENANT].filter((p) => p.cliente_id !== CLIENTE);
  escribir("gestoria-pasadas.json", pasadas);
  console.log(`pasadas: ${antes} → ${pasadas[TENANT].length}`);
}

console.log(conExtracto
  ? "\nListo. El cliente queda como estaba, sin extracto."
  : "\nListo. Pulsa CONCILIAR en la pantalla para que se recalcule.");
