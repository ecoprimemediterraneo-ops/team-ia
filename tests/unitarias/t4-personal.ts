const R = new URL("../../src/lib/", import.meta.url).href;
delete process.env.BOOKING_SIMULATE; delete process.env.SUPABASE_URL;
const B = await import(R + "booking.ts");
const O = await import(R + "orchestrator.ts");
const D = await import(R + "sectores-demo.ts");
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const suma = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const tenantId = "tenant_demo_salon";
await D.sembrarDemoConservando(tenantId);
const negocio = await B.getBusinessByTenant(tenantId);
assert((negocio.empleados || []).length === 3, "el salón demo tiene 3 profesionales");
const corte = negocio.servicios.find((s: any) => s.id === "sv_corte"); const mani = negocio.servicios.find((s: any) => s.id === "sv_manicura");
const selC = B.resolverServicio(corte, {});
let fecha = "", slots: string[] = [];
for (let d = 3; d < 20 && slots.length < 8; d++) { const r = await B.computeFreeSlots(negocio, selC, suma(d), REDIR, undefined, "emp_ana"); if (r.ok && r.slots.length >= 8) { fecha = suma(d); slots = r.slots; } }
const activas = async () => (await B.listRecords()).filter((r: any) => r.slug === negocio.slug && r.startIso.startsWith(fecha) && r.estado !== "cancelada" && r.tipo === "cita");
const web = (start: string, emp?: string, n = "Web") => B.crearReserva({ slug: negocio.slug, serviceId: "sv_corte", startIso: start, empleadoId: emp, cliente: { nombre: n, telefono: "099000010" }, redirectUri: REDIR });
const agente = (start: string, ag: any, n = "Ag", emp?: string) => O.reservarSlot({ tenantId, userEmail: "x", redirectUri: REDIR, nombre: n, motivo: "Corte y peinado", startIso: start, agenteOrigen: ag, empleadoId: emp });
const T = slots[0];

// 1) Web pública (Ana) y Pablo (Ana) a la vez sobre la misma hora: una sola gana
let [a, b] = await Promise.all([web(T, "emp_ana"), agente(T, "pablo", "P", "emp_ana")]);
assert([a.ok, b.ok].filter(Boolean).length === 1, `web(Ana) + Pablo(Ana) a la vez → 1 sola (${[a.ok, b.ok].filter(Boolean).length})`);
assert((await activas()).filter((r: any) => r.startIso.startsWith(T.slice(0, 16)) && r.empleadoId === "emp_ana").length === 1, "y Ana tiene UNA cita a esa hora");

// 2) Cuatro "cualquiera" a la vez a la MISMA hora: corte lo hacen Ana y Carla → entran 2, con profesionales distintas
const T2 = slots[3];
const rs = await Promise.all([web(T2), agente(T2, "carmen"), agente(T2, "marta"), agente(T2, "dashboard")]);
assert(rs.filter((r: any) => r.ok).length === 2, `4 "cualquiera" a la vez (corte: Ana y Carla) → entran 2 (${rs.filter((r: any) => r.ok).length})`);
const enT2 = (await activas()).filter((r: any) => r.startIso.startsWith(T2.slice(0, 16)));
assert(new Set(enT2.map((r: any) => r.empleadoId)).size === enT2.length && enT2.every((r: any) => !!r.empleadoId), "cada cita lleva una profesional distinta: ninguna 'sin profesional'");
assert(enT2.every((r: any) => ["emp_ana", "emp_carla"].includes(r.empleadoId)), "y solo las que hacen ese servicio");
const tercera = await agente(T2, "pablo");
assert(!tercera.ok && tercera.reason === "slot_taken", "la tercera petición a esa hora → ocupado (no quedaba nadie libre)");

// 3) Berta (uñas) sigue libre a esa hora para su servicio
const eb = await B.crearReserva({ slug: negocio.slug, serviceId: "sv_manicura", startIso: T2, empleadoId: "emp_berta", cliente: { nombre: "Uñas", telefono: "099000011" }, redirectUri: REDIR });
assert(eb.ok && eb.record.empleadoId === "emp_berta", "Berta atiende una manicura a esa misma hora (profesionales en paralelo)");

// 4) Dos solapadas de la MISMA profesional (Ana) a la vez desde canales distintos → una
const T3 = slots[6], T3b = slots.find((s) => s > T3 && B.localToEpoch(s, negocio.timezone) - B.localToEpoch(T3, negocio.timezone) < 30 * 60000) || slots[7];
const par = await Promise.all([web(T3, "emp_ana"), agente(T3b, "marta", "M", "emp_ana"), B.crearReservaManual({ slug: negocio.slug, serviceId: "sv_corte", startIso: T3, empleadoId: "emp_ana", cliente: { nombre: "Manual", telefono: "" }, redirectUri: REDIR })]);
const anaSolapa = (await activas()).filter((r: any) => r.empleadoId === "emp_ana");
let solapes = 0; for (const x of anaSolapa) for (const y of anaSolapa) if (x.id < y.id) {
  const xs = B.localToEpoch(x.startIso, negocio.timezone), ys = B.localToEpoch(y.startIso, negocio.timezone);
  if (xs < ys + (y.durationMin + (y.paddingAfterMin||0)) * 60000 && ys < xs + (x.durationMin + (x.paddingAfterMin||0)) * 60000) solapes++; }
assert(solapes === 0, `web + agente + cita a mano, misma profesional, horas solapadas → ningún solape (solapes: ${solapes})`);

// 5) Cita manual sin profesional en un negocio con personal: se asigna una libre, no queda huérfana
const T4 = slots[slots.length - 4];
const m = await B.crearReservaManual({ slug: negocio.slug, serviceId: "sv_corte", startIso: T4, cliente: { nombre: "SinPro", telefono: "" }, redirectUri: REDIR });
assert(m.ok && !!m.record.empleadoId, "cita manual sin profesional → se le asigna una libre");
// 6) Una cita sin profesional (antigua) no debe dejar a nadie: mover una cita mantiene su profesional
const mov = await B.reprogramarRecord(m.record.id, slots[slots.length - 1], undefined, REDIR);
assert(mov.ok && mov.record.empleadoId === m.record.empleadoId, "mover una cita conserva su profesional");

// 7) Lo ofrecido sigue siendo reservable, por profesional
const l = await B.computeFreeSlots(negocio, selC, fecha, REDIR, undefined, "emp_carla");
let malos = 0;
for (const s of (l.ok ? l.slots : []).slice(0, 6)) { const d = await B.disponibilidadParaReserva(tenantId, { startIso: s, durationMin: selC.durationMin, paddingBeforeMin: selC.paddingBeforeMin, paddingAfterMin: selC.paddingAfterMin, serviceId: "sv_corte", preferidoId: "emp_carla" }, REDIR); if (!(d.negocio && d.available)) malos++; }
assert(malos === 0, "cada hueco que se ofrece a Carla se puede reservar con Carla");
console.log(`\n=== ${ok}/${total} ===`); if (ok !== total) process.exit(1);
