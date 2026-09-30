// UN SOLO FORMATO DE TELÉFONO (30/09/2026): la misma clienta llamaba por voz
// (+34656989373, Carmen) y escribía por WhatsApp (34656989373, Pablo) y salía
// dos veces en la agenda. Ahora todo se guarda en E.164 y memoria, olvido,
// lista de espera y reseñas la encuentran igual venga por donde venga.
const R = new URL("../../src/lib/", import.meta.url).href;
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
delete process.env.BOOKING_SIMULATE; delete process.env.VERCEL; delete process.env.META_GRAPH_URL;
const TEL = await import(R + "telefono.ts");
const B = await import(R + "booking.ts");
const D = await import(R + "sectores-demo.ts");
const O = await import(R + "orchestrator.ts");
const M = await import(R + "memoria-clienta.ts");
const RS = await import(R + "resena-whatsapp.ts");
const W = await import(R + "booking-waitlist.ts");

console.log("\n--- aE164 ---");
for (const [in_, out] of [["+34656989373", "+34656989373"], ["34656989373", "+34656989373"], ["656 98 93 73", "+34656989373"], ["0034656989373", "+34656989373"], ["+44 7700 900123", "+447700900123"], ["", ""]]) {
  assert(TEL.aE164(in_) === out, `«${in_}» → «${out}» (sale «${TEL.aE164(in_)}»)`);
}

const TEN = "tenant_demo_salon";
await D.sembrarDemoConservando(TEN);
const neg = await B.getBusinessByTenant(TEN);
const slug = neg.slug;
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const sumar = (f: string, n: number) => new Date(Date.parse(`${f}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
let DIA = sumar(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }), 3);
while ([0, 6].includes(new Date(`${DIA}T12:00:00Z`).getUTCDay())) DIA = sumar(DIA, 1);
const reservar = (hora: string, tel: string, agente: string) =>
  O.reservarSlot({ tenantId: TEN, userEmail: "x", redirectUri: REDIR, nombre: "Rosa Pérez", motivo: "corte", startIso: `${DIA}T${hora}:00`, agenteOrigen: agente, customerPhone: tel, confirmacionEnConversacion: true });

console.log("\n--- Citas por voz y por WhatsApp ---");
const c1 = await reservar("10:00", "+34656989373", "carmen");
const c2 = await reservar("12:00", "34656989373", "pablo");
assert(c1.ok && c2.ok, "Carmen y Pablo reservan a la misma clienta");
const suyas = (await B.listRecordsDeNegocio(slug)).filter((r: { cliente: { nombre: string } }) => r.cliente.nombre === "Rosa Pérez");
assert(suyas.length === 2 && suyas.every((r: { cliente: { telefono: string } }) => r.cliente.telefono === "+34656989373"), `las dos citas guardan «+34656989373» (${suyas.map((r: { cliente: { telefono: string } }) => r.cliente.telefono).join(", ")})`);
const clientes = (await B.listClientes(slug)).filter((c: { nombre: string }) => c.nombre === "Rosa Pérez");
assert(clientes.length === 1, "en Clientas sale UNA sola Rosa");

console.log("\n--- Memoria y olvido ---");
await M.aprenderDeMensaje(slug, "34656989373", "prefiero por la tarde");
assert((await M.leerMemoria(slug, "+34656989373")).franja === "tarde", "lo que dijo por WhatsApp lo recuerda Carmen por voz");
assert((await M.leerMemoria(slug, "+34656989373")).ultimos.length === 2, "la memoria ve sus dos citas (voz + WhatsApp)");
await M.olvidarClienta({ slug, tenantId: TEN, telefono: "+34656989373" });
assert(!(await M.leerMemoria(slug, "34656989373")).franja, "«olvídame» por voz la olvida también en WhatsApp");

console.log("\n--- Reseñas ---");
await RS.marcarPedida(slug, "+34656989373");
assert(await RS.pedidaHaceNada(slug, "34656989373"), "pedida por un canal, se reconoce por el otro");
assert(!RS.puedePedirse(await RS.listarPedidas(slug), "656989373"), "no se le vuelve a pedir aunque el número venga sin prefijo");
await RS.marcarQueja(slug, "34656989373");
assert(!!(await RS.listarQuejas(slug))["+34656989373"], "la queja queda en E.164");

console.log("\n--- Lista de espera ---");
const e = await B.crearEspera({ slug, serviceId: suyas[0].serviceId, fecha: DIA, horaPedida: "16:00", cliente: { nombre: "Rosa Pérez", telefono: "34656989373" } });
assert(e.ok && (await B.listEspera(slug)).some((x: { cliente: { telefono: string } }) => x.cliente.telefono === "+34656989373"), "la lista de espera la guarda en E.164");
void W;

console.log(`\n=== ${ok}/${total} ===`);
