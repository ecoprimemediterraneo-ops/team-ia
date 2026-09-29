// EL CAMINO DE PRODUCCIÓN, SIN TOCAR PRODUCCIÓN: Supabase (de mentira, con la
// misma API y latencia de red) y 20 PROCESOS a la vez, como 20 instancias de
// Vercel atendiendo a la vez a Carmen, Pablo, la web y el panel.
//   1. 20 reservas simultáneas al mismo hueco → entra 1, las otras "ocupado".
//   2. Si Supabase falla al leer las citas, NO se reserva a ciegas.
//   3. Con más de 1000 citas guardadas se siguen viendo todas (paginación).
//   4. El candado caducado solo se lo queda UNA instancia (robo atómico).
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const { arrancarSupabaseFalso } = await import(new URL("./supabase-falso.mjs", import.meta.url).href);
const falso = await arrancarSupabaseFalso();
process.env.SUPABASE_URL = falso.url;
process.env.SUPABASE_SERVICE_KEY = "clave-de-pruebas";
delete process.env.BOOKING_SIMULATE;
const R = new URL("../../src/lib/", import.meta.url).href;
const B = await import(R + "booking.ts");
const D = await import(R + "sectores-demo.ts");
const S = await import(R + "supabase.ts");
const O = await import(R + "orchestrator.ts");

let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const suma = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);

function lanzar(args: string[]): Promise<any> {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["--no-warnings", "--import", path.join(DIR, "registrar.mjs"), path.join(DIR, "hijo-reserva.ts"), ...args], {
      cwd: process.cwd(), env: { ...process.env },
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
assert(!!negocio, "el negocio demo vive en el Supabase de pruebas");
const sv = negocio.servicios.find((s: any) => s.activo);
const sel = B.resolverServicio(sv, {});
let fecha = "", slots: string[] = [];
for (let d = 3; d < 30 && slots.length < 25; d++) {
  const r = await B.computeFreeSlots(negocio, sel, suma(d), REDIR);
  if (r.ok && r.slots.length >= 6) { fecha = suma(d); slots = r.slots; }
}
assert(slots.length >= 6, `hay huecos (${slots.length} el ${fecha})`);

// 1) 20 instancias, el mismo hueco, el mismo instante.
const canales = ["carmen", "pablo", "web", "panel"];
const hueco = slots[2];
const disparo = Date.now() + 3000;
const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => lanzar([canales[i % 4], tenantId, negocio.slug, sv.id, hueco, String(disparo), String(i)])));
console.log("  resultados:", JSON.stringify(rs.map((r) => `${r.canal}:${r.ok ? "OK" : r.reason}${r.ms ? `(${r.ms}ms)` : ""}`)));
assert(rs.filter((r) => r.ok).length === 1, `20 instancias a la vez sobre el mismo hueco → entra 1 (${rs.filter((r) => r.ok).length})`);
assert(rs.filter((r) => !r.ok).every((r) => r.reason === "slot_taken"), `las otras reciben "ocupado" (${[...new Set(rs.filter((r) => !r.ok).map((r) => r.reason))].join(",")})`);
const enHueco = (await B.listRecords()).filter((r: any) => r.slug === negocio.slug && r.startIso.startsWith(hueco.slice(0, 16)) && r.estado !== "cancelada");
assert(enHueco.length === 1, `una sola cita guardada en el hueco (${enHueco.length})`);
assert(Math.max(...rs.map((r) => r.ms || 0)) < 25_000, `ninguna se cuelga (la más lenta: ${Math.max(...rs.map((r) => r.ms || 0))} ms)`);

// 2) Supabase falla al LISTAR las citas: no se puede decir "libre".
const libre = slots[5];
falso.opciones.fallarListados = true;
const ciega = await O.reservarSlot({ tenantId, userEmail: "x", redirectUri: REDIR, nombre: "A ciegas", motivo: sv.nombre, startIso: libre, agenteOrigen: "carmen", customerPhone: "600111222" });
const dispo = await B.computeFreeSlots(negocio, sel, fecha, REDIR);
falso.opciones.fallarListados = false;
assert(!ciega.ok && ciega.reason === "error", `con la lectura de citas caída NO se reserva a ciegas (${ciega.ok ? "reservó" : ciega.reason})`);
assert(!dispo.ok, `y la lista de huecos dice que no puede consultar, no "todo libre" (${dispo.ok ? `${dispo.slots.length} huecos` : "error"})`);
const tras = await O.reservarSlot({ tenantId, userEmail: "x", redirectUri: REDIR, nombre: "Después", motivo: sv.nombre, startIso: libre, agenteOrigen: "pablo", customerPhone: "600111223" });
assert(tras.ok, "cuando Supabase vuelve, se reserva con normalidad");

// 3) Más de 1000 citas: la de la 1001 también ocupa su hueco.
for (let i = 0; i < 1100; i++) {
  falso.filas.set(`booking:rec:aaa${String(i).padStart(5, "0")}`, { key: `booking:rec:aaa${String(i).padStart(5, "0")}`, value: { id: `aaa${i}`, slug: "otro-negocio", startIso: `${suma(40)}T10:00:00`, estado: "confirmada", durationMin: 30 } });
}
const tarde = slots[slots.length - 1];
falso.filas.set("booking:rec:zzz-ultima", { key: "booking:rec:zzz-ultima", value: { id: "zzz-ultima", slug: negocio.slug, tenantId, startIso: tarde, estado: "confirmada", durationMin: sel.durationMin, tipo: "cita", cliente: { nombre: "Última", telefono: "600999999" } } });
const todas = await B.listRecords();
assert(todas.length > 1100, `se leen todas las citas aunque pasen de 1000 (${todas.length})`);
const d2 = await B.computeFreeSlots(negocio, sel, fecha, REDIR);
assert(d2.ok && !d2.slots.includes(tarde), "y la cita que queda más allá de la fila 1000 sigue ocupando su hueco");

// 4) Candado caducado: 20 intentos a la vez de quedárselo → solo 1.
falso.filas.set("lock:prueba", { key: "lock:prueba", value: { owner: "viejo", at: 0, exp: Date.now() - 1000 } });
const robos = await Promise.all(Array.from({ length: 20 }, (_, i) => S.kvTryLock("lock:prueba", 30_000, `inst${i}`)));
assert(robos.filter(Boolean).length === 1, `un candado caducado solo se lo queda UNA instancia (${robos.filter(Boolean).length})`);

console.log(`  peticiones al Supabase de pruebas: ${falso.opciones ? "" : ""}${(await import(new URL("./supabase-falso.mjs", import.meta.url).href)).peticiones.total}`);
falso.servidor.close();
console.log(`\n=== ${ok}/${total} ===`);
process.exit(ok !== total ? 1 : 0);
