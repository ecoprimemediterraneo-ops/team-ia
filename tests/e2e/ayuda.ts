// Utilidades de las pruebas de punta a punta: simular los webhooks con la forma
// exacta que manda Meta / Retell, leer lo que ha "salido" hacia el Graph falso
// y consultar la agenda del salón de pruebas.
import crypto from "node:crypto";
import type { Llamada } from "./graph-falso";

export const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
export const GRAPH = "http://127.0.0.1:4545";
/** Contraseña del dueño de pruebas. El usuario se borra al acabar cada tanda. */
export const PASSWORD = "prueba-e2e-local";

export const E2E = {
  tenantId: "tenant_e2e",
  slug: "e2e-salon",
  usuario: "e2e_dueno",
  waPhoneId: "e2e-phone-id",
  igUserId: "e2e-ig-id",
  carmenNumero: "+34900000999",
} as const;

export function admin(): Record<string, string> {
  return process.env.ADMIN_DEV_TOKEN ? { "x-e2e-token": process.env.ADMIN_DEV_TOKEN } : {};
}

/** Un móvil distinto en cada prueba: así ninguna hereda la memoria de otra. */
export function movilNuevo(): string {
  return `3461${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

// -----------------------------------------------------------------------------
// Fechas: siempre un día laborable (martes a viernes) a unos días vista, para
// no depender de la hora a la que se lancen las pruebas.
// -----------------------------------------------------------------------------
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function hoyMadrid(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
}
export function sumarDias(f: string, n: number): string {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** El n-ésimo día laborable (mar–vie) a partir de pasado mañana. */
export function diaLaborable(n = 0): string {
  let f = sumarDias(hoyMadrid(), 2);
  let vistos = 0;
  for (;;) {
    const wd = new Date(`${f}T12:00:00Z`).getUTCDay();
    if (wd >= 2 && wd <= 5) { if (vistos === n) return f; vistos++; }
    f = sumarDias(f, 1);
  }
}
export function diasHasta(f: string): number {
  return Math.round((Date.parse(`${f}T12:00:00Z`) - Date.parse(`${hoyMadrid()}T12:00:00Z`)) / 86_400_000);
}
/** "el martes 6 de octubre" */
export function fechaHablada(f: string): string {
  const d = new Date(`${f}T12:00:00Z`);
  return `el ${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

// -----------------------------------------------------------------------------
// Webhooks simulados
// -----------------------------------------------------------------------------
function firmar(cuerpo: string): Record<string, string> {
  const s = process.env.META_APP_SECRET;
  return s ? { "x-hub-signature-256": `sha256=${crypto.createHmac("sha256", s).update(cuerpo).digest("hex")}` } : {};
}

/** Un WhatsApp entrante a Pablo, con la forma exacta de Meta. */
export async function whatsapp(desde: string, texto: string, nombre = "Cliente E2E"): Promise<void> {
  const cuerpo = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{
      id: "waba-e2e",
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { display_phone_number: "34900000999", phone_number_id: E2E.waPhoneId },
          contacts: [{ profile: { name: nombre }, wa_id: desde }],
          messages: [{ from: desde, id: `wamid.e2e.${crypto.randomUUID()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: texto } }],
        },
      }],
    }],
  });
  const r = await fetch(`${BASE}/api/pablo/webhook`, { method: "POST", headers: { "Content-Type": "application/json", ...firmar(cuerpo) }, body: cuerpo });
  if (r.status !== 200) throw new Error(`webhook de Pablo devolvió ${r.status}`);
}

/** Un DM de Instagram entrante a Marta. */
export async function instagramDM(igsid: string, texto: string): Promise<void> {
  const cuerpo = JSON.stringify({
    object: "instagram",
    entry: [{ id: E2E.igUserId, time: Date.now(), messaging: [{ sender: { id: igsid }, recipient: { id: E2E.igUserId }, timestamp: Date.now(), message: { mid: `mid.e2e.${crypto.randomUUID()}`, text: texto } }] }],
  });
  const r = await fetch(`${BASE}/api/marta/webhook`, { method: "POST", headers: { "Content-Type": "application/json", ...firmar(cuerpo) }, body: cuerpo });
  if (r.status !== 200) throw new Error(`webhook de Marta devolvió ${r.status}`);
}

/** Un comentario en un post, entrante a Marta. */
export async function instagramComentario(commentId: string, desde: string, usuario: string, texto: string): Promise<void> {
  const cuerpo = JSON.stringify({
    object: "instagram",
    entry: [{ id: E2E.igUserId, time: Date.now(), changes: [{ field: "comments", value: { id: commentId, text: texto, from: { id: desde, username: usuario }, media: { id: "media_e2e" } } }] }],
  });
  const r = await fetch(`${BASE}/api/marta/webhook`, { method: "POST", headers: { "Content-Type": "application/json", ...firmar(cuerpo) }, body: cuerpo });
  if (r.status !== 200) throw new Error(`webhook de Marta devolvió ${r.status}`);
}

/** Lo que Retell manda a la función `agendar_cita` de Carmen durante la llamada. */
export async function carmenAgendar(args: Record<string, unknown>, desde = "+34611000000"): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(`${BASE}/api/carmen/agendar?secret=${encodeURIComponent(process.env.CARMEN_WEBHOOK_SECRET || "")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ call: { call_id: `call_e2e_${Date.now()}`, from_number: desde, to_number: E2E.carmenNumero }, args }),
  });
  return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

// -----------------------------------------------------------------------------
// Lo que ha salido hacia Meta, y la agenda
// -----------------------------------------------------------------------------
export async function llamadasGraph(): Promise<Llamada[]> {
  return (await fetch(`${GRAPH}/__llamadas`)).json();
}
/** Los WhatsApp de texto que se han mandado a `a`, en orden. */
export async function whatsappsA(a: string): Promise<{ texto: string; ruta: string }[]> {
  return (await llamadasGraph())
    .filter((l) => l.metodo === "POST" && (l.cuerpo as { to?: string })?.to === a)
    .map((l) => ({ ruta: l.ruta, texto: String((l.cuerpo as { text?: { body?: string } })?.text?.body ?? JSON.stringify(l.cuerpo)) }));
}
/** Espera a que haya al menos `n` WhatsApps para `a`. */
export async function esperarWhatsapps(a: string, n: number, ms = 60_000): Promise<{ texto: string; ruta: string }[]> {
  const fin = Date.now() + ms;
  for (;;) {
    const w = await whatsappsA(a);
    if (w.length >= n || Date.now() > fin) return w;
    await new Promise((r) => setTimeout(r, 500));
  }
}

export type CitaE2E = { id: string; startIso: string; estado: string; tipo: string; cliente: { nombre: string; telefono: string }; empleadoId?: string; serviceId?: string; servicioNombre?: string };
export async function citas(): Promise<CitaE2E[]> {
  const j = await (await fetch(`${BASE}/api/admin/e2e`, { headers: admin() })).json();
  return j.citas as CitaE2E[];
}
export async function crearCita(c: { startIso: string; nombre: string; telefono?: string; empleadoId?: string; serviceId?: string }): Promise<CitaE2E> {
  const r = await fetch(`${BASE}/api/admin/e2e`, { method: "POST", headers: { ...admin(), "Content-Type": "application/json" }, body: JSON.stringify({ accion: "cita", ...c }) });
  return (await r.json()).cita;
}
export async function marca(b: Record<string, unknown>): Promise<void> {
  await fetch(`${BASE}/api/admin/e2e`, { method: "POST", headers: { ...admin(), "Content-Type": "application/json" }, body: JSON.stringify({ accion: "marca", ...b }) });
}
/** Huecos libres públicos (lo mismo que ve la página de reservas). */
export async function huecos(serviceId: string, fecha: string, empleadoId?: string): Promise<string[]> {
  const q = new URLSearchParams({ serviceId, date: fecha, ...(empleadoId ? { empleadoId } : {}) });
  const j = await (await fetch(`${BASE}/api/booking/${E2E.slug}/slots?${q}`)).json();
  return (j.slots as string[] | undefined)?.map((s) => s.slice(11, 16)) ?? [];
}
export const horas = (t: string) => [...t.matchAll(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g)].map((m) => `${m[1].padStart(2, "0")}:${m[2]}`);
