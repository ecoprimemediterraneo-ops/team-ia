// LOTE DE PABLO (30/09/2026): lista de espera por orden, órdenes de la dueña,
// cumpleaños, resumen diario y citas en serie. Todo con envío SIMULADO (en
// local el emisor de WhatsApp nunca sale a Meta).
const R = new URL("../../src/lib/", import.meta.url).href;
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
delete process.env.BOOKING_SIMULATE;
// Envío SIMULADO: en local, sin META_GRAPH_URL, el emisor nunca sale a Meta y
// devuelve "simulado". Hacen falta unas credenciales de relleno para llegar ahí.
delete process.env.VERCEL; delete process.env.META_GRAPH_URL;
process.env.WHATSAPP_ACCESS_TOKEN = "token-de-relleno"; process.env.WHATSAPP_PHONE_NUMBER_ID = "000000000";
const B = await import(R + "booking.ts");
const T = await import(R + "tenants.ts");
const D = await import(R + "sectores-demo.ts");
const O = await import(R + "orchestrator.ts");
const W = await import(R + "booking-waitlist.ts");
const PD = await import(R + "pablo-dueno.ts");
const CH = await import(R + "cita-por-chat.ts");
const H = await import(R + "chat-honesto.ts");
const AV = await import(R + "avisos-diarios.ts");
const S = await import(R + "citas-en-serie.ts");

const TEN = "tenant_demo_salon";
await D.sembrarDemoConservando(TEN);
const DUENA = "34611000999";
await T.upsertTenant({ ...(await T.getTenant(TEN)), ownerWhatsapp: DUENA });
const neg = await B.getBusinessByTenant(TEN);
const slug = neg.slug;
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const hoyM = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
const sumar = (f: string, n: number) => new Date(Date.parse(`${f}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
let DIA = sumar(hoyM(), 3); while ([0, 6].includes(new Date(`${DIA}T12:00:00Z`).getUTCDay())) DIA = sumar(DIA, 1);
const a11 = (f = hoyM()) => new Date(`${f}T11:00:00+02:00`);
const reservar = (startIso: string, nombre: string, tel: string, motivo = "corte", empleadoId?: string) =>
  O.reservarSlot({ tenantId: TEN, userEmail: "x", redirectUri: REDIR, nombre, motivo, startIso, agenteOrigen: "pablo", customerPhone: tel, empleadoId, confirmacionEnConversacion: true });

// ─── 4. LISTA DE ESPERA ─────────────────────────────────────────────────────
console.log("\n--- 4. Lista de espera ---");
const r1 = await reservar(`${DIA}T10:00:00`, "Ocupa Ana", "34611100001", "color", "emp_ana");
assert(r1.ok, "hay una cita de color a las 10:00 (solo la hace Ana)");
const of = await CH.ofrecerAlternativas({ tenantId: TEN, contacto: "34611100002", startIso: `${DIA}T10:00:00`, motivo: "color", nombre: "Laura", porque: "ocupado" });
assert(/lista de espera/.test(of.texto), `si la hora está llena, Pablo ofrece apuntarse: «${of.texto.slice(0, 120)}…»`);
const ap = await CH.pasoGuion({ tenantId: TEN, contacto: "34611100002", texto: "apúntame en la lista de espera", nombreCliente: "Laura", agenteOrigen: "pablo" });
assert(!!ap && ap.via === "espera_apuntada", "«apúntame» → queda en la lista");
await B.crearEspera({ slug, serviceId: "sv_color", fecha: DIA, horaPedida: "10:30", cliente: { nombre: "Marta", telefono: "34611100003" } });
await B.crearEspera({ slug, serviceId: "sv_color", fecha: DIA, horaPedida: "17:00", cliente: { nombre: "Tarde", telefono: "34611100004" } });
await B.crearEspera({ slug, serviceId: "sv_color", fecha: sumar(hoyM(), -1), cliente: { nombre: "Caducada", telefono: "34611100005" } });
process.env.WAITLIST_SEND_ENABLED = "true";
const cita = (await B.listRecords()).find((r: any) => r.slug === slug && r.cliente.telefono === "+34611100001" && r.estado !== "cancelada");
await B.cambiarEstadoRecord(cita.id, "cancelada", REDIR, slug);
const lista = await W.ofrecerALaLista(slug, { startIso: cita.startIso, serviceId: cita.serviceId, servicioNombre: cita.servicioNombre, empleadoId: cita.empleadoId }, REDIR, { ahora: a11() });
const telOf = lista.ofrecidas.map((o: any) => o.clienteTelefono);
assert(lista.ofrecidas.length === 2 && telOf[0] === "+34611100002" && telOf[1] === "+34611100003", `se escribe POR ORDEN a las de la mañana (${telOf.join(", ")})`);
assert(!telOf.includes("34611100004"), "no a la que pidió por la tarde (otra franja)");
assert(lista.caducadas >= 1 && !(await B.listEspera(slug)).some((e: any) => e.cliente.nombre === "Caducada" && e.estado === "esperando"), "la lista caduca el día del hueco");
assert(lista.ofrecidas.every((o: any) => o.estado === "ofrecida"), "ofertas enviadas (simulado)");
const siOpts = { esSi: H.esSi, esNo: H.esNo };
const gana = await W.responderHuecoPorWhatsapp(slug, "34611100003", "sí", REDIR, siOpts);
assert(!!gana && gana.via === "espera_acepta", "la primera que dice sí se lo queda");
assert((await B.listRecords()).some((r: any) => r.slug === slug && r.cliente.telefono === "+34611100003" && r.startIso === cita.startIso && r.estado !== "cancelada"), "y la cita queda en la agenda");
const tarde = await W.responderHuecoPorWhatsapp(slug, "34611100002", "si", REDIR, siOpts);
assert(!!tarde && /ya lo ha cogido|ya no|cogido/.test(tarde.texto) || (tarde === null), "a la otra se le dice que ya está cogido");
const ofs = (await W.listOffers(slug)).filter((o: any) => o.huecoStartIso === cita.startIso);
assert(ofs.filter((o: any) => o.estado === "aceptada").length === 1, "solo UNA aceptada por hueco");
delete process.env.WAITLIST_SEND_ENABLED;

// ─── 5. ÓRDENES DE LA DUEÑA ────────────────────────────────────────────────
console.log("\n--- 5. Pausar a Pablo desde WhatsApp ---");
await reservar(`${sumar(DIA, 1)}T12:00:00`, "Laura Pausa", "34611200001");
assert(await PD.esDuena(TEN, `+${DUENA}`), "reconoce el número de la dueña");
assert(!(await PD.esDuena(TEN, "34611200001")), "otro número NO es la dueña (nunca se le obedece)");
let resp = await PD.ordenDeLaDuena(TEN, "para con Laura Pausa");
assert(/no contesto/.test(resp || ""), `«para con Laura Pausa» → ${resp}`);
assert(await PD.pabloEnPausa(TEN, "34611200001"), "Pablo calla con esa clienta");
assert(!(await PD.pabloEnPausa(TEN, "34611299999")), "…y sigue con las demás");
assert(!(await PD.pabloEnPausa(TEN, "34611200001", Date.now() + 25 * 3600_000)), "la pausa se acaba sola a las 24 h");
resp = await PD.ordenDeLaDuena(TEN, "sigue con Laura Pausa");
assert(!(await PD.pabloEnPausa(TEN, "34611200001")), "«sigue con…» → vuelve a contestarle");
await PD.ordenDeLaDuena(TEN, "para todo");
assert(await PD.pabloEnPausa(TEN, "34611299999"), "«para todo» → no contesta a nadie");
await PD.ordenDeLaDuena(TEN, "sigue");
assert(!(await PD.pabloEnPausa(TEN, "34611299999")), "«sigue» → vuelve");
resp = await PD.ordenDeLaDuena(TEN, `mueve la cita de Laura Pausa al ${["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][new Date(`${sumar(DIA, 1)}T12:00:00Z`).getUTCDay()]} a las 17:00`);
assert(/Contesta sí o no/.test(resp || ""), `pide confirmación antes de mover: ${resp}`);
let laura = (await B.listRecords()).find((r: any) => r.cliente.telefono === "+34611200001" && r.estado !== "cancelada");
assert(laura.startIso.slice(11, 16) === "12:00", "sin confirmar, no se mueve");
resp = await PD.ordenDeLaDuena(TEN, "sí");
laura = (await B.listRecords()).find((r: any) => r.cliente.telefono === "+34611200001" && r.estado !== "cancelada");
assert(laura.startIso.slice(11, 16) === "17:00", `con «sí», movida: ${resp}`);
assert((await PD.ordenDeLaDuena(TEN, "hola, qué tal")) === null, "un mensaje normal de la dueña no es una orden");

// ─── 6. CUMPLEAÑOS ─────────────────────────────────────────────────────────
console.log("\n--- 6. Cumpleaños ---");
await reservar(`${sumar(DIA, 2)}T11:00:00`, "Cumple Rosa", "34611300001");
await B.saveClienteMeta(slug, "t:611300001", { cumpleanos: hoyM().slice(5) });
let c = await AV.pasadaCumpleanos(a11());
assert(c.felicitaciones.some((f: any) => f.nombre === "Cumple" && /apagado/.test(f.modo)), "con el flag apagado: se calcula y no sale nada");
c = await AV.pasadaCumpleanos(new Date(`${hoyM()}T22:00:00+02:00`));
assert(c.felicitaciones.length === 0, "fuera de 10–20 h no se felicita");
process.env.BIRTHDAY_ENABLED = "true"; process.env.BIRTHDAY_TEMPLATE = "aiteam_cumpleanos";
c = await AV.pasadaCumpleanos(a11());
assert(c.felicitaciones.some((f: any) => f.modo === "enviado"), "encendido: sale con plantilla (simulado)");
c = await AV.pasadaCumpleanos(a11());
assert(!c.felicitaciones.some((f: any) => f.nombre === "Cumple"), "una sola vez al año");
delete process.env.BIRTHDAY_ENABLED; delete process.env.BIRTHDAY_TEMPLATE;

// ─── 7. RESUMEN DIARIO ─────────────────────────────────────────────────────
console.log("\n--- 7. Resumen diario ---");
const hoy = hoyM();
const rh = await B.crearReservaManual({ slug, startIso: `${hoy}T19:00`, cliente: { nombre: "Hoy Resumen", telefono: "34611400001" }, serviceId: "sv_manicura", redirectUri: REDIR });
const anul = await B.crearReservaManual({ slug, startIso: `${sumar(hoy, 5)}T18:00`, cliente: { nombre: "Anulada Ayer", telefono: "34611400002" }, serviceId: "sv_manicura", redirectUri: REDIR });
if (anul.ok) await B.actualizarRecord(anul.record.id, "test", (x: any) => ({ ...x, estado: "cancelada", canceladaEn: new Date(Date.now() - 86_400_000).toISOString() }));
const res = await AV.resumenDelDia(neg, new Date());
assert(rh.ok && /19:00 Hoy Resumen · Manicura/.test(res.texto), "lista las citas de hoy con hora, clienta, servicio y profesional");
assert(/Anulada Ayer/.test(res.texto), "y las anulaciones de ayer");
const pr = await AV.pasadaResumenDiario(new Date(), TEN);
assert(pr.resumenes.length === 1 && /apagado/.test(pr.resumenes[0].modo), "con DAILY_SUMMARY_ENABLED apagado no sale nada");

// ─── 8. CITAS EN SERIE ─────────────────────────────────────────────────────
console.log("\n--- 8. Citas en serie ---");
const n2 = await B.getBusinessBySlug(slug);
n2.servicios = n2.servicios.map((s: any) => (s.id === "sv_mechas" ? { ...s, sesiones: { numero: 3, cadaDias: 21 } } : s));
await B.saveBusiness(n2);
const primera = `${DIA}T16:00:00`;
// La 3ª sesión (DIA+42) ya está ocupada a esa hora: se coge la más cercana.
await reservar(`${sumar(DIA, 42)}T16:00:00`, "Ocupa Mechas", "34611500009", "mechas", "emp_ana");
const r0 = await reservar(primera, "Serie Eva", "34611500001", "mechas", "emp_ana");
assert(r0.ok, "primera sesión reservada");
const serie = await S.completarSerie({ tenantId: TEN, primeraIso: primera, motivo: "mechas", nombre: "Serie Eva", telefono: "34611500001", empleadoId: "emp_ana", agenteOrigen: "pablo" });
assert(!!serie && serie.sesiones.length === 2, "se reservan las otras 2 de una vez");
assert(serie!.sesiones[0].ok && serie!.sesiones[0].iso === `${sumar(DIA, 21)}T16:00:00`, "la 2ª, 21 días después a la misma hora");
assert(serie!.sesiones[1].ok && serie!.sesiones[1].movida, `la 3ª no tenía hueco: la más cercana (${serie!.sesiones[1].iso})`);
assert(/3 en total/.test(S.textoSerie(serie!)), "y se le dice a la clienta");
const deEva = (await B.listRecords()).filter((r: any) => r.cliente.telefono === "+34611500001" && r.estado !== "cancelada");
assert(deEva.length === 3, "3 citas en la agenda");
assert((await S.completarSerie({ tenantId: TEN, primeraIso: primera, motivo: "corte", nombre: "X", agenteOrigen: "pablo" })) === null, "un servicio de una sola sesión no reserva nada más");

console.log(`\n=== ${ok}/${total} ===`);
