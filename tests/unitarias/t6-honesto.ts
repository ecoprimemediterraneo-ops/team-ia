const R = new URL("../../src/lib/", import.meta.url).href;
delete process.env.BOOKING_SIMULATE; delete process.env.SUPABASE_URL; delete process.env.RESEND_API_KEY;
const B = await import(R + "booking.ts");
const S = await import(R + "salon-acciones.ts");
const D = await import(R + "sectores-demo.ts");
const H = await import(R + "chat-honesto.ts");
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
const T = "tenant_demo_salon";
await D.sembrarDemoConservando(T);
const negocio = await B.getBusinessByTenant(T);
const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
const dia = (n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const wd = (f: string) => new Date(`${f}T12:00:00Z`).getUTCDay();
// hora pasada hoy (00:15 casi seguro ya pasó salvo entre 00:00 y 00:15)
let p = await S.prepararCrearCita(T, { nombre: "Laura", servicio: "corte", profesional: "Ana", fecha: hoy, hora: "00:15" });
assert(p.tipo === "nada" && /ya ha pasado/.test(p.motivo), "hora pasada de hoy → no se propone y lo dice: " + (p.motivo || "").slice(0, 120));
assert(/siguiente hueco/.test(p.motivo || ""), "y ofrece el siguiente hueco");
// día cerrado (domingo)
let dom = ""; for (let i = 1; i < 9; i++) if (wd(dia(i)) === 0) { dom = dia(i); break; }
p = await S.prepararCrearCita(T, { nombre: "Laura", servicio: "corte", profesional: "Ana", fecha: dom, hora: "11:00" });
assert(p.tipo === "nada" && /no abre el domingo/.test(p.motivo), "domingo cerrado → lo dice: " + (p.motivo || "").slice(0, 120));
// fuera de horario
let lab = ""; for (let i = 1; i < 9; i++) if (wd(dia(i)) === 2) { lab = dia(i); break; }
p = await S.prepararCrearCita(T, { nombre: "Laura", servicio: "corte", profesional: "Ana", fecha: lab, hora: "03:00" });
assert(p.tipo === "nada" && /fuera de horario/.test(p.motivo), "3 de la mañana → fuera de horario");
// mover a hora pasada no se propone (necesita cita); solo el guardián:
assert(H.afirmaHecho("Cita creada para Laura, corte y peinado con Ana hoy a las 11:00"), "guardián detecta 'Cita creada para…'");
assert(H.afirmaHecho("Hecho. Cita cancelada."), "detecta 'Hecho.'");
assert(!H.afirmaHecho("Ana tiene libre a las 11:00 y a las 12:00."), "no se dispara con una consulta normal");
assert(H.sinInventar("Cita creada para Laura", false) === H.TEXTO_NO_EJECUTADO, "sin propuesta, el 'creada' se sustituye");
assert(H.sinInventar("Crear cita: corte…", true) === "Crear cita: corte…", "con propuesta se respeta");
for (const y of ["si", "Sí", "vale", "ok", "confirmo", "sí, hazlo", "adelante"]) assert(H.esSi(y), `«${y}» es un sí`);
for (const y of ["si me das hueco mañana", "sí pero a las 12", "no sé"]) assert(!H.esSi(y), `«${y}» NO es un sí a secas`);
assert(H.esNo("no") && H.esNo("déjalo") && !H.esNo("no me cuadra la hora"), "no");
console.log(`\n=== ${ok}/${total} ===`);
