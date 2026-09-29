// PABLO EN EL SALÓN DE DEMO (tenant_aiteam → Salón Bella), de punta a punta por
// el webhook firmado como Meta. Envío SIMULADO: todo lo que "sale" acaba en el
// Graph falso. Los casos de la auditoría del 29/09/2026: en cada uno se mira qué
// contesta Y qué queda de verdad en la agenda.
import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BASE, esperarWhatsapps, whatsappsA, llamadasGraph, movilNuevo, diaLaborable, fechaHablada, horas } from "./ayuda";

const DATA = path.join(process.cwd(), "data");
const TEN = "tenant_aiteam";
const DUENO = "34699123456";
const leer = (f: string) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf-8"));
let PHONE_ID = "";
let SERVICIOS: string[] = [];

type Rec = { startIso: string; estado: string; servicioNombre: string; slug: string; cliente: { telefono: string; nombre: string }; empleadoId?: string };
const citasDe = (movil: string): Rec[] => (Object.values(leer("booking-records.json")) as Rec[])
  .filter((r) => r.slug === "demo" && r.cliente?.telefono?.replace(/\D/g, "").endsWith(movil.slice(-9)));
const activas = (movil: string) => citasDe(movil).filter((r) => r.estado !== "cancelada");
const PROHIBIDO = /AI-Team|Bendito|cl[ií]nica|tratamientos faciales o corporales/i;

async function escribir(desde: string, mensaje: string | Record<string, unknown>, nombre = "Cliente Demo"): Promise<string[]> {
  const antes = (await whatsappsA(desde)).length;
  const msg = typeof mensaje === "string" ? { type: "text", text: { body: mensaje } } : mensaje;
  const cuerpo = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "waba-demo", changes: [{ field: "messages", value: {
    messaging_product: "whatsapp", metadata: { display_phone_number: "34000000000", phone_number_id: PHONE_ID },
    contacts: [{ profile: { name: nombre }, wa_id: desde }],
    messages: [{ from: desde, id: `wamid.demo.${crypto.randomUUID()}`, timestamp: String(Math.floor(Date.now() / 1000)), ...msg }] } }] }] });
  const s = process.env.META_APP_SECRET;
  const r = await fetch(`${BASE}/api/pablo/webhook`, { method: "POST", headers: { "Content-Type": "application/json", ...(s ? { "x-hub-signature-256": `sha256=${crypto.createHmac("sha256", s).update(cuerpo).digest("hex")}` } : {}) }, body: cuerpo });
  expect(r.status).toBe(200);
  await esperarWhatsapps(desde, antes + 1);
  await new Promise((ok) => setTimeout(ok, 2000)); // por si manda un segundo mensaje
  return (await whatsappsA(desde)).slice(antes).map((x) => x.texto);
}
async function libres(serviceId: string, fecha: string): Promise<string[]> {
  const j = await (await fetch(`${BASE}/api/booking/demo/slots?serviceId=${serviceId}&date=${fecha}`)).json();
  return ((j.slots as string[]) || []).map((x) => x.slice(11, 16));
}

test.beforeAll(() => {
  // La cuenta propia se presenta como el negocio demo y avisa al WhatsApp del dueño.
  const t = leer("tenants.json");
  t[TEN] = { ...t[TEN], negocioAgenda: "demo", ownerWhatsapp: DUENO, carmenPhoneNumber: t[TEN].carmenPhoneNumber || "+34951870605" };
  fs.writeFileSync(path.join(DATA, "tenants.json"), JSON.stringify(t, null, 2));
  PHONE_ID = t[TEN].whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  SERVICIOS = leer("booking-configs.json").demo.servicios.filter((s: { activo: boolean }) => s.activo).map((s: { nombre: string }) => s.nombre);
  expect(PHONE_ID, "la cuenta propia tiene número de WhatsApp").toBeTruthy();
});

test("P1. Cita con día y hora: UN mensaje con la cita guardada", async () => {
  const D = diaLaborable(0), m = movilNuevo();
  const r = await escribir(m, `Hola, soy Laura Prueba. Quiero una manicura ${fechaHablada(D)} a las 10:00`);
  expect(r.length, `un solo mensaje: ${JSON.stringify(r)}`).toBe(1);
  expect(r[0]).toMatch(/Te he guardado la cita en \*Salón Bella\*: \*Manicura\*/);
  expect(r[0]).toContain("/reservas/cancelar/");
  expect(r[0]).not.toMatch(PROHIBIDO);
  const c = activas(m);
  expect(c.length).toBe(1);
  expect(c[0].startIso.slice(0, 16)).toBe(`${D}T10:00`);
  expect(c[0].servicioNombre).toBe("Manicura");
});

test("P2. Sin hora: huecos REALES de ese día y reserva el elegido", async () => {
  const D = diaLaborable(1), m = movilNuevo();
  const r1 = await escribir(m, `Hola, soy Marta Prueba. Quería una limpieza facial ${fechaHablada(D)}, ¿qué horas tenéis?`);
  const ofrecidas = horas(r1.join(" "));
  expect(ofrecidas.length, `ofrece dos horas: ${r1}`).toBeGreaterThanOrEqual(2);
  const hay = await libres("svc_limpieza", D);
  for (const h of ofrecidas.slice(0, 2)) expect(hay, `la hora ofrecida ${h} está libre`).toContain(h);
  expect(activas(m).length, "todavía no ha reservado nada").toBe(0);
  const r2 = await escribir(m, "La primera que me dices");
  expect(r2.join(" ")).toMatch(/Te he guardado la cita/);
  expect(activas(m).map((c) => c.startIso.slice(0, 16))).toEqual([`${D}T${ofrecidas[0]}`]);
});

test("P3. Hueco ocupado: dos alternativas libres y nada guardado", async () => {
  const D = diaLaborable(2);
  // Las dos profesionales ocupadas a las 10:00 (dos clientas por el mismo WhatsApp).
  await escribir(movilNuevo(), `Hola, soy Ocupa Uno. Quiero una manicura ${fechaHablada(D)} a las 10:00`);
  await escribir(movilNuevo(), `Hola, soy Ocupa Dos. Quiero una manicura ${fechaHablada(D)} a las 10:00`);
  const m = movilNuevo();
  const r = await escribir(m, `Hola, soy Nuria Prueba. Quiero una manicura ${fechaHablada(D)} a las 10:00`);
  expect(r.join(" ")).toMatch(/no me queda hueco/);
  const hay = await libres("svc_mani", D);
  for (const h of horas(r.join(" ")).filter((x) => x !== "10:00").slice(0, 2)) expect(hay).toContain(h);
  expect(activas(m).length).toBe(0);
});

test("P4. Domingo y fuera de horario: lo dice y no guarda nada", async () => {
  let dom = diaLaborable(0);
  while (new Date(`${dom}T12:00:00Z`).getUTCDay() !== 0) dom = new Date(Date.parse(`${dom}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10);
  const m1 = movilNuevo();
  const r1 = await escribir(m1, `Hola, soy Eva Prueba. ¿Me das cita para una pedicura ${fechaHablada(dom)} a las 11:00?`);
  expect(r1.join(" ")).toMatch(/cerrad/i);
  expect(activas(m1).length).toBe(0);
  const m2 = movilNuevo();
  const r2 = await escribir(m2, `Hola, soy Rosa Prueba. Quiero una manicura ${fechaHablada(diaLaborable(3))} a las 22:00`);
  expect(r2.join(" ")).toMatch(/no estamos abiertos/);
  expect(activas(m2).length).toBe(0);
});

test("P5. Servicio que no existe: lo dice, lista los reales y no apunta otro", async () => {
  const m = movilNuevo();
  const r = await escribir(m, `Hola, soy Ana Prueba. Quiero un blanqueamiento dental ${fechaHablada(diaLaborable(3))} a las 11:00`);
  const t = r.join(" ");
  expect(t).toMatch(/no lo hacemos en Salón Bella/i);
  for (const s of SERVICIOS) expect(t).toContain(s);
  expect(t).not.toMatch(PROHIBIDO);
  expect(citasDe(m).length, "no se guarda nada, ni como otro servicio").toBe(0);
});

test("P6+P7. Cambiar y anular la cita desde el chat", async () => {
  const D = diaLaborable(4), m = movilNuevo();
  await escribir(m, `Hola, soy Lola Prueba. Quiero una manicura ${fechaHablada(D)} a las 10:00`);
  expect(activas(m).length).toBe(1);
  const r1 = await escribir(m, "¿Puedo cambiar mi cita de la manicura a las 12:00 del mismo día?");
  expect(r1.join(" ")).toMatch(/te paso Manicura al /);
  expect(activas(m).map((c) => c.startIso.slice(0, 16))).toEqual([`${D}T12:00`]);
  const r2 = await escribir(m, "Al final no puedo ir, anúlame la cita por favor");
  expect(r2.join(" ")).toMatch(/Cancelo tu cita/);
  expect(activas(m).length, "pide confirmación antes de anular").toBe(1);
  await escribir(m, "Sí");
  expect(activas(m).length).toBe(0);
});

test("P8. Precio, horario y dirección de la ficha", async () => {
  const r = await escribir(movilNuevo(), "¿Cuánto cuesta la pedicura? ¿Qué horario tenéis y dónde estáis?");
  const t = r.join(" ");
  expect(t).toContain("28");
  expect(t).toMatch(/Ricardo Soriano/);
  expect(t).not.toMatch(PROHIBIDO);
});

test("P9. En inglés: contesta en inglés y guarda el servicio real", async () => {
  const D = diaLaborable(5), m = movilNuevo();
  const r = await escribir(m, `Hi! Can I book a manicure on ${D} at 5pm? My name is Kate Test.`);
  expect(r.join(" ")).toMatch(/Your appointment at \*Salón Bella\* is booked: \*Manicura\*/);
  expect(activas(m).map((c) => `${c.startIso.slice(0, 16)} ${c.servicioNombre}`)).toEqual([`${D}T17:00 Manicura`]);
});

test("P10. Pide una persona / urgencia: avisa al móvil del dueño", async () => {
  const alDueno = async () => (await llamadasGraph()).filter((l) => (l.cuerpo as { to?: string })?.to === DUENO).length;
  const n0 = await alDueno();
  const r1 = await escribir(movilNuevo(), "Quiero hablar con una persona, por favor");
  expect(r1.join(" ")).toMatch(/responsable/);
  expect(await alDueno()).toBe(n0 + 1);
  const r2 = await escribir(movilNuevo(), "Me hice las pestañas ayer y tengo una reacción alérgica fuerte en el ojo, es urgente");
  expect(r2.join(" ")).toMatch(/avisar al responsable|urgencias/);
  expect(await alDueno()).toBe(n0 + 2);
});

test("P11. Nota de voz que no se puede escuchar: pide que lo escriba", async () => {
  const r = await escribir(movilNuevo(), { type: "audio", audio: { id: "media-demo", mime_type: "audio/ogg; codecs=opus" } });
  expect(r.join(" ")).toMatch(/No he podido escuchar ese audio/);
});
