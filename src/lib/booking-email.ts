// =============================================================================
// AI-Team Booking — notificaciones (confirmación + recordatorio).
//
// Reutiliza la infraestructura EXISTENTE:
//   - Email → getResend()/RESEND_FROM (mismo cliente Resend que Eva).
//   - WhatsApp → sendWhatsAppText() (mismo sistema que Pablo).
//
// Nunca lanza: todo es best-effort y devuelve un estado, para que un fallo de
// notificación no rompa la reserva (que ya está creada en Google Calendar).
//
// ⚠️ WhatsApp proactivo (recordatorio fuera de la ventana de 24h) requiere una
// PLANTILLA aprobada por Meta. Aquí queda ENGANCHADO con sendWhatsAppText
// (texto libre): funciona dentro de la ventana de 24h; para recordatorios
// proactivos hará falta una plantilla. Ver resumen final.
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import { getResend, RESEND_FROM } from "./resend";
import { sendWhatsAppText } from "./whatsapp-sender";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";
import { resolveCalendarEmail } from "./booking";
import type { BookingRecord, BusinessBooking, EsperaEntry } from "./booking";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function fechaHumana(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d, hh, mm] = m;
  const wd = new Date(`${y}-${mo}-${d}T12:00:00Z`).getUTCDay();
  return `${DIAS[wd]} ${parseInt(d, 10)} de ${MESES[parseInt(mo, 10) - 1]} a las ${hh}:${mm}`;
}

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Enmascara un email para logs (no volcar PII de clientes en claro). */
function maskEmail(e: string): string {
  const [u, d] = e.split("@");
  if (!d) return "***";
  return `${u.slice(0, 1)}***@${d}`;
}

export type NotifResult = {
  email: { intentado: boolean; enviado: boolean; modo: "resend" | "log_local" | "error"; error?: string };
  whatsapp: { intentado: boolean; enviado: boolean; modo: "enviado" | "sin_credenciales" | "error" | "no_intentado"; error?: string };
};

// -----------------------------------------------------------------------------
// Plantillas de email (limpias, consumidor final, legibles en móvil)
// -----------------------------------------------------------------------------

function emailBase(business: BusinessBooking, titulo: string, cuerpo: string, cancelUrl?: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF8F3">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F3"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%">
      <tr><td style="background:#000;padding:16px 20px">
        <div style="font-family:Arial,sans-serif;color:#F5C518;font-weight:bold;font-size:13px;letter-spacing:.12em;text-transform:uppercase">${esc(business.nombre)}</div>
      </td></tr>
      <tr><td style="background:#fff;border:2px solid #000;border-top:none;padding:24px 20px">
        <div style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#0c0c0c;margin:0 0 12px">${titulo}</div>
        ${cuerpo}
        ${cancelUrl ? `<div style="margin-top:22px;padding-top:16px;border-top:1px solid #eee;font-family:Arial,sans-serif;font-size:13px;color:#555">
          ¿No puedes venir? <a href="${cancelUrl}" style="color:#C8202A;font-weight:bold">Cancela aquí</a> — es gratis, sin comisiones.
        </div>` : ""}
      </td></tr>
      <tr><td style="padding:14px 20px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#999">
        Reserva gestionada por AI-Team · <a href="https://aiteam.marketing" style="color:#999">aiteam.marketing</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function bloqueCita(record: BookingRecord, business: BusinessBooking): string {
  const servicio = [record.servicioNombre, record.varianteNombre].filter(Boolean).join(" · ");
  const addons = (record.addonsNombres || []).length ? `<div><b>Extras:</b> ${esc((record.addonsNombres || []).join(", "))}</div>` : "";
  const precio = typeof record.precioEUR === "number" && record.precioEUR > 0 ? ` — ${record.precioEUR} €` : "";
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333">
    <div><b>Servicio:</b> ${esc(servicio)} (${record.durationMin} min)${precio}</div>
    ${addons}
    <div><b>Cuándo:</b> ${esc(fechaHumana(record.startIso))}</div>
    <div><b>Dónde:</b> ${esc(business.nombre)}</div>
    <div><b>A nombre de:</b> ${esc(record.cliente.nombre)}</div>
  </div>`;
}

/** URL pública de autocancelación/reprogramación de ESTA cita (usa el token del record).
 *  Fuente ÚNICA del enlace: la comparten email de confirmación, recordatorio y WhatsApp. */
export function urlCancelacion(record: BookingRecord, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/reservas/cancelar/${record.token}`;
}

export function construirConfirmacion(record: BookingRecord, business: BusinessBooking, baseUrl: string): { subject: string; html: string } {
  const cancelUrl = urlCancelacion(record, baseUrl);
  const subject = `Cita confirmada · ${business.nombre} · ${fechaHumana(record.startIso)}`.slice(0, 120);
  const cuerpo = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#333;margin:0 0 16px">¡Hecho, ${esc(record.cliente.nombre)}! Tu cita está confirmada. 🎉</div>
    ${bloqueCita(record, business)}`;
  return { subject, html: emailBase(business, "Tu cita está confirmada", cuerpo, cancelUrl) };
}

export function construirRecordatorio(record: BookingRecord, business: BusinessBooking, baseUrl: string): { subject: string; html: string } {
  const cancelUrl = urlCancelacion(record, baseUrl);
  const subject = `Recordatorio · tu cita en ${business.nombre} es ${fechaHumana(record.startIso)}`.slice(0, 120);
  const cuerpo = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#333;margin:0 0 16px">Hola ${esc(record.cliente.nombre)}, te recordamos tu cita:</div>
    ${bloqueCita(record, business)}`;
  return { subject, html: emailBase(business, "Recordatorio de tu cita", cuerpo, cancelUrl) };
}

// -----------------------------------------------------------------------------
// Envío
// -----------------------------------------------------------------------------

async function enviarEmail(to: string | undefined, subject: string, html: string): Promise<NotifResult["email"]> {
  if (!to) return { intentado: false, enviado: false, modo: "log_local" };
  if (!process.env.RESEND_API_KEY) {
    console.log(`[booking-email] (LOCAL / sin RESEND) SE HABRÍA ENVIADO a ${maskEmail(to)} · "${subject}"`);
    return { intentado: true, enviado: false, modo: "log_local" };
  }
  try {
    const from = process.env.RESEND_FROM || RESEND_FROM;
    const { error } = await getResend().emails.send({ from, to, subject, html });
    if (error) return { intentado: true, enviado: false, modo: "error", error: String((error as { message?: string }).message || error) };
    return { intentado: true, enviado: true, modo: "resend" };
  } catch (e) {
    return { intentado: true, enviado: false, modo: "error", error: e instanceof Error ? e.message : "error" };
  }
}

async function enviarWhatsApp(telefono: string | undefined, texto: string): Promise<NotifResult["whatsapp"]> {
  if (!telefono) return { intentado: false, enviado: false, modo: "no_intentado" };
  try {
    const r = await sendWhatsAppText(telefono.replace(/[^\d+]/g, ""), texto);
    if (r.ok) return { intentado: true, enviado: true, modo: "enviado" };
    if (r.reason === "missing_credentials") return { intentado: true, enviado: false, modo: "sin_credenciales" };
    return { intentado: true, enviado: false, modo: "error", error: r.detail };
  } catch (e) {
    return { intentado: true, enviado: false, modo: "error", error: e instanceof Error ? e.message : "error" };
  }
}

function textoWhatsApp(record: BookingRecord, business: BusinessBooking, tipo: "confirmacion" | "recordatorio", baseUrl: string): string {
  const cab = tipo === "confirmacion" ? "✅ Cita confirmada" : "⏰ Recordatorio de tu cita";
  const gestionar = `\n\n¿No puedes venir? Cancela o cambia tu cita aquí: ${urlCancelacion(record, baseUrl)}`;
  return `${cab} en *${business.nombre}*\n${record.servicioNombre} · ${fechaHumana(record.startIso)}\nA nombre de ${record.cliente.nombre}.${gestionar}`;
}

/** Confirmación inmediata tras reservar (email + WhatsApp best-effort). */
export async function enviarConfirmacion(record: BookingRecord, business: BusinessBooking, baseUrl: string): Promise<NotifResult> {
  const { subject, html } = construirConfirmacion(record, business, baseUrl);
  const email = await enviarEmail(record.cliente.email, subject, html);
  const whatsapp = await enviarWhatsApp(record.cliente.telefono, textoWhatsApp(record, business, "confirmacion", baseUrl));
  return { email, whatsapp };
}

/** Recordatorio antes de la cita (lo dispara el cron/n8n). */
export async function enviarRecordatorio(record: BookingRecord, business: BusinessBooking, baseUrl: string): Promise<NotifResult> {
  const { subject, html } = construirRecordatorio(record, business, baseUrl);
  const email = await enviarEmail(record.cliente.email, subject, html);
  const whatsapp = await enviarWhatsApp(record.cliente.telefono, textoWhatsApp(record, business, "recordatorio", baseUrl));
  return { email, whatsapp };
}

/** Aviso de "se ha liberado un hueco" a quien está en lista de espera (best-effort, email). */
export async function enviarAvisoEspera(entry: EsperaEntry, business: BusinessBooking, baseUrl: string): Promise<NotifResult["email"]> {
  const url = `${baseUrl.replace(/\/$/, "")}/reservas/${business.slug}`;
  const wd = new Date(`${entry.fecha}T12:00:00Z`).getUTCDay();
  const [, mo, d] = entry.fecha.split("-");
  const fecha = `${DIAS[wd]} ${parseInt(d, 10)} de ${MESES[parseInt(mo, 10) - 1]}`;
  const subject = `¡Se ha liberado un hueco en ${business.nombre}!`.slice(0, 120);
  const cuerpo = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#333;margin:0 0 16px">¡Buenas noticias, ${esc(entry.cliente.nombre)}! Se ha liberado disponibilidad para <b>${esc([entry.servicioNombre, entry.varianteNombre].filter(Boolean).join(" · "))}</b>${entry.empleadoNombre ? ` con ${esc(entry.empleadoNombre)}` : ""} el <b>${esc(fecha)}</b>. Los huecos vuelan — reserva ya:</div>
    <div style="text-align:center;margin:22px 0"><a href="${url}" style="display:inline-block;background:#F5C518;color:#000;text-decoration:none;padding:14px 28px;font-weight:bold;border:2px solid #000">Reservar ahora →</a></div>`;
  return enviarEmail(entry.cliente.email, subject, emailBase(business, "Se ha liberado un hueco", cuerpo));
}

// -----------------------------------------------------------------------------
// Aviso al DUEÑO del negocio (marca AI-Team, por email) — cita nueva / cancelada.
// Flag OWNER_NOTIFY_ENABLED (off por defecto). Dedup por record.id + tipo.
// -----------------------------------------------------------------------------

/** Interruptor de los avisos al dueño. Off por defecto. */
export function ownerNotifyEnabled(): boolean {
  return (process.env.OWNER_NOTIFY_ENABLED || "").toLowerCase() === "true";
}

// Ledger anti-duplicado: no mandar dos avisos del mismo (cita, tipo).
const OWNER_NOTICE_FILE = path.join(process.cwd(), "data", "booking-owner-notices.json");
const KV_OWNER_NOTICE = "booking:ownernotice:";
async function yaAvisado(key: string): Promise<boolean> {
  if (supabaseEnabled()) return !!(await kvGet(KV_OWNER_NOTICE + key));
  try {
    const m = JSON.parse(await fs.readFile(OWNER_NOTICE_FILE, "utf8")) as Record<string, unknown>;
    return !!m[key];
  } catch {
    return false;
  }
}
async function marcarAvisado(key: string): Promise<void> {
  if (supabaseEnabled()) {
    await kvSet(KV_OWNER_NOTICE + key, { at: new Date().toISOString() });
    return;
  }
  let m: Record<string, unknown> = {};
  try {
    m = JSON.parse(await fs.readFile(OWNER_NOTICE_FILE, "utf8")) as Record<string, unknown>;
  } catch {
    /* fichero nuevo */
  }
  m[key] = { at: new Date().toISOString() };
  await fs.mkdir(path.dirname(OWNER_NOTICE_FILE), { recursive: true });
  await fs.writeFile(OWNER_NOTICE_FILE, JSON.stringify(m, null, 2), "utf8");
}

/** Email de aviso al dueño (marca AI-Team, sin enlace de cancelación de cliente). */
export function construirAvisoDueno(
  record: BookingRecord,
  business: BusinessBooking,
  tipo: "nueva" | "cancelada",
): { subject: string; html: string } {
  const servicio = [record.servicioNombre, record.varianteNombre].filter(Boolean).join(" · ") || "Cita";
  const cuando = fechaHumana(record.startIso);
  const cliente = record.cliente?.nombre || "Cliente";
  const nueva = tipo === "nueva";
  const subject = `AI-Team · ${nueva ? "Nueva cita" : "Cita cancelada"}: ${cliente}, ${servicio}, ${cuando}`.slice(0, 140);
  const titulo = nueva ? "📅 Nueva cita" : "❌ Cita cancelada";
  const intro = nueva
    ? `Ha entrado una <b>cita nueva</b> en ${esc(business.nombre)}:`
    : `Se ha <b>cancelado</b> una cita en ${esc(business.nombre)}:`;
  const tel = record.cliente?.telefono ? `<div><b>Teléfono:</b> ${esc(record.cliente.telefono)}</div>` : "";
  const cuerpo = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#333;margin:0 0 14px">${intro}</div>
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333">
      <div><b>Cliente:</b> ${esc(cliente)}</div>
      ${tel}
      <div><b>Servicio:</b> ${esc(servicio)} (${record.durationMin} min)</div>
      <div><b>Cuándo:</b> ${esc(cuando)}</div>
      <div><b>Negocio:</b> ${esc(business.nombre)}</div>
    </div>`;
  return { subject, html: emailBase(business, titulo, cuerpo) };
}

/**
 * Avisa al DUEÑO (email de la config del negocio, vía resolveCalendarEmail) de una
 * cita nueva o cancelada. Respeta OWNER_NOTIFY_ENABLED y no duplica (record.id+tipo).
 * Best-effort: devuelve estado, nunca lanza.
 */
export async function enviarAvisoDueno(
  record: BookingRecord,
  business: BusinessBooking,
  tipo: "nueva" | "cancelada",
): Promise<{ enviado: boolean; modo: string }> {
  if (!ownerNotifyEnabled()) return { enviado: false, modo: "flag_off" };
  const key = `${record.id}:${tipo}`;
  if (await yaAvisado(key)) return { enviado: false, modo: "duplicado" };
  let to: string | undefined;
  try {
    to = await resolveCalendarEmail(business);
  } catch {
    to = undefined;
  }
  if (!to) return { enviado: false, modo: "sin_email_dueno" };
  const { subject, html } = construirAvisoDueno(record, business, tipo);
  const r = await enviarEmail(to, subject, html);
  if (r.intentado) await marcarAvisado(key);
  return { enviado: r.enviado, modo: r.modo };
}

/** Envío directo a un email explícito, sin flag ni dedup (solo para la ruta de prueba). */
export async function enviarAvisoDuenoA(
  to: string,
  record: BookingRecord,
  business: BusinessBooking,
  tipo: "nueva" | "cancelada",
): Promise<NotifResult["email"]> {
  const { subject, html } = construirAvisoDueno(record, business, tipo);
  return enviarEmail(to, subject, html);
}

