const R = new URL("../../src/lib/", import.meta.url).href;
delete process.env.BOOKING_SIMULATE; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY;
const B = await import(R + "booking.ts");
const O = await import(R + "orchestrator.ts");
const D = await import(R + "sectores-demo.ts");

let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const suma = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);

for (const [tenantId, etiqueta] of [["tenant_demo_dental", "DENTAL"], ["tenant_demo_estetica", "ESTÉTICA"]] as const) {
  console.log(`\n--- ${etiqueta} ---`);
  await D.sembrarDemoConservando(tenantId);
  const negocio = await B.getBusinessByTenant(tenantId);
  assert(!!negocio, "el negocio demo existe");
  const sv = negocio.servicios.find((s: any) => s.activo);
  const sel = B.resolverServicio(sv, {});
  const dur = sel.durationMin, pB = sel.paddingBeforeMin, pA = sel.paddingAfterMin;

  // Un día con huecos
  let fecha = "", slots: string[] = [];
  for (let d = 2; d < 12 && !slots.length; d++) {
    const r = await B.computeFreeSlots(negocio, sel, suma(d), REDIR);
    assert(r.ok, `sin Google conectado los huecos se calculan (día +${d}) — ${r.ok ? "" : r.detail}`);
    if (r.ok && r.slots.length) { fecha = suma(d); slots = r.slots; }
  }
  assert(slots.length > 4, `hay huecos que ofrecer (${slots.length} el ${fecha})`);

  // 1) Cada hueco ofrecido es reservable según la MISMA regla que usa reservarSlot
  let noReservables = 0;
  for (const s of slots) {
    const d = await B.disponibilidadParaReserva(tenantId, { startIso: s, durationMin: dur, paddingBeforeMin: pB, paddingAfterMin: pA }, REDIR);
    if (!(d.negocio && d.available)) noReservables++;
  }
  assert(noReservables === 0, `los ${slots.length} huecos ofrecidos pasan la comprobación de reserva (fallan: ${noReservables})`);

  // 2) Reservarlos de verdad: los 3 primeros distintos, cada uno se reserva a la primera
  const pedidos = [slots[0], slots[Math.floor(slots.length / 2)], slots[slots.length - 1]];
  for (const s of pedidos) {
    const r = await O.reservarSlot({ tenantId, userEmail: "fundador@x.com", redirectUri: REDIR, nombre: "Paciente Prueba", motivo: sv.nombre, startIso: s, agenteOrigen: "dashboard", customerPhone: "099000001" });
    assert(r.ok, `reservar el hueco ${s.slice(11, 16)} ofrecido funciona a la primera${r.ok ? "" : " — " + JSON.stringify(r)}`);
    assert(r.ok && String(r.eventId).startsWith("int_"), "sin Google la cita vive en la agenda interna (id int_)");
  }
  const tras = await B.computeFreeSlots(negocio, sel, fecha, REDIR);
  const despues = tras.ok ? tras.slots : [];
  assert(pedidos.every((s) => !despues.includes(s)), "tras reservarlos, esos huecos ya no se ofrecen");
  // Nada de lo que se sigue ofreciendo solapa con lo reservado
  const ep = (l: string) => B.localToEpoch(l, negocio.timezone);
  const solapan = despues.filter((s: string) => pedidos.some((p) => ep(s) - pB * 60000 < ep(p) + (dur + pA) * 60000 && ep(s) + (dur + pA) * 60000 > ep(p) - pB * 60000));
  assert(solapan.length === 0, `y lo que se sigue ofreciendo no se solapa con las citas (solapan: ${solapan.length})`);
  // Reintento: ocupado, con motivo y siguiente hueco
  const dup = await O.reservarSlot({ tenantId, userEmail: "x", redirectUri: REDIR, nombre: "Otro", motivo: sv.nombre, startIso: pedidos[0], agenteOrigen: "dashboard" });
  assert(!dup.ok && dup.reason === "slot_taken" && dup.motivo === "ocupado", "reservar un hueco ya cogido → ocupado");
  // Lo que ya no se ofrecía no se puede reservar
  const noOfrecido = slots.find((s) => !despues.includes(s) && !pedidos.includes(s));
  if (noOfrecido) {
    const r = await O.reservarSlot({ tenantId, userEmail: "x", redirectUri: REDIR, nombre: "Otro", motivo: sv.nombre, startIso: noOfrecido, agenteOrigen: "dashboard" });
    assert(!r.ok, "un hueco que dejó de ofrecerse (solapado por padding) tampoco se reserva");
  }
  // 3) Fuera de horario y pasado
  const fuera = await O.reservarSlot({ tenantId, userEmail: "x", redirectUri: REDIR, nombre: "N", motivo: sv.nombre, startIso: `${fecha}T03:00:00`, agenteOrigen: "dashboard" });
  assert(!fuera.ok && fuera.reason === "slot_taken" && fuera.motivo === "fuera_de_horario", "de madrugada → fuera de horario");
  const ayer = await O.reservarSlot({ tenantId, userEmail: "x", redirectUri: REDIR, nombre: "N", motivo: sv.nombre, startIso: `${suma(-1)}T10:00:00`, agenteOrigen: "dashboard" });
  assert(!ayer.ok && ayer.reason === "slot_taken", "una hora pasada no se reserva");
  // 4) Cancelar sin Google no revienta y libera el hueco
  const recs = (await B.listRecords()).filter((r: any) => r.slug === negocio.slug && r.startIso.startsWith(fecha) && r.estado !== "cancelada");
  assert(recs.length === 3, `hay 3 citas guardadas en la agenda interna (hay ${recs.length})`);
  const c = await B.cancelarReservaPorToken(recs[0].token, REDIR);
  assert(c.ok, `cancelar una cita interna funciona sin Google${c.ok ? "" : " — " + JSON.stringify(c)}`);
  const libre = await B.computeFreeSlots(negocio, sel, fecha, REDIR);
  assert(libre.ok && libre.slots.includes(recs[0].startIso.slice(0, 19)), "y el hueco cancelado vuelve a ofrecerse");
  const otra = await O.reservarSlot({ tenantId, userEmail: "x", redirectUri: REDIR, nombre: "Re", motivo: sv.nombre, startIso: recs[0].startIso.slice(0, 19), agenteOrigen: "dashboard" });
  assert(otra.ok, "y se puede volver a reservar");
}
console.log(`\n=== ${ok}/${total} ===`);
if (ok !== total) process.exit(1);
