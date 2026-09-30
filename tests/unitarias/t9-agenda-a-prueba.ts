// LA AGENDA A PRUEBA DE BOMBAS: lo que tiene que aguantar en una demo.
//   A. Varios profesionales: columna, horario, vacaciones y servicios de cada uno.
//   B. Cancelar libera el hueco AL INSTANTE.
//   C. Cancelar y mover a la vez: nunca resucita una cita cancelada.
//   D. Recordatorio: WhatsApp primero y, si no confirma en 3 h, UNA llamada de Carmen.
//   E. Hora de España con el cambio de hora de verano/invierno.
//   F. Un fichero de citas estropeado nunca se lee como "agenda vacía".
const R = new URL("../../src/lib/", import.meta.url).href;
delete process.env.BOOKING_SIMULATE; process.env.SUPABASE_URL = ""; process.env.SUPABASE_SERVICE_KEY = "";
process.env.RETELL_API_KEY = ""; process.env.CARMEN_LLAMADAS_REALES_LOCAL = "";
const fs = await import("node:fs/promises");
const path = await import("node:path");
const B = await import(R + "booking.ts");
const O = await import(R + "orchestrator.ts");
const D = await import(R + "sectores-demo.ts");
const L = await import(R + "carmen-llamadas.ts");

let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const TZ = "Europe/Madrid";
const suma = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const diaSemana = (f: string) => new Date(`${f}T12:00:00Z`).getUTCDay();
const TODO_EL_DIA = { abierto: true, franjas: [{ desde: "09:00", hasta: "20:00" }] };
const CERRADO = { abierto: false, franjas: [] };

// ---------- negocio de pruebas con 3 profesionales ----------
const tenantId = "tenant_demo_salon";
await D.sembrarDemoConservando(tenantId);
const base = await B.getBusinessByTenant(tenantId);
const [sCorte, sColor] = base.servicios.filter((s: any) => s.activo);
// Un día laborable (lunes a viernes) a más de una semana vista
let dia = suma(9);
while ([0, 6].includes(diaSemana(dia))) dia = new Date(Date.parse(`${dia}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10);
const diaSig = new Date(Date.parse(`${dia}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10);
const horario: any = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, TODO_EL_DIA]));
const horarioBea: any = { ...horario, [diaSemana(diaSig)]: CERRADO }; // Bea libra el día siguiente
await B.saveBusiness({
  ...base, horario, leadTimeMin: 60, cancelAntelacionMin: 0,
  empleados: [
    { id: "ana", nombre: "Ana", activo: true, color: "#e44", horario, serviceIds: [sCorte.id] },
    { id: "bea", nombre: "Bea", activo: true, color: "#4a4", horario: horarioBea, serviceIds: [sCorte.id, sColor.id] },
    { id: "cris", nombre: "Cris", activo: true, color: "#44e", horario, serviceIds: [sCorte.id], ausencias: [{ desde: dia, hasta: dia, motivo: "vacaciones" }] },
  ],
});
const negocio = await B.getBusinessByTenant(tenantId);
const slug = negocio.slug;
const selCorte = B.resolverServicio(sCorte, {});
const cliente = (n: string) => ({ nombre: `Cliente ${n}`, telefono: `61100${n.padStart(4, "0")}` });
const web = (start: string, n: string, extra: any = {}) => B.crearReserva({ slug, serviceId: sCorte.id, startIso: start, cliente: cliente(n), redirectUri: REDIR, ...extra });

console.log("\n--- A. Varios profesionales ---");
const h = `${dia}T11:00:00`;
const tres = await Promise.all([web(h, "1"), web(h, "2"), web(h, "3")]);
const quien = tres.filter((r: any) => r.ok).map((r: any) => r.record.empleadoNombre).sort();
assert(quien.length === 2 && quien.join() === "Ana,Bea", `3 a la vez "con cualquiera" a las 11:00 → Ana y Bea; Cris está de vacaciones (${quien.join(",")})`);
assert(tres.filter((r: any) => !r.ok).every((r: any) => r.reason === "slot_taken"), "la tercera recibe ocupado");
const huecosCris = await B.computeFreeSlots(negocio, selCorte, dia, REDIR, undefined, "cris");
assert(huecosCris.ok && huecosCris.slots.length === 0, `Cris no tiene huecos el día de vacaciones (${huecosCris.ok ? huecosCris.slots.length : "error"})`);
const huecosCrisSig = await B.computeFreeSlots(negocio, selCorte, diaSig, REDIR, undefined, "cris");
assert(huecosCrisSig.ok && huecosCrisSig.slots.length > 0, "y al día siguiente vuelve a tener");
const huecosBeaSig = await B.computeFreeSlots(negocio, selCorte, diaSig, REDIR, undefined, "bea");
assert(huecosBeaSig.ok && huecosBeaSig.slots.length === 0, "Bea libra el día siguiente según SU horario: sin huecos");
const colorConAna = await B.crearReserva({ slug, serviceId: sColor.id, startIso: `${dia}T16:00:00`, cliente: cliente("4"), empleadoId: "ana", redirectUri: REDIR });
assert(!colorConAna.ok, `Ana no hace "${sColor.nombre}": no se le puede asignar (${colorConAna.ok ? "se asignó" : colorConAna.reason})`);
const colorCualquiera = await B.crearReserva({ slug, serviceId: sColor.id, startIso: `${dia}T16:00:00`, cliente: cliente("5"), redirectUri: REDIR });
assert(colorCualquiera.ok && colorCualquiera.record.empleadoId === "bea", `"${sColor.nombre}" con cualquiera → Bea, la única que lo hace`);
const semana = await B.listRecordsForRange(slug, dia, diaSig);
const columnas = new Set(semana.filter((r: any) => r.estado !== "cancelada").map((r: any) => r.empleadoId));
assert(columnas.has("ana") && columnas.has("bea"), "el panel recibe cada cita con su profesional (su columna)");

console.log("\n--- B. Cancelar libera al instante ---");
const h2 = `${dia}T13:00:00`;
const c1 = await web(h2, "10", { empleadoId: "ana" });
const ocupado = await web(h2, "11", { empleadoId: "ana" });
assert(c1.ok && !ocupado.ok, "Ana a las 13:00: la primera entra, la segunda no");
const cancel = await B.cambiarEstadoRecord(c1.record.id, "cancelada", REDIR, slug);
const otra = await web(h2, "12", { empleadoId: "ana" });
assert(cancel.ok && otra.ok, "se cancela y el mismo hueco se puede reservar enseguida");

console.log("\n--- C. Cancelar y mover a la vez ---");
let resucitadas = 0, coherentes = 0;
for (let i = 0; i < 8; i++) {
  const hi = `${diaSig}T${String(9 + i).padStart(2, "0")}:00:00`;
  const nueva = `${diaSig}T${String(9 + i).padStart(2, "0")}:30:00`;
  const c = await web(hi, `2${i}`, { empleadoId: "ana" });
  if (!c.ok) { console.log("  (no se pudo crear la cita de partida)", c.reason); continue; }
  const [rc, rm] = await Promise.all([
    B.cambiarEstadoRecord(c.record.id, "cancelada", REDIR, slug),
    B.reprogramarRecord(c.record.id, nueva, undefined, REDIR, slug),
  ]);
  const final = await B.getRecord(c.record.id);
  if (rc.ok && final.estado !== "cancelada") resucitadas++;
  if (rc.ok && final.estado === "cancelada") coherentes++;
  void rm;
}
assert(resucitadas === 0, `ninguna cita cancelada vuelve a la vida al moverse a la vez (resucitadas: ${resucitadas})`);
assert(coherentes === 8, `las 8 cancelaciones quedan cancelada (${coherentes}/8)`);
const libresTrasCarrera = await B.computeFreeSlots(negocio, selCorte, diaSig, REDIR, undefined, "ana");
assert(libresTrasCarrera.ok && libresTrasCarrera.slots.includes(`${diaSig}T09:30:00`), "y la hora a la que se intentaba mover queda libre");

console.log("\n--- D. Recordatorio: WhatsApp y, sin respuesta en 3 h, una sola llamada ---");
// A una hora de llamar (11:00 en España): la prueba no puede depender de a qué hora se lance.
// El "hace 4 h" se mide desde ESAS 11:00, no desde la hora real (a partir de las 15 h fallaba).
const once = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" })}T11:00:00+02:00`);
const hace4h = new Date(once.getTime() - 4 * 3600_000).toISOString();
const mkCita = async (n: string, hora: string) => {
  const r = await web(`${diaSig}T${hora}:00`, n, { empleadoId: "cris" });
  await B.actualizarRecord(r.record.id, "test", (x: any) => ({ ...x, recordatorioEnviado: true, recordatorioEnviadoEn: hace4h }));
  return r.record.id;
};
const sinContestar = await mkCita("31", "10:00");
const confirmo = await mkCita("32", "11:00");
const cancelo = await mkCita("33", "12:00");
await B.actualizarRecord(confirmo, "test", (x: any) => ({ ...x, confirmadaPorClienteEn: new Date().toISOString() }));
await B.cambiarEstadoRecord(cancelo, "cancelada", REDIR, slug);
const [p1, p2] = await Promise.all([L.pasadaLlamadasRecordatorio(once), L.pasadaLlamadasRecordatorio(once)]);
const llamadas = p1.prueba + p1.llamadas + p2.prueba + p2.llamadas;
assert(llamadas === 1, `dos pasadas a la vez → Carmen llama UNA vez (${llamadas}); en local, en modo prueba`);
assert(!!(await B.getRecord(sinContestar)).llamadaRecordatorioEn, "queda apuntada la llamada");
const p3 = await L.pasadaLlamadasRecordatorio();
assert(p3.prueba + p3.llamadas === 0, "una tercera pasada ya no vuelve a llamar");
assert((await B.getRecord(cancelo)).estado === "cancelada", "a la que canceló no se le llama y sigue cancelada");

console.log("\n--- E. Hora de España y cambio de hora ---");
assert(B.localToEpoch("2026-03-29T10:00:00", TZ) === Date.parse("2026-03-29T08:00:00Z"), "29/03/2026 10:00 (ya en verano) = 08:00 UTC");
assert(B.localToEpoch("2026-03-28T10:00:00", TZ) === Date.parse("2026-03-28T09:00:00Z"), "28/03/2026 10:00 (aún en invierno) = 09:00 UTC");
assert(B.localToEpoch("2026-10-25T10:00:00", TZ) === Date.parse("2026-10-25T09:00:00Z"), "25/10/2026 10:00 (ya en invierno) = 09:00 UTC");
assert(B.localToEpoch("2026-10-24T10:00:00", TZ) === Date.parse("2026-10-24T08:00:00Z"), "24/10/2026 10:00 (aún en verano) = 08:00 UTC");
// Una cita a las 10:00 el día del cambio ocupa las 10:00 de verdad (no las 09:00 ni las 11:00)
const negDst = { ...negocio, leadTimeMin: 0 };
await B.saveBusiness(negDst);
const dst = await B.crearReserva({ slug, serviceId: sCorte.id, startIso: "2026-10-25T10:00:00", cliente: cliente("40"), empleadoId: "ana", redirectUri: REDIR });
const libDst = await B.computeFreeSlots(await B.getBusinessBySlug(slug), selCorte, "2026-10-25", REDIR, 0, "ana");
assert(dst.ok && libDst.ok && !libDst.slots.includes("2026-10-25T10:00:00") && libDst.slots.includes("2026-10-25T09:00:00"), "el día del cambio de hora la cita de las 10:00 ocupa las 10:00 y deja libres las 09:00");

console.log("\n--- F. Fichero de citas estropeado ---");
const fichero = path.join(process.cwd(), "data", "booking-records.json");
const bueno = await fs.readFile(fichero, "utf-8");
await fs.writeFile(fichero, bueno.slice(0, Math.floor(bueno.length / 2))); // a medio escribir
const ciega = await O.reservarSlot({ tenantId, userEmail: "x", redirectUri: REDIR, nombre: "A ciegas", motivo: sCorte.nombre, startIso: `${diaSig}T17:00:00`, agenteOrigen: "pablo", customerPhone: "600000077" });
const listaCiega = await B.computeFreeSlots(negocio, selCorte, diaSig, REDIR);
await fs.writeFile(fichero, bueno);
assert(!ciega.ok, `con el fichero a medio escribir NO se reserva a ciegas (${ciega.ok ? "reservó" : ciega.reason})`);
assert(!listaCiega.ok, "ni se ofrecen huecos como si la agenda estuviera vacía");
assert((await B.listRecords()).length === Object.keys(JSON.parse(bueno)).length, "y no se ha perdido ninguna cita");

console.log(`\n=== ${ok}/${total} ===`);
if (ok !== total) process.exit(1);
