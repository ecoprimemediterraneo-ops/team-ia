const R = new URL("../../src/lib/", import.meta.url).href;
delete process.env.BOOKING_SIMULATE; delete process.env.SUPABASE_URL;
const B = await import(R + "booking.ts");
const O = await import(R + "orchestrator.ts");
const D = await import(R + "sectores-demo.ts");
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const suma = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const tenantId = "tenant_demo_dental";
await D.sembrarDemoConservando(tenantId);
const negocio = await B.getBusinessByTenant(tenantId);
const sv = negocio.servicios.find((s: any) => s.activo); const sel = B.resolverServicio(sv, {});
let fecha = "", slots: string[] = [];
for (let d = 20; d < 40 && slots.length < 6; d++) { const r = await B.computeFreeSlots(negocio, sel, suma(d), REDIR); if (r.ok && r.slots.length >= 6) { fecha = suma(d); slots = r.slots; } }
const cuenta = async () => (await B.listRecords()).filter((r: any) => r.slug === negocio.slug && r.startIso.startsWith(fecha) && r.estado !== "cancelada").length;
const pide = (start: string, agente: any, n = "Cliente") => O.reservarSlot({ tenantId, userEmail: "x", redirectUri: REDIR, nombre: n, motivo: sv.nombre, startIso: start, agenteOrigen: agente, customerPhone: "099000002" });

// 8 agentes distintos a la vez sobre el MISMO hueco
const agentes = ["pablo", "carmen", "marta", "dashboard", "pablo", "carmen", "marta", "dashboard"];
const rs = await Promise.all(agentes.map((a, i) => pide(slots[0], a, "C" + i)));
assert(rs.filter((r: any) => r.ok).length === 1, `8 reservas simultáneas al mismo hueco → 1 sola (${rs.filter((r: any) => r.ok).length})`);
assert(await cuenta() === 1, "y una sola cita guardada");
assert(rs.filter((r: any) => !r.ok).every((r: any) => r.reason === "slot_taken"), "las otras 7 reciben 'hueco ocupado', no un error raro");

// Horas DISTINTAS pero solapadas (la carrera que la clave por hora exacta dejaba pasar)
const paso = negocio.slotStepMin || 15;
const a = slots[3], b = slots.find((s) => s > a && B.localToEpoch(s, negocio.timezone) - B.localToEpoch(a, negocio.timezone) < (sel.durationMin + sel.paddingAfterMin + sel.paddingBeforeMin) * 60000);
if (b) {
  const antes = await cuenta();
  const r2 = await Promise.all([pide(a, "pablo"), pide(b, "carmen"), pide(a, "marta"), pide(b, "dashboard")]);
  assert(r2.filter((r: any) => r.ok).length === 1, `dos horas solapadas pedidas a la vez → 1 sola cita (${r2.filter((r: any) => r.ok).length})`);
  assert(await cuenta() === antes + 1, "y una sola nueva guardada");
} else console.log("(sin par solapado en la rejilla: se omite)");

// Horas que NO se solapan sí entran las dos (elegidas entre lo que AHORA se ofrece)
const ahora = await B.computeFreeSlots(negocio, sel, fecha, REDIR);
const of = ahora.ok ? ahora.slots : [];
const huella = (sel.durationMin + sel.paddingAfterMin + sel.paddingBeforeMin) * 60000;
const l1 = of[of.length - 1];
const l2 = of.find((s) => B.localToEpoch(l1, negocio.timezone) - B.localToEpoch(s, negocio.timezone) >= 2 * huella);
if (l1 && l2) {
  const r3 = await Promise.all([pide(l1, "pablo"), pide(l2, "carmen")]);
  assert(r3.every((r: any) => r.ok), "dos horas que no se solapan, a la vez: entran las dos");
} else console.log("(sin par libre: se omite)");
// La reserva online pública comparte candado con los agentes
const dispo = await B.computeFreeSlots(negocio, sel, fecha, REDIR);
const libre = dispo.ok ? dispo.slots[0] : undefined;
if (libre) {
  const [ronline, ragente] = await Promise.all([
    B.crearReserva({ slug: negocio.slug, serviceId: sv.id, startIso: libre, cliente: { nombre: "Web", telefono: "099000003" }, redirectUri: REDIR }),
    pide(libre, "pablo", "Agente"),
  ]);
  assert([ronline.ok, ragente.ok].filter(Boolean).length === 1, `web pública y agente a la vez sobre el mismo hueco → 1 sola (${[ronline.ok, ragente.ok].filter(Boolean).length})`);
}
console.log(`\n=== ${ok}/${total} ===`);
if (ok !== total) process.exit(1);
