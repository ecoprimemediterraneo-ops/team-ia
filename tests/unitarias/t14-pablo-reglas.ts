// PABLO: las reglas que no dependen de la IA (auditoría del 29/09/2026).
//   · servicio estricto, también en inglés o con erratas ("manicure" → Manicura),
//     y nunca el primero de la lista;
//   · el día sin hora ("¿qué horas tenéis el viernes?") se entiende;
//   · pide una persona / urgencia → se detecta;
//   · la IA nunca puede "confirmar" una cita que no se ha guardado;
//   · los textos fijos: una sola confirmación con lo guardado, servicios reales.
const R = new URL("../../src/lib/", import.meta.url).href;
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
const B = await import(R + "booking.ts");
const F = await import(R + "fecha-es.ts");
const PR = await import(R + "pablo-respuestas.ts");
const C = await import(R + "carmen-llamadas.ts");

const demo = (await B.getBusinessBySlug("demo"))!;
const nombres: string[] = demo.servicios.filter((s: { activo: boolean }) => s.activo).map((s: { nombre: string }) => s.nombre);

// Servicios
for (const [pedido, esperado] of [["manicure", "Manicura"], ["una manicura", "Manicura"], ["pedicure", "Pedicura spa"], ["massage", "Masaje relajante"], ["limpieza facial", "Limpieza facial profunda"], ["pestañas", "Extensiones de pestañas pelo a pelo"]] as const) {
  assert(B.servicioPedido(demo, pedido)?.nombre === esperado, `«${pedido}» → ${esperado} (${B.servicioPedido(demo, pedido)?.nombre})`);
}
for (const pedido of ["blanqueamiento dental", "corte de pelo", "un tratamiento capilar", "ortodoncia"]) {
  assert(B.servicioPedido(demo, pedido) === undefined, `«${pedido}» no existe en Salón Bella`);
}
const noHay = PR.textoServicioNoDisponible(demo, "blanqueamiento dental");
assert(nombres.every((n) => noHay.includes(n)) && !/tratamientos faciales|categor/i.test(noHay), "al rechazar, lista TODOS los servicios reales y ninguna categoría inventada");

// Día sin hora
const dia = F.diaDeTexto("Quería una limpieza facial el viernes, ¿qué horas tenéis?");
assert(/^\d{4}-\d{2}-\d{2}$/.test(dia) && new Date(`${dia}T12:00:00Z`).getUTCDay() === 5, `«el viernes» → un viernes (${dia})`);
assert(F.diaDeTexto("hola, ¿qué tal?") === "", "sin día → nada");

// Persona y urgencia
for (const t of ["Quiero hablar con una persona", "¿Me pasas con el responsable?", "Can I speak to a human please?", "ponme con alguien de verdad"]) assert(PR.pideUnaPersona(t), `pide una persona: «${t}»`);
for (const t of ["Quiero una manicura", "¿Cuánto cuesta la pedicura?", "Hablamos mañana de la cita"]) assert(!PR.pideUnaPersona(t), `no pide una persona: «${t}»`);
assert(!!C.esUrgencia("tengo una reacción alérgica fuerte en el ojo, es urgente", C.URGENCIAS_POR_DEFECTO), "reacción alérgica → urgencia");
assert(PR.textoAvisoAlDueno({ avisado: false, urgente: false }).includes("anotado") && !/te (llamar|contestar)á/.test(PR.textoAvisoAlDueno({ avisado: false, urgente: false })), "sin aviso al dueño no se promete que contestará");

// La IA no puede confirmar sin guardar
for (const t of ["Perfecto, te he agendado para el jueves a las 10", "Listo, cita confirmada para mañana", "Great, you're booked for Friday!", "Te queda reservada la manicura"]) assert(PR.confirmaCitaSinGuardar(t), `detecta confirmación falsa: «${t}»`);
for (const t of ["¿Qué día te viene bien?", "Pedicura spa son 28 euros", "Para dejarte la cita guardada necesito el servicio, el día y la hora."]) assert(!PR.confirmaCitaSinGuardar(t), `no es confirmación: «${t}»`);

// Confirmación: UN mensaje con lo GUARDADO
const rec = { id: "bk_x", token: "tok123", slug: "demo", tenantId: demo.tenantId, serviceId: "svc_mani", servicioNombre: "Manicura", empleadoNombre: "Ana", durationMin: 30, startIso: "2026-10-01T10:00:00", cliente: { nombre: "Laura Prueba", telefono: "+34611000000" }, estado: "confirmada", origen: "online", tipo: "cita", creadaEn: new Date().toISOString() };
const conf = PR.textoCitaGuardada({ record: rec as never, negocio: demo, nombre: "Laura Prueba" });
assert(/Listo, Laura/.test(conf) && conf.includes("Salón Bella") && conf.includes("Manicura") && conf.includes("jueves 1 de octubre a las 10:00") && conf.includes("con Ana") && conf.includes("/reservas/cancelar/tok123"), "la confirmación lleva servicio, día, profesional, dirección y enlace de anular");
const confEn = PR.textoCitaGuardada({ record: rec as never, negocio: demo, nombre: "Kate", idioma: "en" });
assert(/Done, Kate/.test(confEn) && confEn.includes("Thursday 1 October at 10:00"), "y en inglés si escriben en inglés");
assert(!/AI-Team|Bendito|cl[ií]nica/i.test(conf + confEn + noHay), "sin AI-Team, Bendito Arte ni clínica");

console.log(`\n=== ${ok}/${total} ===`);
process.exit(ok !== total ? 1 : 0);
