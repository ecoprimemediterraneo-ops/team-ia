// CHATS CON ACCIONES DEL PANEL (01/10/2026): salón, dental, estética y gestoría.
// El fallo: «cita para Laura con Ana hoy a las 11:00» → sin recuadro → «si» →
// «Cita creada»… y la cita no estaba ni en Hoy ni en la Agenda, y con una hora
// que ya había pasado. Aquí se prueba, sin IA, lo que lo impide:
//   · confirmar (botón o «sí» con recuadro) = `ejecutar()`, y «creada» solo si
//     la cita está GUARDADA en la agenda;
//   · horas pasadas, días cerrados y fuera de horario se rechazan al preparar
//     Y al confirmar;
//   · el texto del modelo nunca puede dar nada por hecho.
const R = new URL("../../src/lib/", import.meta.url).href;
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
delete process.env.BOOKING_SIMULATE; delete process.env.VERCEL; delete process.env.META_GRAPH_URL;

const B = await import(R + "booking.ts");
const D = await import(R + "sectores-demo.ts");
const H = await import(R + "chat-honesto.ts");
const HP = await import(R + "hueco-panel.ts");
const SA = await import(R + "salon-acciones.ts");
const DA = await import(R + "dental-acciones.ts");
const EA = await import(R + "estetica-acciones.ts");

const madrid = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).replace(" ", "T").slice(0, 16);
const hoy = madrid().slice(0, 10);
const sumar = (f: string, n: number) => new Date(Date.parse(`${f}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const proximo = (dow: number) => { let d = sumar(hoy, 2); while (new Date(`${d}T12:00:00Z`).getUTCDay() !== dow) d = sumar(d, 1); return d; };
const MARTES = proximo(2), DOMINGO = proximo(0);
const ayer = sumar(hoy, -1);

console.log("\n--- El texto del modelo nunca da nada por hecho ---");
for (const t of ["Cita creada para Laura con Ana a las 11:00.", "Hecho, ya tienes la cita de Laura.", "Te la he dejado reservada.", "Ya la tienes: id bk_1790abc.", "Listo! Laura queda apuntada."]) {
  assert(H.sinInventar(t, false) === H.TEXTO_NO_EJECUTADO, `sin propuesta: «${t}» → «no he hecho nada»`);
  assert(H.sinInventar(t, true) === H.TEXTO_PENDIENTE_CONFIRMAR, `con propuesta: «${t}» → «falta confirmar»`);
}
for (const t of ["Laura tiene cita confirmada el jueves a las 11.", "Ana tiene 3 citas hoy.", "Hay un hueco libre a las 17:45 con Ana."]) {
  assert(H.sinInventar(t, false) === t, `una respuesta informativa pasa tal cual («${t}»)`);
}
assert(H.sinInventar("Perfecto, la cita queda así.", false, "si") === H.TEXTO_SI_SIN_PROPUESTA, "«si» escrito SIN recuadro → no hay nada que confirmar");
assert(H.sinInventar("¿Corte y peinado, entonces?", false, "si") === "¿Corte y peinado, entonces?", "«si» sin recuadro pero el chat está preguntando → pasa");
assert(H.esSi("Sí") && H.esSi("vale") && H.esSi("confirmo") && !H.esSi("si, pero a las 12"), "«sí», «vale», «confirmo» son confirmaciones; «si, pero…» no");

// ─── SALÓN ──────────────────────────────────────────────────────────────────
const TS = "tenant_demo_salon";
await D.sembrarDemoConservando(TS);
const salon = await B.getBusinessByTenant(TS);
const citasDe = async (slug: string, nombre: string) =>
  (await B.listRecords()).filter((r: any) => r.slug === slug && r.tipo === "cita" && r.estado !== "cancelada" && r.cliente?.nombre === nombre);

console.log("\n--- Salón: el servicio es SIEMPRE el pedido ---");
const em = (t: string) => B.emparejarServicio(salon, t);
assert(em("corte").tipo === "exacto" && (em("corte") as any).servicio.nombre === "Corte", "«corte» → «Corte» (igual, sin mayúsculas)");
assert(em("CORTE Y PEINADO").tipo === "exacto" && (em("CORTE Y PEINADO") as any).servicio.nombre === "Corte y peinado", "«CORTE Y PEINADO» → «Corte y peinado»");
const varios = em("cort");
assert(varios.tipo === "varios" && (varios as any).opciones.map((x: any) => x.nombre).sort().join("|") === "Corte|Corte y peinado", `«cort» → pregunta entre SOLO esos dos (${varios.tipo === "varios" ? (varios as any).opciones.map((x: any) => x.nombre).join(", ") : varios.tipo})`);
const uno = em("peinado");
assert(uno.tipo === "varios" && (uno as any).opciones.length === 1, "«peinado» se parece a uno solo y AUN ASÍ se pregunta: nunca se cambia sin preguntar");
const nada = em("blanqueamiento");
assert(nada.tipo === "ninguno" && (nada as any).catalogo.some((x: any) => x.nombre === "Manicura"), "«blanqueamiento» → ninguno, con el catálogo real");
const pCorte = await SA.prepararCrearCita(TS, { nombre: "Laura Corte", servicio: "corte", profesional: "Ana", fecha: MARTES, hora: "12:00" });
assert(pCorte.tipo === "propuesta" && /^Crear cita: Corte de Laura Corte con Ana/.test(pCorte.resumen), `el recuadro dice «Corte» (${pCorte.tipo === "propuesta" ? pCorte.resumen : pCorte.tipo})`);
const pVarios = await SA.prepararCrearCita(TS, { nombre: "Laura Cort", servicio: "cort", profesional: "Ana", fecha: MARTES, hora: "12:30" });
assert(pVarios.tipo === "ambiguo" && pVarios.opciones.length === 2, "con varias coincidencias NO hay recuadro: pregunta cuál");
const pNada = await SA.prepararCrearCita(TS, { nombre: "Laura Nada", servicio: "blanqueamiento", profesional: "Ana", fecha: MARTES, hora: "12:30" });
assert(pNada.tipo === "nada" && /Los del salón son:.*Corte y peinado/.test(pNada.motivo), "sin coincidencia lo dice y enseña los servicios reales");
const eCorte = pCorte.tipo === "propuesta" ? await SA.ejecutar(TS, pCorte.accion) : { ok: false, texto: "" };
const gCorte = await citasDe(salon.slug, "Laura Corte");
assert(eCorte.ok && gCorte.length === 1 && gCorte[0].serviceId === "sv_corte_solo" && gCorte[0].servicioNombre === "Corte" && gCorte[0].durationMin === 30,
  `la cita GUARDADA es «Corte», 30 min (${gCorte[0]?.servicioNombre} · ${gCorte[0]?.durationMin} min)`);
const espera = await SA.prepararApuntarEspera(TS, { nombre: "Laura Espera", telefono: "600111222", servicio: "corte", fecha: MARTES });
assert(espera.tipo === "propuesta" && /Corte ·|· Corte$|Corte\b(?! y)/.test(espera.resumen) && !/Corte y peinado/.test(espera.resumen), "lista de espera: «corte» es «Corte», no «Corte y peinado»");

console.log("\n--- Salón: hora pasada, cerrado y fuera de horario (al preparar) ---");
const pasada = await SA.prepararCrearCita(TS, { nombre: "Laura Pasada", servicio: "corte", profesional: "Ana", fecha: ayer, hora: "11:00" });
assert(pasada.tipo === "nada" && /ya ha pasado/.test(pasada.motivo) && /siguiente hueco/.test(pasada.motivo), `hora pasada → no se propone y da el siguiente hueco («${pasada.tipo === "nada" ? pasada.motivo.slice(0, 90) : pasada.tipo}»)`);
const cerrado = await SA.prepararCrearCita(TS, { nombre: "Laura Domingo", servicio: "corte", profesional: "Ana", fecha: DOMINGO, hora: "11:00" });
assert(cerrado.tipo === "nada" && /no abre el domingo/.test(cerrado.motivo), `domingo cerrado → lo dice («${cerrado.tipo === "nada" ? cerrado.motivo.slice(0, 60) : cerrado.tipo}»)`);
const noche = await SA.prepararCrearCita(TS, { nombre: "Laura Noche", servicio: "corte", profesional: "Ana", fecha: MARTES, hora: "22:30" });
assert(noche.tipo === "nada" && /fuera de horario/.test(noche.motivo), "a las 22:30 → fuera de horario");
const sinTel = await SA.prepararCrearCita(TS, { nombre: "Laura Botón", servicio: "corte", profesional: "Ana", fecha: MARTES, hora: "11:00" });
assert(sinTel.tipo === "propuesta" && /: Corte de Laura Botón con Ana/.test(sinTel.resumen), `«corte» con Ana, sin teléfono → propuesta con «Corte», el servicio pedido (${sinTel.tipo === "propuesta" ? sinTel.resumen : sinTel.tipo})`);

assert(pasada.tipo === "nada" && HP.esPegaDeHora(pasada.motivo) && cerrado.tipo === "nada" && HP.esPegaDeHora(cerrado.motivo) && noche.tipo === "nada" && HP.esPegaDeHora(noche.motivo),
  "hora pasada, cerrado y fuera de horario cortan la vuelta del chat (no propone otra hora por su cuenta)");
assert(!HP.esPegaDeHora("Para la cita me falta: la hora."), "un dato que falta NO corta: el chat lo pregunta");

console.log("\n--- Salón: confirmar (botón o «sí» con recuadro = ejecutar) ---");
assert((await citasDe(salon.slug, "Laura Botón")).length === 0, "antes de confirmar NO hay cita (preparar no guarda nada)");
const ej = sinTel.tipo === "propuesta" ? await SA.ejecutar(TS, sinTel.accion) : { ok: false, texto: "" };
const guardadas = await citasDe(salon.slug, "Laura Botón");
assert(ej.ok && /Cita creada/.test(ej.texto) && guardadas.length === 1, `confirmar → «Cita creada» Y la cita está en la agenda (${guardadas.length})`);
assert(guardadas[0]?.startIso.slice(0, 16) === `${MARTES}T11:00` && guardadas[0]?.empleadoNombre === "Ana", "a la hora y con la profesional propuestas");
const otraVez = sinTel.tipo === "propuesta" ? await SA.ejecutar(TS, sinTel.accion) : { ok: true, texto: "" };
assert(!otraVez.ok && !/creada/i.test(otraVez.texto) && (await citasDe(salon.slug, "Laura Botón")).length === 1, `confirmar dos veces no duplica ni dice «creada» («${otraVez.texto.slice(0, 60)}»)`);

console.log("\n--- Salón: la hora caduca con la propuesta en pantalla ---");
const caducada = { clase: "crear_cita" as const, tenantId: TS, nombre: "Laura Caducada", telefono: "", servicioId: "sv_corte", servicioNombre: "Corte y peinado", profesionalId: "emp_ana", profesionalNombre: "Ana", startIso: `${ayer}T11:00:00`, etiqueta: "x" };
const rc = await SA.ejecutar(TS, caducada);
assert(!rc.ok && /ya ha pasado/.test(rc.texto) && (await citasDe(salon.slug, "Laura Caducada")).length === 0, "confirmar una propuesta cuya hora ya pasó → no se crea y lo dice");

console.log("\n--- «Creada» solo si está guardada ---");
assert((await HP.citaGuardada({ ok: true, recordId: "bk_no_existe", eventId: "ev_no_existe" }, salon.slug)) === null, "un ok del calendario sin cita en la agenda NO cuenta como creada");
assert((await HP.citaGuardada({ ok: true, recordId: guardadas[0]?.id }, salon.slug))?.id === guardadas[0]?.id, "con la cita en la agenda, sí");

// ─── DENTAL Y ESTÉTICA ──────────────────────────────────────────────────────
for (const [nombre, TEN, A, trat] of [["Dental", "tenant_demo_dental", DA, "Limpieza dental"], ["Estética", "tenant_demo_estetica", EA, "Valoración médica"]] as const) {
  console.log(`\n--- ${nombre} ---`);
  await D.sembrarDemoConservando(TEN);
  const neg = await B.getBusinessByTenant(TEN);
  const p1 = await (A as any).prepararCrearCita(TEN, { nombre: "Paciente Pasado", tratamiento: trat, fecha: ayer, hora: "11:00" });
  assert(p1.tipo === "nada" && /ya ha pasado/.test(p1.motivo), `${nombre}: hora pasada → no se propone (antes SÍ se proponía)`);
  const p2 = await (A as any).prepararCrearCita(TEN, { nombre: "Paciente Domingo", tratamiento: trat, fecha: DOMINGO, hora: "11:00" });
  assert(p2.tipo === "nada" && /no abre/.test(p2.motivo), `${nombre}: domingo cerrado → lo dice`);
  const pv = await (A as any).prepararCrearCita(TEN, { nombre: "Paciente Varios", tratamiento: trat.split(" ")[0].slice(0, 5), fecha: MARTES, hora: "10:30" });
  assert(pv.tipo === "ambiguo" && pv.opciones.includes(trat), `${nombre}: «${trat.split(" ")[0].slice(0, 5)}» no es exacto → pregunta (${pv.tipo === "ambiguo" ? pv.opciones.join(", ") : pv.tipo})`);
  const pn = await (A as any).prepararCrearCita(TEN, { nombre: "Paciente Nada", tratamiento: "corte de pelo", fecha: MARTES, hora: "10:30" });
  assert(pn.tipo === "nada" && /Los de la clínica son/.test(pn.motivo), `${nombre}: tratamiento que no existe → lo dice con el catálogo`);
  const p3 = await (A as any).prepararCrearCita(TEN, { nombre: `Paciente ${nombre}`, tratamiento: trat.toUpperCase(), fecha: MARTES, hora: "10:00" });
  assert(p3.tipo === "propuesta", `${nombre}: hora válida → propuesta`);
  const e3 = p3.tipo === "propuesta" ? await (A as any).ejecutar(TEN, p3.accion) : { ok: false, texto: "" };
  const g3 = await citasDe(neg.slug, `Paciente ${nombre}`);
  assert(e3.ok && /Cita creada/.test(e3.texto) && g3.length === 1, `${nombre}: confirmar → «Cita creada» Y está en la agenda (${e3.texto.slice(0, 70)})`);
  assert(g3[0]?.servicioNombre === trat && p3.tipo === "propuesta" && p3.resumen.includes(trat), `${nombre}: recuadro y cita guardada con el tratamiento pedido (${g3[0]?.servicioNombre})`);
  const e4 = await (A as any).ejecutar(TEN, { clase: "crear_cita", tenantId: TEN, nombre: "Paciente Caducado", telefono: "", tratamiento: trat, startIso: `${ayer}T11:00:00`, etiqueta: "x" });
  assert(!e4.ok && /ya ha pasado/.test(e4.texto), `${nombre}: confirmar una hora ya pasada → no se crea`);
}

console.log(`\n=== ${ok}/${total} ===`);
process.exit(0);
