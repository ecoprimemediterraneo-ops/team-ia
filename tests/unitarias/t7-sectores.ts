const R = new URL("../../src/lib/", import.meta.url).href;
delete process.env.SUPABASE_URL; delete process.env.BOOKING_SIMULATE;
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
const D = await import(R + "sectores-demo.ts");
const T = await import(R + "tenants.ts");
// DENTAL: presupuesto con confirmación
const DA = await import(R + "dental-acciones.ts"); const P = await import(R + "presupuestos.ts");
const A = "tenant_clinica_a", B = "tenant_clinica_b";
let p = await DA.prepararCrearPresupuesto(A, { nombre: "Carlos Ruiz" });
assert(p.tipo === "nada", "dental: sin tratamiento no se prepara");
p = await DA.prepararCrearPresupuesto(A, { nombre: "Carlos Ruiz", tratamiento: "implante", importeEUR: 1200 });
assert(p.tipo === "propuesta", "dental: con datos se propone");
assert((await P.listarPresupuestos(A)).length === 0, "dental: proponer no escribe");
if (p.tipo === "propuesta") { const r = await DA.ejecutar(A, p.accion); assert(r.ok && /Hecho/.test(r.texto), "dental: al confirmar se ejecuta"); }
assert((await P.listarPresupuestos(A)).length === 1, "dental: queda guardado");
assert((await P.listarPresupuestos(B)).length === 0, "dental: aislado por clínica");
if (p.tipo === "propuesta") { const r = await DA.ejecutar(B, p.accion); assert(!r.ok, "dental: no se ejecuta en otra clínica"); }
// ESTÉTICA: lead
const EA = await import(R + "estetica-acciones.ts"); const EL = await import(R + "estetica-leads.ts");
let e = await EA.prepararCrearLead(A, { nombre: "Laura Gil", telefono: "600123123", tratamientoInteres: "botox", caliente: true });
assert(e.tipo === "propuesta", "estética: lead se propone");
assert((await EL.listarLeads(A)).length === 0, "estética: proponer no escribe");
if (e.tipo === "propuesta") { const r = await EA.ejecutar(A, e.accion); assert(r.ok, "estética: confirmar crea el lead"); }
assert((await EL.listarLeads(A)).length === 1 && (await EL.listarLeads(B)).length === 0, "estética: guardado y aislado");
// GESTORÍA: número por tenant
const W = await import(R + "tenant-whatsapp.ts");
await D.sembrarDemoConservando("tenant_demo_gestoria");
let w = await W.asignarNumeroWhatsapp("tenant_demo_gestoria", "123456789012");
assert(w.ok, "gestoría: se asigna número");
assert((await T.resolveTenantFromMeta({ whatsappPhoneNumberId: "123456789012" })) === "tenant_demo_gestoria", "gestoría: el número resuelve a su tenant");
w = await W.asignarNumeroWhatsapp("tenant_aiteam", "999999999999");
assert(!w.ok, "gestoría: la cuenta propia no se toca");
assert((await T.resolveTenantFromMeta({ whatsappPhoneNumberId: "000000000001" })) === null, "gestoría: número desconocido no se atiende");
assert(await T.agendaCitasDeTenant("tenant_demo_gestoria") === false, "gestoría: no agenda citas de clientes");
await D.sembrarDemoConservando("tenant_demo_salon");
assert(await T.agendaCitasDeTenant("tenant_demo_salon") === true, "salón: sí agenda (causa de las pruebas 1 y 4)");
console.log(`\n=== ${ok}/${total} ===`);
