// CIERRE DE CARMEN: lo que se configuró el 29/09/2026.
//   1. Frases de espera: todas las funciones de Carmen hablan mientras trabajan,
//      con varias frases que se alternan.
//   2. Identidad única: Carmen y Pablo se presentan como el salón de demo
//      (negocioAgenda=demo), con nombre, dirección, horario y servicios de SU
//      ficha, sin "AI-Team", "Bendito Arte" ni "clínica".
//   3. WhatsApp al colgar: solo si en la llamada se cogió, cambió o anuló una
//      cita; uno por cita y sin repetir aunque Retell reenvíe el aviso.
//   4. Informe semanal: la cuenta propia (sin sector, con negocio de agenda)
//      entra en el informe, y el envío solo sale con el interruptor puesto.
// Todo contra el código real, con WhatsApp simulado (sin META_GRAPH_URL): se
// captura lo que se habría mandado a Meta.
const R = new URL("../../src/lib/", import.meta.url).href;
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };

process.env.WHATSAPP_ACCESS_TOKEN = "token-de-pruebas";
process.env.WHATSAPP_PHONE_NUMBER_ID = "100000000000001";
delete process.env.BOOKING_SIMULATE;
delete process.env.CARMEN_INFORME_SEND_ENABLED;

// Lo que habría salido hacia Meta (el envío simulado lo escribe en console.warn).
const enviados: { to: string; tipo: string; plantilla?: string; texto: string }[] = [];
const warnOriginal = console.warn;
console.warn = (...a: unknown[]) => {
  const s = a.map(String).join(" ");
  const i = s.indexOf("{");
  if (s.includes("Mensaje simulado") && i >= 0) {
    try {
      const p = JSON.parse(s.slice(i));
      enviados.push({ to: p.to, tipo: p.type, plantilla: p.template?.name, texto: JSON.stringify(p) });
    } catch { /* noop */ }
    return;
  }
  warnOriginal(...a);
};

const CFG = await import(new URL("../../scripts/carmen-retell-config.mjs", import.meta.url).href);
const B = await import(R + "booking.ts");
const T = await import(R + "tenants.ts");
const O = await import(R + "orchestrator.ts");
const P = await import(R + "persona.ts");
const AC = await import(R + "carmen-al-colgar.ts");
const C = await import(R + "carmen-llamadas.ts");
const EV = await import(R + "event-log.ts");

const PROHIBIDO = /AI-Team|Bendito|cl[ií]nica|paciente|dental/i;

// ─── 1. FRASES DE ESPERA ──────────────────────────────────────────────────────
for (const f of ["agendar_cita", "gestionar_cita", "cancelar", "urgencia"]) {
  const frases: string[] = CFG.FRASES_ESPERA[f] || [];
  assert(frases.length >= 2 && new Set(frases).size === frases.length, `${f}: ${frases.length} frases de espera distintas`);
  const d: string = CFG.descripcionEspera(frases);
  assert(frases.every((x) => d.includes(x)) && /No repitas/.test(d), `${f}: la descripción de Retell lleva las frases y pide alternarlas`);
}
assert(CFG.FRASES_ESPERA.agendar_cita.some((x: string) => /momentito que lo miro en la agenda/.test(x)), "agendar_cita: «dame un momentito que lo miro en la agenda»");
assert(/NUNCA TE QUEDES CALLADA/.test(CFG.PROMPT) && /no digas dos veces seguidas la misma/.test(CFG.PROMPT), "el prompt prohíbe el silencio y repetir la frase de espera");

// ─── 2. IDENTIDAD ÚNICA ──────────────────────────────────────────────────────
assert(!PROHIBIDO.test(CFG.PROMPT), "prompt de Carmen sin AI-Team, Bendito Arte, clínica ni paciente");
assert(["{{negocio}}", "{{direccion}}", "{{horario}}", "{{servicios}}"].every((v) => CFG.PROMPT.includes(v)), "los datos del salón llegan por variables, no por texto fijo");
assert(/al salón\.$/.test(CFG.FRASE_TRANSFERENCIA) && !PROHIBIDO.test(CFG.FRASE_TRANSFERENCIA), `transferencia: «${CFG.FRASE_TRANSFERENCIA}»`);
assert(/SOLO si devuelve success=true/.test(CFG.PROMPT) && /NUNCA digas que está confirmada/.test(CFG.PROMPT), "Carmen solo confirma si agendar_cita devuelve success=true");
assert(/no está entre los servicios del salón/.test(CFG.PROMPT), "Carmen ofrece los servicios que sí hay si piden otro");
assert(/urgente=true, usa pasar_al_responsable/.test(CFG.PROMPT) && /hablar con una persona/.test(CFG.PROMPT), "el prompt mantiene la transferencia (urgencias y persona)");

const AITEAM = T.DEFAULT_TENANT_ID;
const propia = (await T.getTenant(AITEAM))!;
const demo = (await B.getBusinessBySlug("demo"))!;
assert(demo?.tenantId === AITEAM && demo.nombre === "Salón Bella", `el negocio demo es de la cuenta propia y se llama "${demo?.nombre}"`);
const antes = await P.resolverPersona({ tenantId: AITEAM, agente: "pablo", canal: "whatsapp" });
assert(antes.sector === null, "sin negocio de agenda fijado, la cuenta propia sigue siendo la comercial");

await T.upsertTenant({ ...propia, negocioAgenda: "demo", carmenPhoneNumber: "+34951870605", ownerWhatsapp: "34699123456" });
for (const agente of ["pablo", "carmen"] as const) {
  const p = await P.resolverPersona({ tenantId: AITEAM, agente, canal: agente === "pablo" ? "whatsapp" : "voz" as never });
  assert(p.sector === "salon", `${agente}: atiende como salón`);
  assert(p.system.includes("Trabajas en Salón Bella, en Marbella"), `${agente}: se presenta como Salón Bella`);
  assert(p.system.includes(`Dirección: ${demo.direccion}`) && p.system.includes(`Horario: ${P.horarioHablado(demo.horario)}`), `${agente}: dirección y horario de la ficha`);
  assert(demo.servicios.filter((s: { activo?: boolean }) => s.activo !== false).every((s: { nombre: string }) => p.system.includes(s.nombre)), `${agente}: todos los servicios de la ficha`);
  const fuera = p.system.match(PROHIBIDO);
  assert(!fuera, `${agente}: sin AI-Team, Bendito Arte ni clínica${fuera ? ` (aparece "${fuera[0]}")` : ""}`);
}
assert(await T.agendaCitasDeTenant(AITEAM), "Pablo agenda citas en la cuenta propia (negocio de agenda fijado)");
const h = P.horarioHablado(demo.horario);
assert(/^lunes a viernes de \d\d:\d\d a \d\d:\d\d.*; domingo cerrado$/.test(h) || /^lunes a sábado de .*; domingo cerrado$/.test(h), `horario hablado agrupado por días («${h}»)`);

// ─── 3. WHATSAPP AL COLGAR ───────────────────────────────────────────────────
process.env.BOOKING_CONFIRMACION_TEMPLATE = "aiteam_cita_confirmacion";
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const suma = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const sv = demo.servicios.find((s: { id: string }) => s.id === "svc_mani") || demo.servicios[0];
const sel = B.resolverServicio(sv, {});
let huecos: string[] = [];
for (let d = 2; d < 20 && huecos.length < 4; d++) {
  const r = await B.computeFreeSlots(demo, sel, suma(d), REDIR);
  if (r.ok) huecos = r.slots;
}
assert(huecos.length >= 4, `hay huecos en el salón (${huecos.length})`);

const TEL = "+34611222333";
const llamada = (id: string, extra: Record<string, unknown> = {}) => ({
  call_id: id, from_number: TEL, to_number: "+34951870605", direction: "inbound",
  start_timestamp: Date.now() - 5 * 60_000, end_timestamp: Date.now(), ...extra,
});
const aTel = () => enviados.filter((e) => e.to.replace(/\D/g, "").endsWith("611222333"));

let n0 = aTel().length;
const res = await O.reservarSlot({ tenantId: AITEAM, userEmail: "x", redirectUri: REDIR, nombre: "Lucía Prueba", motivo: sv.nombre,
  startIso: huecos[1], agenteOrigen: "carmen", customerPhone: TEL, confirmarAlColgar: true });
assert(res.ok, `Carmen coge la cita en la llamada (${res.ok ? "ok" : (res as { reason: string }).reason})`);
assert(aTel().length === n0, "durante la llamada el cliente no recibe nada");

let r1 = await AC.whatsappAlColgar(llamada("call_1"));
assert(r1.avisos.length === 1 && r1.avisos[0].tipo === "creada" && r1.avisos[0].enviado, `al colgar: 1 confirmación (${JSON.stringify(r1.avisos.map((a) => a.tipo))})`);
const conf = aTel().slice(n0);
assert(conf.length === 1 && conf[0].plantilla === "aiteam_cita_confirmacion", `por la plantilla aprobada (${conf[0]?.plantilla})`);
assert(/Salón Bella/.test(conf[0]?.texto) && /Av\. Ricardo Soriano 42/.test(conf[0]?.texto) && conf[0]?.texto.includes(sv.nombre), "con negocio, dirección y servicio de la ficha");
assert(/"sub_type":"url"/.test(conf[0]?.texto), "con el botón de anular o cambiar");
assert(!PROHIBIDO.test(conf[0]?.texto || ""), "la confirmación no dice Bendito Arte, clínica ni AI-Team");

n0 = aTel().length;
const r2 = await AC.whatsappAlColgar(llamada("call_1"));
assert(aTel().length === n0 && r2.avisos.every((a) => !a.enviado && a.modo === "ya_enviado"), "Retell repite el aviso: no se manda dos veces");

// Llamada sin tocar citas (otro teléfono): nada.
n0 = enviados.length;
const r3 = await AC.whatsappAlColgar({ ...llamada("call_2"), from_number: "+34622333444" });
assert(r3.motivo === "sin_citas" && enviados.length === n0, "llamada sin cita: no se envía nada");
// Llamada saliente (recordatorio): nada.
const r4 = await AC.whatsappAlColgar({ ...llamada("call_3"), direction: "outbound" });
assert(r4.motivo === "saliente" && enviados.length === n0, "llamada saliente: no se envía nada");

// Se cambia la cita en OTRA llamada, días después → confirmación con la hora nueva.
const rec = (await B.citasActivasDeCliente("demo", TEL))[0];
await B.actualizarRecord(rec.id, "prueba", (f: { creadaEn: string }) => ({ ...f, creadaEn: new Date(Date.now() - 3 * 86400_000).toISOString() }));
await new Promise((ok) => setTimeout(ok, 5));
const inicio2 = Date.now();
const mov = await B.reprogramarRecord(rec.id, huecos[3], undefined, REDIR, "demo");
assert(mov.ok, "Carmen cambia la cita de hora");
n0 = aTel().length;
const r5 = await AC.whatsappAlColgar(llamada("call_4", { start_timestamp: inicio2 - 1000 }));
const cambio = aTel().slice(n0);
if (!(r5.avisos.length === 1 && r5.avisos[0].tipo === "cambiada")) console.log("  r5:", JSON.stringify(r5), JSON.stringify({ rep: (await B.getRecord(rec.id))?.reprogramadaEn, ini: new Date(inicio2).toISOString() }));
assert(r5.avisos.length === 1 && r5.avisos[0].tipo === "cambiada" && cambio.length === 1 && cambio[0].plantilla === "aiteam_cita_confirmacion", "al colgar: confirmación de la cita cambiada");

// Se anula en otra llamada → aviso de anulación.
const inicio3 = Date.now();
const anu = await B.cambiarEstadoRecord(rec.id, "cancelada", REDIR, "demo");
assert(anu.ok, "Carmen anula la cita");
n0 = aTel().length;
const r6 = await AC.whatsappAlColgar(llamada("call_5", { start_timestamp: inicio3 - 1000 }));
const aviso = aTel().slice(n0);
if (!(r6.avisos.length === 1 && r6.avisos[0].tipo === "anulada")) console.log("  r6:", JSON.stringify(r6));
assert(r6.avisos.length === 1 && r6.avisos[0].tipo === "anulada" && aviso.length === 1 && /anulada/i.test(aviso[0].texto), "al colgar: aviso de anulación");

// ─── 4. INFORME SEMANAL ──────────────────────────────────────────────────────
await (await import(R + "segundo-plano.ts")).esperarSegundoPlano(); // el registro de la cita va después de responder
await EV.logEvent(AITEAM, { id: EV.makeEventId("carmen_llamada", "call_1"), type: "message_in", channel: "carmen", senderId: TEL, meta: { kind: "llamada", texto: "prueba" } });
const inf = await C.informeSemanal(AITEAM);
assert(inf.llamadas >= 1 && /llamada/i.test(inf.texto), `informe: ${inf.llamadas} llamada(s), ${inf.citas} cita(s), ${inf.euros} €`);
assert(inf.citas >= 1, "la cita cerrada esta semana cuenta aunque sea para otro día (por cuándo se cerró, no por su fecha)");
assert(/Salón Bella/.test(inf.texto) && !PROHIBIDO.test(inf.texto), "el informe habla de Salón Bella");
const ruta = await import(new URL("../../src/app/api/cron/carmen-informe-semanal/route.ts", import.meta.url).href);
let j = await (await ruta.GET(new Request("http://localhost/api/cron/carmen-informe-semanal?tenant=tenant_aiteam"))).json();
assert(j.informes.length === 1 && j.informes[0].tenant === AITEAM, "la cuenta propia (negocio de agenda, sin sector) entra en el informe");
assert(!j.enviar && j.informes[0].envio.enviado === false, "sin CARMEN_INFORME_SEND_ENABLED no se envía");
process.env.CARMEN_INFORME_SEND_ENABLED = "true";
process.env.CARMEN_INFORME_TEMPLATE = "aiteam_informe_semanal";
n0 = enviados.length;
j = await (await ruta.GET(new Request("http://localhost/api/cron/carmen-informe-semanal?tenant=tenant_aiteam"))).json();
const inform = enviados.slice(n0);
if (inform.length !== 1) console.log("  informe:", JSON.stringify(j).slice(0, 600), JSON.stringify(inform.map((e) => [e.to, e.plantilla])));
assert(inform.length === 1 && inform[0].plantilla === "aiteam_informe_semanal" && inform[0].to.endsWith("699123456"), "con el interruptor: sale por plantilla y SOLO al WhatsApp del dueño");

console.warn = warnOriginal;
console.log(`\n=== ${ok}/${total} ===`);
process.exit(ok !== total ? 1 : 0);
