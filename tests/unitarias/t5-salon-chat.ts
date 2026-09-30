const R = new URL("../../src/lib/", import.meta.url).href;
delete process.env.BOOKING_SIMULATE; delete process.env.SUPABASE_URL; delete process.env.RESEND_API_KEY;
const B = await import(R + "booking.ts");
const S = await import(R + "salon-acciones.ts");
const D = await import(R + "sectores-demo.ts");
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const suma = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const T = "tenant_demo_salon", OTRO = "tenant_demo_dental";
await D.sembrarDemoConservando(T); await D.sembrarDemoConservando(OTRO);
const negocio = await B.getBusinessByTenant(T);
const selC = B.resolverServicio(negocio.servicios.find((s: any) => s.id === "sv_corte"), {});
let fecha = "", slots: string[] = [];
for (let d = 3; d < 25 && slots.length < 10; d++) { const r = await B.computeFreeSlots(negocio, selC, suma(d), REDIR, undefined, "emp_ana"); if (r.ok && r.slots.length >= 10) { fecha = suma(d); slots = r.slots; } }
const activas = async () => (await B.listRecords()).filter((r: any) => r.slug === negocio.slug && r.tipo === "cita" && r.estado !== "cancelada");

// --- Preparar: nunca inventa, nunca escribe
let p = await S.prepararCrearCita(T, { nombre: "Marta", servicio: "corte", fecha });
assert(p.tipo === "nada" && /hora/.test(p.motivo), "sin hora → pregunta, no se inventa");
p = await S.prepararCrearCita(T, { nombre: "Marta", servicio: "tinte verde", fecha, hora: "10:00" });
assert(p.tipo === "nada" && /Los del salón son/.test(p.motivo), "servicio que no existe → lo dice y lista los reales");
p = await S.prepararCrearCita(T, { nombre: "Marta", servicio: "corte", profesional: "Berta", fecha, hora: slots[0].slice(11, 16) });
assert(p.tipo === "nada" && /no hace/.test(p.motivo), "Berta no hace cortes → no se propone");
p = await S.prepararCrearCita(T, { nombre: "Marta", servicio: "corte", profesional: "Zoe", fecha, hora: "10:00" });
assert(p.tipo === "nada" && /No hay ninguna profesional/.test(p.motivo), "profesional inexistente → lo dice");
p = await S.prepararCrearCita(T, { nombre: "Marta", servicio: "co", fecha, hora: "10:00" });
assert(p.tipo === "ambiguo" || p.tipo === "propuesta", "servicio ambiguo → pregunta o resuelve por coincidencia");
p = await S.prepararCrearCita(OTRO, { nombre: "Marta", servicio: "corte", fecha, hora: "10:00" });
assert(p.tipo === "nada", "en un negocio sin ese servicio (dental) no propone una cita de corte");
const antes = (await activas()).length;
p = await S.prepararCrearCita(T, { nombre: "Marta Ruiz", telefono: "099000031", servicio: "corte y peinado", profesional: "Ana", fecha, hora: slots[0].slice(11, 16) });
assert(p.tipo === "propuesta", "datos completos → PROPONE");
assert((await activas()).length === antes, "proponer NO escribe nada (confirmación obligatoria)");
if (p.tipo !== "propuesta") process.exit(1);

// --- Aislamiento
const cruzada = await S.ejecutar(OTRO, p.accion);
assert(!cruzada.ok && (await activas()).length === antes, "una propuesta del salón no se puede confirmar desde otro negocio");

// --- Confirmar: cita real, con la profesional pedida
const e = await S.ejecutar(T, p.accion);
assert(e.ok && /Hecho/.test(e.texto), `al confirmar se crea (${e.texto})`);
let rec = (await activas()).find((r: any) => r.cliente.nombre === "Marta Ruiz");
assert(!!rec && rec.empleadoId === "emp_ana" && rec.servicioNombre === "Corte y peinado", "queda con Ana y el servicio correcto");
const dup = await S.prepararCrearCita(T, { nombre: "Otra", servicio: "corte", profesional: "Ana", fecha, hora: slots[0].slice(11, 16) });
if (dup.tipo === "propuesta") { const r2 = await S.ejecutar(T, dup.accion); assert(!r2.ok && /no está libre/.test(r2.texto), `Ana ya ocupada a esa hora → dice que no (${r2.texto.slice(0, 60)}…)`); }
const sinPro = await S.prepararCrearCita(T, { nombre: "Otra2", servicio: "corte", fecha, hora: slots[0].slice(11, 16) });
if (sinPro.tipo === "propuesta") { const r3 = await S.ejecutar(T, sinPro.accion); const rr = (await activas()).find((r: any) => r.cliente.nombre === "Otra2"); assert(r3.ok && rr?.empleadoId === "emp_carla", "sin profesional pedida → se asigna la libre (Carla)"); }

// --- Mover
const mv = await S.prepararMoverCita(T, { quien: "Marta", nuevaFecha: fecha, nuevaHora: slots[5].slice(11, 16) });
assert(mv.tipo === "propuesta", "mover: propone");
assert((await activas()).find((r: any) => r.id === rec.id).startIso.slice(11, 16) === slots[0].slice(11, 16), "y no mueve nada hasta confirmar");
if (mv.tipo === "propuesta") {
  const r = await S.ejecutar(T, mv.accion);
  const nuevo = (await activas()).find((x: any) => x.id === rec.id);
  assert(r.ok && nuevo.startIso.slice(11, 16) === slots[5].slice(11, 16) && nuevo.empleadoId === "emp_ana", "confirmar mueve la cita y conserva a Ana");
}
assert((await S.prepararMoverCita(T, { quien: "Nadie Existe", nuevaFecha: fecha, nuevaHora: "10:00" })).tipo === "nada", "mover a quien no tiene cita → lo dice");

// --- Lista de espera
const esp = await S.prepararApuntarEspera(T, { nombre: "Lucía Prueba", servicio: "color", fecha, hora: "17:00" });
assert(esp.tipo === "nada" && /teléfono/.test(esp.motivo), "espera sin teléfono → lo pide");
const esp2 = await S.prepararApuntarEspera(T, { nombre: "Lucía Prueba", telefono: "099000032", servicio: "color", fecha, hora: "17:00" });
assert(esp2.tipo === "propuesta", "espera completa → propone");
assert((await B.listEspera(negocio.slug)).length === 0, "y no apunta a nadie hasta confirmar");
if (esp2.tipo === "propuesta") { const r = await S.ejecutar(T, esp2.accion); const l = await B.listEspera(negocio.slug); assert(r.ok && l.length === 1 && l[0].cliente.nombre === "Lucía Prueba" && l[0].fecha === fecha, "confirmar apunta en la lista de espera"); }

// --- Cancelar (avisa a la espera del día, sin enviar nada real)
const ca = await S.prepararCancelarCita(T, { quien: "Marta" });
assert(ca.tipo === "propuesta", "cancelar: propone");
if (ca.tipo === "propuesta") {
  const r = await S.ejecutar(T, ca.accion);
  assert(r.ok && !(await activas()).some((x: any) => x.id === rec.id), "confirmar cancela y libera el hueco");
  const libre = await B.computeFreeSlots(negocio, selC, fecha, REDIR, undefined, "emp_ana");
  assert(libre.ok && libre.slots.includes(slots[5]), "el hueco vuelve a ofrecerse");
}

// --- Clientas dormidas + mensaje (nada se envía)
const hace90 = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
for (let i = 0; i < 3; i++) await B.saveRecord({ id: `bk_old_${i}`, token: `t${i}`, slug: negocio.slug, tenantId: T, serviceId: "sv_corte", servicioNombre: "Corte y peinado", durationMin: 45, startIso: `${suma(-90 - i * 20)}T10:00:00`, cliente: { nombre: "Carmen Dormida", telefono: "099000033" }, empleadoId: "emp_ana", empleadoNombre: "Ana", estado: "completada", origen: "manual", tipo: "cita", creadaEn: new Date().toISOString(), precioEUR: 25 });
const dorm = await B.listClientasDormidasCompleto(negocio.slug);
const c = dorm.find((d: any) => d.nombre === "Carmen Dormida");
assert(!!c && c.visitas === 3 && c.profesionalHabitual === "Ana" && c.servicioHabitual === "Corte y peinado" && c.diasSinVenir >= 90, "la dormida sale con visitas, su profesional habitual y su servicio");
assert(c && c.puedeEnviar === false && c.telefono === "+34099000033", "sin email: no hay envío automático, sí teléfono (en E.164)");
assert(!dorm.some((d: any) => d.nombre === "Marta Ruiz"), "las que tienen cita próxima o vinieron hace poco no salen");
const fichas = await B.listClientes(negocio.slug);
assert(fichas.find((f: any) => f.nombre === "Carmen Dormida")?.profesionalHabitual === "Ana", "la ficha de la clienta trae su profesional habitual");
const m = await S.prepararMensajeReactivacion(T, { quien: "Carmen" });
assert(m.tipo === "propuesta" && /No se envía nada/.test(m.resumen), "el mensaje se PROPONE y avisa de que no se envía");
if (m.tipo === "propuesta") {
  const r = await S.ejecutar(T, m.accion);
  assert(r.ok && /No he enviado nada/.test(r.texto) && /Carmen/.test(r.texto) && !/[¿¡]/.test(m.accion.texto) && !/[\u{1F300}-\u{1FAFF}]/u.test(m.accion.texto), "confirmar enseña el texto (sin emojis ni ¿¡) y no envía nada");
  assert((await B.getClienteFicha(negocio.slug, c.key))?.meta.reactivacionEnviadaIso === undefined, "no queda marcada como avisada");
}
assert((await S.prepararMensajeReactivacion(T, { quien: "Marta" })).tipo === "nada", "una clienta que no está dormida → no se prepara mensaje");
console.log(`\n=== ${ok}/${total} ===`); if (ok !== total) process.exit(1);
