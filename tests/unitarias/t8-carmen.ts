const R = new URL("../../src/lib/", import.meta.url).href;
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
const C = await import(R + "carmen-llamadas.ts");
const B = await import(R + "booking.ts");
const D = await import(R + "sectores-demo.ts");
const T = await import(R + "tenants.ts");
const EV = await import(R + "event-log.ts");
const CH = await import(R + "cita-por-chat.ts");

assert(C.idiomaDe("Hi, I'd like to book a haircut tomorrow please") === "en", "idioma: inglés");
assert(C.idiomaDe("Hola, quiero una cita para mañana") === "es", "idioma: español");
assert(C.esUrgencia("me duele mucho desde ayer", C.URGENCIAS_POR_DEFECTO) === "me duele mucho", "urgencia detectada");
assert(C.esUrgencia("quería pedir cita", C.URGENCIAS_POR_DEFECTO) === null, "sin urgencia");
assert(C.esUrgencia("tengo una fuga", ["fuga"]) === "fuga", "palabras de urgencia configurables");

const TEN = "tenant_demo_salon";
await D.sembrarDemoConservando(TEN);
const neg = await B.getBusinessByTenant(TEN);
const madrid = (h: number) => { const d = new Date(); const s = d.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }); return new Date(`${s}T${String(h).padStart(2, "0")}:30:00+02:00`); };
let r = await C.lanzarLlamada({ tenantId: TEN, telefono: "34611000111", motivo: "recordatorio", ahora: madrid(22) });
assert(!r.ok && r.motivo === "fuera_de_hora", "no llama a las 22:30");
r = await C.lanzarLlamada({ tenantId: TEN, telefono: "34611000111", motivo: "recordatorio", ahora: madrid(11) });
assert(!r.ok && r.motivo === "sin_contacto_previo", "nunca en frío");
process.env.TEST_PHONE = "+34611999888";
r = await C.lanzarLlamada({ tenantId: TEN, telefono: "+34611999888", motivo: "demo", ahora: madrid(11) });
assert(r.ok && r.modo === "prueba", "demo al TEST_PHONE: modo prueba sin Retell");
await T.upsertTenant({ ...(await T.getTenant(TEN)), carmenConfig: { llamadasDiarias: 1 } });
r = await C.lanzarLlamada({ tenantId: TEN, telefono: "+34611999888", motivo: "demo", ahora: madrid(11) });
assert(!r.ok && r.motivo === "limite_diario", "límite diario por negocio");
await T.upsertTenant({ ...(await T.getTenant(TEN)), carmenConfig: { llamadasDiarias: 20 } });

// Recordatorio: WhatsApp enviado hace 4 h, sin confirmar → Carmen llama (modo prueba). Una vez.
const man = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
const rec = { id: "bk_t8", token: "tok", slug: neg.slug, tenantId: TEN, serviceId: "sv_corte", servicioNombre: "Corte y peinado", durationMin: 45, precioEUR: 25,
  startIso: `${man}T12:00:00`, cliente: { nombre: "Rosa", telefono: "34611222333" }, eventId: "int_t8", estado: "confirmada", origen: "online", tipo: "cita",
  creadaEn: new Date().toISOString(), recordatorioEnviado: true, recordatorioEnviadoEn: new Date(madrid(11).getTime() - 4 * 3600_000).toISOString() };
await B.saveRecord(rec);
let p = await C.pasadaLlamadasRecordatorio(madrid(11));
assert(p.prueba === 1, "sin confirmar en 3 h → llama Carmen");
p = await C.pasadaLlamadasRecordatorio(madrid(12));
assert(p.prueba === 0, "no llama dos veces");
await B.saveRecord({ ...rec, id: "bk_t8b", token: "tok2", eventId: "int_t8b", startIso: `${man}T17:00:00`, cliente: { nombre: "Rosa", telefono: "34611222333" } });
const c = await CH.gestionarCitaExistente({ tenantId: TEN, contacto: "34611222333", texto: "sí" });
assert(!!c && /confirmada/.test(c.texto), "«sí» al recordatorio confirma la cita");
p = await C.pasadaLlamadasRecordatorio(madrid(13));
assert(p.prueba === 0, "confirmada: Carmen ya no llama");

// Informe semanal: de datos guardados
await EV.logEvent(TEN, { id: "t8-llamada", type: "message_in", channel: "carmen", senderId: "34611222333", meta: { kind: "llamada" } });
await EV.logEvent(TEN, { id: "t8-cita", type: "appointment_set", channel: "carmen", senderId: "34611222333", meta: { eventId: "int_t8" } });
const inf = await C.informeSemanal(TEN);
assert(inf.llamadas >= 1 && inf.citas >= 1 && inf.euros >= 25, `informe: ${inf.texto.replace(/\n/g, " | ")}`);
assert(inf.rescatadas >= 1, "cita tras llamada saliente = rescatada");
console.log(`\n=== ${ok}/${total} ===`);
