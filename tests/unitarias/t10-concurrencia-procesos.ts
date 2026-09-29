// CONCURRENCIA DE VERDAD, EN LOCAL (ficheros de data/): 20 PROCESOS distintos
// —no 20 promesas en el mismo proceso— piden el MISMO hueco en el MISMO
// instante, por los cuatro caminos (Carmen, Pablo, web pública y panel).
// Tiene que entrar UNA sola cita y las otras 19 tienen que recibir "ocupado"
// (no un error), con dos huecos alternativos reales.
// Y 20 procesos reservando horas DISTINTAS a la vez: tienen que quedar las 20
// (antes, en local, la última escritura del fichero borraba las de los demás).
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const R = new URL("../../src/lib/", import.meta.url).href;
const DIR = path.dirname(fileURLToPath(import.meta.url));
delete process.env.BOOKING_SIMULATE; process.env.SUPABASE_URL = ""; process.env.SUPABASE_SERVICE_KEY = "";
const B = await import(R + "booking.ts");
const D = await import(R + "sectores-demo.ts");
const G = await import(R + "guion-huecos.ts");

let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const suma = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);

function lanzar(args: string[], env: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["--no-warnings", "--import", path.join(DIR, "registrar.mjs"), path.join(DIR, "hijo-reserva.ts"), ...args], {
      cwd: process.cwd(), env: { ...process.env, ...env },
    });
    let out = "";
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (out += c));
    p.on("close", () => {
      const m = out.match(/RESULTADO (.*)/);
      resolve(m ? JSON.parse(m[1]) : { ok: false, reason: "sin_resultado", detail: out.slice(-400) });
    });
  });
}

const tenantId = "tenant_demo_dental";
await D.sembrarDemoConservando(tenantId);
const negocio = await B.getBusinessByTenant(tenantId);
const sv = negocio.servicios.find((s: any) => s.activo);
const sel = B.resolverServicio(sv, {});
let fecha = "", slots: string[] = [];
for (let d = 3; d < 30 && slots.length < 25; d++) {
  const r = await B.computeFreeSlots(negocio, sel, suma(d), REDIR);
  if (r.ok && r.slots.length >= 4) { fecha = suma(d); slots = r.slots; }
}
assert(slots.length >= 4, `hay huecos para la prueba (${slots.length} el ${fecha})`);

// 1) 20 procesos, el MISMO hueco, el MISMO instante, por los cuatro caminos.
const hueco = slots[1];
const canales = ["carmen", "pablo", "web", "panel"];
const disparo = Date.now() + 2500; // tiempo para que arranquen todos
const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => lanzar([canales[i % 4], tenantId, negocio.slug, sv.id, hueco, String(disparo), String(i)])));
const buenos = rs.filter((r) => r.ok);
console.log("  resultados:", JSON.stringify(rs.map((r) => `${r.canal}:${r.ok ? "OK" : r.reason}`)));
assert(buenos.length === 1, `20 procesos a la vez sobre el mismo hueco → entra 1 (${buenos.length}, por ${buenos[0]?.canal})`);
assert(rs.filter((r) => !r.ok).every((r) => r.reason === "slot_taken"), `las otras 19 reciben "ocupado", no un error ni "agenda ocupada" (${[...new Set(rs.filter((r) => !r.ok).map((r) => r.reason))].join(",")})`);
const guardadas = (await B.listRecords()).filter((r: any) => r.slug === negocio.slug && r.startIso.startsWith(hueco.slice(0, 16)) && r.estado !== "cancelada");
assert(guardadas.length === 1, `y hay UNA sola cita guardada a esa hora (${guardadas.length})`);
const lentas = Math.max(...rs.map((r) => r.ms || 0));
assert(lentas < 20_000, `ninguna se queda colgada: la más lenta tarda ${lentas} ms`);

// Las que pierden reciben DOS alternativas reales (lo mismo que dicen Carmen y Pablo)
const alt = await G.huecosCercanos(tenantId, { startIso: hueco, motivo: sv.nombre });
assert(alt.length === 2, `se ofrecen 2 huecos alternativos (${alt.join(", ")})`);
for (const a of alt) {
  const d = await B.disponibilidadParaReserva(tenantId, { startIso: a, durationMin: sel.durationMin, paddingBeforeMin: sel.paddingBeforeMin, paddingAfterMin: sel.paddingAfterMin, serviceId: sv.id }, REDIR);
  assert(d.negocio && d.available, `la alternativa ${a} está libre de verdad`);
}

// 2) 20 procesos, horas DISTINTAS que no se solapan, en días distintos: entran las 20.
const pares: string[] = [];
for (let d = 31; d < 90 && pares.length < 20; d++) {
  const r = await B.computeFreeSlots(negocio, sel, suma(d), REDIR);
  if (r.ok && r.slots.length) pares.push(r.slots[0]);
}
const antes = (await B.listRecords()).length;
const disparo2 = Date.now() + 2500;
const rs2 = await Promise.all(pares.map((h, i) => lanzar([canales[i % 4], tenantId, negocio.slug, sv.id, h, String(disparo2), String(40 + i)])));
assert(rs2.every((r) => r.ok), `20 reservas a la vez en horas distintas → entran las 20 (${rs2.filter((r) => r.ok).length})`);
assert((await B.listRecords()).length === antes + pares.length, `y se guardan las 20: ninguna escritura pisa a otra (${(await B.listRecords()).length - antes})`);

console.log(`\n=== ${ok}/${total} ===`);
if (ok !== total) process.exit(1);
