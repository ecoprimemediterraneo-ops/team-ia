// MEMORIA DE CLIENTA Y RESEÑA DE GOOGLE (29/09/2026).
//   Memoria: aprende preferencias (nunca salud), calcula "lo de siempre" y su
//   profesional, se la da a Pablo para saludar por su nombre, y se borra entera
//   si la clienta pide que la olviden.
//   Reseña: solo citas realizadas del día anterior, una cada 90 días, nunca tras
//   una queja, y sin enlace de Google no se pide nada.
const R = new URL("../../src/lib/", import.meta.url).href;
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
delete process.env.BOOKING_SIMULATE;
const B = await import(R + "booking.ts");
const T = await import(R + "tenants.ts");
const O = await import(R + "orchestrator.ts");
const M = await import(R + "memoria-clienta.ts");
const P = await import(R + "persona.ts");
const RS = await import(R + "resena-whatsapp.ts");
const SP = await import(R + "segundo-plano.ts");

// ─── MEMORIA: lo que dice la clienta ────────────────────────────────────────
const p1 = M.preferenciasDeMensaje("Me gusta el esmalte nude. Prefiero por la tarde, que salgo tarde de trabajar.");
assert(p1.preferencias.some((x: string) => /esmalte nude/.test(x)), "«me gusta el esmalte nude» se recuerda");
assert(p1.franja === "tarde", "«prefiero por la tarde» → franja tarde");
const p2 = M.preferenciasDeMensaje("Soy alérgica al látex. Me gusta que me hagan la manicura rusa. Prefiero que no me pongan nada porque estoy embarazada.");
assert(p2.preferencias.length === 1 && /manicura rusa/.test(p2.preferencias[0]), `los datos de salud NO se guardan (${JSON.stringify(p2.preferencias)})`);
for (const t of ["tengo dermatitis", "tomo sintrom", "estoy embarazada de 5 meses", "soy diabética"]) assert(M.esDatoDeSalud(t), `dato de salud: «${t}»`);
assert(!M.esDatoDeSalud("me gusta el esmalte nude"), "una preferencia normal no es de salud");
for (const t of ["Olvidadme, por favor", "Borra mis datos", "No quiero que guardéis nada de mí", "Please forget me"]) assert(M.pideOlvido(t), `pide olvido: «${t}»`);
for (const t of ["Se me olvidó la cita", "¿Me borras la cita del jueves?"]) assert(!M.pideOlvido(t), `no es olvido: «${t}»`);

// ─── MEMORIA: con sus citas de verdad ───────────────────────────────────────
const AITEAM = T.DEFAULT_TENANT_ID;
await T.upsertTenant({ ...(await T.getTenant(AITEAM))!, negocioAgenda: "demo" });
const demo = (await B.getBusinessBySlug("demo"))!;
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const TEL = "+34611555777";
const suma = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const reservar = async (motivo: string, startIso: string, empleadoId?: string) =>
  O.reservarSlot({ tenantId: AITEAM, userEmail: "x", redirectUri: REDIR, nombre: "Laura Prueba", motivo, startIso, agenteOrigen: "pablo", customerPhone: TEL, empleadoId, confirmacionEnConversacion: true });
const mani = demo.servicios.find((s: { nombre: string }) => s.nombre === "Manicura")!;
const hueco = async (sv: { id: string }, d: number) => (await B.computeFreeSlots(demo, B.resolverServicio(sv, {}), suma(d), REDIR));
let usados = 0;
const libreDe = async (svc: { id: string }) => { for (let d = 3 + usados; d < 60; d++) { const r = await hueco(svc, d); if (r.ok && r.slots.length) { usados = d - 2; return r.slots[0]; } } return ""; };
const r1 = await reservar("manicura", await libreDe(mani), "emp_ana");
const r2 = await reservar("manicura", await libreDe(mani), "emp_ana");
const pedi = demo.servicios.find((s: { nombre: string }) => /Pedicura/.test(s.nombre))!;
const r3 = await reservar("pedicura", await libreDe(pedi));
await SP.esperarSegundoPlano();
assert(r1.ok && r2.ok && r3.ok, "tres citas de Laura (2 manicuras con Ana y 1 pedicura)");
await M.aprenderDeMensaje("demo", TEL, "Me gusta el esmalte nude. Prefiero por la tarde. Soy alérgica al látex.");
let mem = await M.leerMemoria("demo", TEL);
assert(mem.nombre === "Laura Prueba", "recuerda su nombre");
assert(mem.habitual?.servicio === "Manicura" && mem.habitual?.profesional === (demo.empleados!.find((e: { id: string }) => e.id === "emp_ana")!.nombre), `lo de siempre: ${mem.habitual?.servicio} con ${mem.habitual?.profesional}`);
assert(mem.franja === "tarde" && (mem.preferencias || []).length === 1, `preferencias: ${JSON.stringify(mem.preferencias?.map((p: { texto: string }) => p.texto))}, sin la alergia`);
const ctx = M.contextoDeMemoria(mem, demo);
assert(/se llama Laura\. Salúdala por su nombre/.test(ctx), "Pablo sabe que la tiene que saludar por su nombre");
assert(/¿Lo de siempre, manicura con Ana\?/.test(ctx) && /Ofrece primero a Ana/.test(ctx), "y propone «¿Lo de siempre, manicura con Ana?»");
assert(/por la tarde/.test(ctx) && /esmalte nude/.test(ctx) && !/l[aá]tex|alerg/i.test(ctx), "franja y preferencias, sin salud");
const persona = await P.resolverPersona({ tenantId: AITEAM, agente: "pablo", canal: "whatsapp", extra: ctx });
assert(persona.system.includes("¿Lo de siempre, manicura con Ana?"), "el contexto llega al prompt de Pablo");

// La dueña edita: lo de salud se rechaza.
const { rechazadas } = await M.editarMemoria("demo", B.clienteKey({ telefono: TEL }), { preferencias: ["Esmalte nude", "Toma anticoagulantes"] });
mem = await M.leerMemoria("demo", TEL);
assert(rechazadas.length === 1 && (mem.preferencias || []).map((p: { texto: string }) => p.texto).join() === "Esmalte nude", "en el panel, lo de salud tampoco se guarda");

// Olvido: se borra todo y ya no se usa lo anterior.
await new Promise((r) => setTimeout(r, 5));
await M.olvidarClienta({ slug: "demo", tenantId: AITEAM, telefono: TEL });
mem = await M.leerMemoria("demo", TEL);
assert(!mem.nombre && !mem.habitual && !mem.franja && !(mem.preferencias || []).length && !!mem.olvidadaEn, "tras «olvídame» no queda nombre, ni lo de siempre, ni preferencias");
assert(M.contextoDeMemoria(mem, demo) === "", "y Pablo ya no la trata como conocida");
assert((await B.citasActivasDeCliente("demo", TEL)).length === 3, "sus citas siguen en la agenda (las necesita el salón)");

// ─── RESEÑA ─────────────────────────────────────────────────────────────────
const ahora = new Date();
const ayer = new Date(ahora.getTime() - 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
const rec = (id: string, estado: string, tel: string, dia = ayer) => ({ id, slug: "demo", tenantId: AITEAM, estado, tipo: "cita", startIso: `${dia}T11:00:00`, servicioNombre: "Manicura", cliente: { nombre: `Cli ${id}`, telefono: tel }, creadaEn: ahora.toISOString() });
const conEnlace = { ...demo, resenaUrl: "https://g.page/r/salonbella/review" };
const recs = [
  rec("a", "completada", "+34611000101"), rec("b", "confirmada", "+34611000102"), rec("c", "cancelada", "+34611000103"),
  rec("d", "no_show", "+34611000104"), rec("e", "pendiente", "+34611000105"), rec("f", "completada", "+34611000106", suma(-3)),
];
let pet = RS.peticionesDeHoy({ business: conEnlace, records: recs as never, pedidas: {}, ahora });
assert(pet.map((p: { record: { id: string } }) => p.record.id).sort().join() === "a,b", `solo citas realizadas de ayer (${pet.map((p: { record: { id: string } }) => p.record.id)})`);
assert(RS.peticionesDeHoy({ business: { ...demo, resenaUrl: "" }, records: recs as never, pedidas: {}, ahora }).length === 0, "sin enlace de reseñas en la ficha, no se pide nada");
const hace = (d: number) => new Date(ahora.getTime() - d * 86_400_000).toISOString();
pet = RS.peticionesDeHoy({ business: conEnlace, records: recs as never, pedidas: { "34611000101": hace(30), "34611000102": hace(91) }, ahora });
assert(pet.map((p: { record: { id: string } }) => p.record.id).join() === "b", "una sola petición cada 90 días por clienta");
pet = RS.peticionesDeHoy({ business: conEnlace, records: recs as never, pedidas: {}, quejas: { "34611000101": hace(100) }, ahora });
assert(!pet.some((p: { record: { id: string } }) => p.record.id === "a"), "tras una queja no se le vuelve a pedir");
assert(JSON.stringify(RS.variablesPeticion(conEnlace, "Laura Prueba")) === JSON.stringify(["Laura", "Salón Bella", "https://g.page/r/salonbella/review"]), "plantilla aiteam_pedir_resena: nombre, negocio y enlace");
assert(RS.plantillaResena() === "aiteam_pedir_resena" && !RS.resenaSendEnabled(), "envío apagado por defecto (REVIEW_REQUEST_ENABLED) y con la plantilla nueva");
for (const t of ["La verdad es que no me gustó nada", "Fatal, me dejaron esperando media hora", "Me cobraron de más", "Not happy with the result"]) assert(RS.esQueja(t), `queja: «${t}»`);
for (const t of ["¡Genial, muchas gracias!", "Ahora mismo la dejo", "Encantada, hasta la próxima"]) assert(!RS.esQueja(t), `no es queja: «${t}»`);
await RS.marcarPedida("demo", "+34611000101", new Date(ahora.getTime() - 2 * 86_400_000));
assert(await RS.pedidaHaceNada("demo", "+34611000101"), "una respuesta en los 7 días siguientes se lee como respuesta a la petición");
assert(!(await RS.pedidaHaceNada("demo", "+34611000199")), "a quien no se le pidió, no");

console.log(`\n=== ${ok}/${total} ===`);
process.exit(ok !== total ? 1 : 0);
