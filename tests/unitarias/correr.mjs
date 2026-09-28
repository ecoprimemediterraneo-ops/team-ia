// Lanza las pruebas por sector (motor de reservas, salón, dental, estética y
// gestoría) contra el código real. Cada una corre en su propia carpeta
// `tests/.run/<prueba>/` con un `data/` vacío: nunca toca el `data/` del proyecto.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const RUN = path.join(DIR, "..", ".run");
const pruebas = fs.readdirSync(DIR).filter((f) => /^t\d.*\.ts$/.test(f)).sort();
let fallos = 0;
for (const p of pruebas) {
  const cwd = path.join(RUN, p.replace(/\.ts$/, ""));
  fs.rmSync(cwd, { recursive: true, force: true });
  fs.mkdirSync(path.join(cwd, "data"), { recursive: true });
  const r = spawnSync(process.execPath, ["--no-warnings", "--import", path.join(DIR, "registrar.mjs"), path.join(DIR, p)], {
    cwd, encoding: "utf-8", timeout: 300_000,
    env: { ...process.env, SUPABASE_URL: "", SUPABASE_SERVICE_KEY: "", RESEND_API_KEY: "", META_GRAPH_URL: "" },
  });
  const salida = `${r.stdout}\n${r.stderr}`;
  const m = salida.match(/=== (\d+)\/(\d+) ===/);
  const ok = m && m[1] === m[2] && r.status === 0;
  if (!ok) { fallos++; console.log(salida.split("\n").filter((l) => /^FAIL|Error/.test(l)).slice(0, 10).join("\n")); }
  console.log(`${ok ? "✓" : "✘"} ${p} ${m ? `${m[1]}/${m[2]}` : "(no terminó)"}`);
}
fs.rmSync(RUN, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} prueba(s) con fallos` : "\nTodas en verde");
process.exit(fallos ? 1 : 0);
