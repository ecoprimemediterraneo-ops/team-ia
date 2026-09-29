// AGENDAR_CITA RÁPIDO Y SIN MENTIRAS (arreglos del 29/09/2026, tras la llamada
// de prueba: 11,4 s de espera, cita confirmada que no aparecía, "blanqueamiento"
// guardado como "Depilación de cejas" y el aviso al dueño con una plantilla que
// no existe).
//   1. Solo se confirma una cita que está GUARDADA en la agenda.
//   2. Un servicio que el salón no tiene no se guarda como el primero de la lista.
//   3. Reservar no espera a los avisos (dueño, WhatsApp, email): salen después,
//      y si fallan quedan pendientes y se reintentan. El candado sigue intacto.
//   5. En una llamada de Carmen el cliente recibe UN solo WhatsApp.
import http from "node:http";
const R = new URL("../../src/lib/", import.meta.url).href;
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };

// Meta de mentira: tarda 1,5 s por mensaje y se puede hacer fallar.
const meta = { tarda: 1500, falla: false, mensajes: [] as { to: string; tipo: string; plantilla?: string; texto: string }[] };
const srv = http.createServer((q, r) => {
  let b = ""; q.on("data", (c) => (b += c));
  q.on("end", () => setTimeout(() => {
    const p = JSON.parse(b || "{}");
    if (meta.falla) { r.writeHead(500, { "Content-Type": "application/json" }); r.end(JSON.stringify({ error: { message: "caído (simulado)", code: 1 } })); return; }
    // La plantilla vieja no existe (lo que dijo Meta el 29/09); la nueva, pendiente de aprobar.
    if (p.type === "template" && /aviso_dueno_cita/.test(p.template?.name)) {
      r.writeHead(400, { "Content-Type": "application/json" });
      r.end(JSON.stringify({ error: { message: "(#132001) Template name does not exist in the translation", code: 132001 } }));
      return;
    }
    meta.mensajes.push({ to: p.to, tipo: p.type, plantilla: p.template?.name, texto: JSON.stringify(p) });
    r.writeHead(200, { "Content-Type": "application/json" });
    r.end(JSON.stringify({ messages: [{ id: `wamid.prueba${meta.mensajes.length}` }] }));
  }, meta.tarda));
});
await new Promise<void>((okk) => srv.listen(0, "127.0.0.1", () => okk()));
process.env.META_GRAPH_URL = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
process.env.WHATSAPP_ACCESS_TOKEN = "token-de-pruebas";
process.env.WHATSAPP_PHONE_NUMBER_ID = "100000000000001";
process.env.OWNER_WHATSAPP_ENABLED = "true";
process.env.BOOKING_CONFIRMACION_TEMPLATE = "aiteam_cita_confirmacion";
delete process.env.BOOKING_SIMULATE;

const B = await import(R + "booking.ts");
const T = await import(R + "tenants.ts");
const O = await import(R + "orchestrator.ts");
const AC = await import(R + "carmen-al-colgar.ts");
const SP = await import(R + "segundo-plano.ts");

const AITEAM = T.DEFAULT_TENANT_ID;
await T.upsertTenant({ ...(await T.getTenant(AITEAM))!, negocioAgenda: "demo", carmenPhoneNumber: "+34951870605", ownerWhatsapp: "34699123456" });
const demo = (await B.getBusinessBySlug("demo"))!;
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const suma = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const mani = demo.servicios.find((s: { nombre: string }) => /manicura/i.test(s.nombre))!;
const huecos: string[] = [];
for (let d = 2; d < 40 && huecos.length < 12; d++) {
  const r = await B.computeFreeSlots(demo, B.resolverServicio(mani, {}), suma(d), REDIR);
  if (r.ok && r.slots.length) huecos.push(r.slots[0]);
}
assert(huecos.length >= 8, `hay huecos para probar (${huecos.length})`);
const reservar = (startIso: string, extra: Record<string, unknown> = {}) => O.reservarSlot({
  tenantId: AITEAM, userEmail: "x", redirectUri: REDIR, nombre: "Prueba", motivo: "manicura", startIso,
  agenteOrigen: "carmen", customerPhone: "+34611222333", confirmarAlColgar: true, ...extra,
});

// ─── 2. SERVICIOS QUE NO EXISTEN ─────────────────────────────────────────────
assert(B.servicioPedido(demo, "blanqueamiento") === undefined, "«blanqueamiento» no es un servicio del salón");
assert(B.servicioPedido(demo, "una manicura")?.nombre === mani.nombre, "«una manicura» → Manicura");
assert(B.servicioPedido(demo, "extensiones de pestañas")?.nombre.startsWith("Extensiones"), "«extensiones de pestañas» → su servicio");
const raro = await reservar(huecos[0], { motivo: "blanqueamiento", customerPhone: "+34611000001" });
const recRaro = raro.ok ? await B.getRecord(raro.recordId!) : null;
assert(!!recRaro && recRaro.servicioNombre === "blanqueamiento" && !recRaro.serviceId, `nunca se guarda como el primero de la lista (${recRaro?.servicioNombre})`);
if (raro.ok) await B.cambiarEstadoRecord(raro.recordId!, "cancelada", REDIR, "demo");

// ─── 1. SOLO SE CONFIRMA LO QUE ESTÁ GUARDADO ────────────────────────────────
const r1 = await reservar(huecos[1]);
assert(r1.ok && !!r1.recordId, "la reserva devuelve la cita guardada (recordId)");
assert(r1.ok && await B.citaGuardada(r1.recordId, huecos[1]), "citaGuardada: la cita está en la agenda a esa hora");
assert(!(await B.citaGuardada(undefined, huecos[1])), "sin recordId no hay confirmación");
assert(!(await B.citaGuardada("bk_no_existe", huecos[1])), "una cita que no está en la agenda no se confirma");
assert(r1.ok && !(await B.citaGuardada(r1.recordId, huecos[2])), "ni si la hora guardada no es la pedida");
if (r1.ok) {
  await B.cambiarEstadoRecord(r1.recordId!, "cancelada", REDIR, "demo");
  assert(!(await B.citaGuardada(r1.recordId, huecos[1])), "ni si está anulada");
}

// ─── 3. RESERVAR NO ESPERA A LOS AVISOS ──────────────────────────────────────
await SP.esperarSegundoPlano();
meta.mensajes.length = 0;
let t = Date.now();
const r3 = await reservar(huecos[3], { confirmarAlColgar: false, customerPhone: "+34611000003", agenteOrigen: "pablo" });
const msReserva = Date.now() - t;
assert(r3.ok, "Pablo reserva");
assert(msReserva < 1000, `responde sin esperar a Meta (${msReserva} ms; cada mensaje tarda 1500 ms)`);
assert(meta.mensajes.length === 0, "en el momento de responder aún no ha salido ningún aviso");
await SP.esperarSegundoPlano();
const alDueno = meta.mensajes.filter((m) => m.to.endsWith("699123456"));
const alCliente = meta.mensajes.filter((m) => m.to.endsWith("611000003"));
assert(alDueno.length === 1 && alDueno[0].tipo === "text" && /Salón Bella/.test(alDueno[0].texto), `aviso al dueño: la plantilla vieja no existe → sale en texto (${alDueno.map((m) => m.tipo)})`);
assert(alCliente.length === 1 && alCliente[0].plantilla === "aiteam_cita_confirmacion", "y la confirmación al cliente, después");

// Meta caído: los avisos quedan pendientes y se reintentan.
meta.falla = true; meta.mensajes.length = 0;
const r4 = await reservar(huecos[4], { confirmarAlColgar: false, customerPhone: "+34611000004", agenteOrigen: "pablo" });
await SP.esperarSegundoPlano();
const pend = await SP.listarPendientes();
assert(r4.ok && pend.some((p: { recordId: string }) => p.recordId === (r4 as { recordId: string }).recordId), "con Meta caído, la cita se guarda y los avisos quedan pendientes");
meta.falla = false;
const re = await B.reintentarAvisosPendientes();
assert(re.enviados >= 1 && meta.mensajes.some((m) => m.to.endsWith("611000004")), `el cron los reintenta y salen (${JSON.stringify(re)})`);
assert(!(await SP.listarPendientes()).some((p: { recordId: string }) => p.recordId === (r4 as { recordId: string }).recordId), "y salen de la cola");

// El candado sigue: 12 a la vez al mismo hueco → entra una.
meta.tarda = 50;
const a_la = huecos[5];
const carrera = await Promise.all(Array.from({ length: 12 }, (_, i) => reservar(a_la, { customerPhone: `+3461100010${String(i).padStart(2, "0")}` })));
// En el salón demo la manicura la hacen dos profesionales: caben DOS a la vez, ni una más.
const capacidad = B.empleadosDeServicio(demo, mani.id).length;
assert(capacidad === 2, `la manicura la hacen ${capacidad} profesionales`);
assert(carrera.filter((x) => x.ok).length === capacidad, `12 a la vez al mismo hueco: entran ${capacidad}, una por profesional (${carrera.filter((x) => x.ok).length})`);
const enHueco = (await B.listRecordsDeNegocio("demo")).filter((r: { startIso: string; estado: string; empleadoId?: string }) => r.startIso.slice(0, 16) === a_la.slice(0, 16) && r.estado !== "cancelada");
assert(new Set(enHueco.map((r: { empleadoId?: string }) => r.empleadoId)).size === enHueco.length && enHueco.length === capacidad, "cada una con una profesional distinta: nadie tiene dos citas a la vez");
assert(carrera.filter((x) => !x.ok).every((x) => x.reason === "slot_taken"), "las demás reciben «ocupado»");
await SP.esperarSegundoPlano();

// ─── 5. UN SOLO WHATSAPP AL CLIENTE EN UNA LLAMADA DE CARMEN ─────────────────
meta.mensajes.length = 0;
const TEL = "+34611000005";
const t0 = Date.now();
const r5 = await reservar(huecos[6], { customerPhone: TEL });
await SP.esperarSegundoPlano();
const alCliente5 = () => meta.mensajes.filter((m) => m.to.endsWith("611000005"));
assert(r5.ok && alCliente5().length === 0, "durante la llamada: ningún WhatsApp al cliente (solo el aviso al dueño)");
const llamada = { call_id: "call_uno", from_number: TEL, to_number: "+34951870605", direction: "inbound", start_timestamp: t0 - 60_000, end_timestamp: Date.now() };
await AC.whatsappAlColgar(llamada);
await AC.whatsappAlColgar(llamada); // Retell repite el aviso
await SP.esperarSegundoPlano();
assert(alCliente5().length === 1 && alCliente5()[0].plantilla === "aiteam_cita_confirmacion", `al colgar: UNO solo en total (${alCliente5().length})`);

srv.close();
console.log(`\n=== ${ok}/${total} ===`);
process.exit(ok !== total ? 1 : 0);
