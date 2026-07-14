// -----------------------------------------------------------------------------
// Aviso al DUEÑO por WhatsApp (plantilla utility de Meta) — cita nueva/cancelada.
//
// Segundo canal del aviso al dueño, en paralelo al email (booking-email.ts).
// Reutiliza el MISMO cliente de Meta Cloud API que Pablo (whatsapp-sender.ts) y
// va gateado por su propio flag OWNER_WHATSAPP_ENABLED (off por defecto) para
// poder activarlo/desactivarlo desde Vercel sin redeploy.
//
// Fail-safe: nunca lanza. Si falla el envío, la cita se crea igual y solo se
// loguea. Si el tenant no tiene número de dueño configurado, se salta sin error.
// -----------------------------------------------------------------------------

import "server-only";
import { sendWhatsAppTemplate } from "./whatsapp-sender";
import { getTenant } from "./tenants";
import type { BookingRecord, BusinessBooking } from "./booking";

// Plantilla utility APROBADA en Meta (idioma es). Texto real:
//   "AI-Team · Nueva cita / Cliente: {{1}} / Servicio: {{2}} / Cuándo: {{3}} / ..."
// Variables del cuerpo, EN ORDEN:
//   {{1}} cliente · {{2}} servicio · {{3}} cuándo (fecha y hora juntas)
// OJO: el texto dice "Nueva cita" → SOLO sirve para citas nuevas, no cancelaciones.
// Si en Meta el orden/nº de variables cambiara, ajústalo SOLO aquí.
export const OWNER_TEMPLATE_NAME = "aviso_dueno_cita";
export const OWNER_TEMPLATE_LANG = "es";

/** Interruptor del aviso por WhatsApp al dueño. Off por defecto. */
export function ownerWhatsAppEnabled(): boolean {
  return (process.env.OWNER_WHATSAPP_ENABLED || "").toLowerCase() === "true";
}

/** Meta espera solo dígitos con prefijo de país (E.164 sin "+"). */
function normalizarTelefono(s: string): string {
  return s.replace(/[^\d]/g, "");
}

/**
 * Número de WhatsApp del DUEÑO al que enviar el aviso. Prioridad:
 *   1) tenant.ownerWhatsapp (config del tenant, futuro multi-cliente)
 *   2) env OWNER_WHATSAPP_TO (fundador / tenant por defecto, sin editar config)
 * Devuelve undefined si no hay ninguno → el llamador salta el envío sin fallar.
 */
export async function resolveOwnerPhone(business: BusinessBooking): Promise<string | undefined> {
  try {
    const t = await getTenant(business.tenantId);
    const fromTenant = t?.ownerWhatsapp?.trim();
    if (fromTenant) return normalizarTelefono(fromTenant);
  } catch {
    /* sin tenant → probamos el env */
  }
  const fromEnv = (process.env.OWNER_WHATSAPP_TO || "").trim();
  return fromEnv ? normalizarTelefono(fromEnv) : undefined;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** startIso local → "cuándo" en español, fecha y hora juntas ("lunes 20 de julio a las 10:00"). */
function cuandoLargoES(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d, hh, mm] = m;
  const wd = new Date(`${y}-${mo}-${d}T12:00:00Z`).getUTCDay();
  return `${DIAS[wd]} ${parseInt(d, 10)} de ${MESES[parseInt(mo, 10) - 1]} a las ${hh}:${mm}`;
}

/**
 * Variables del cuerpo de la plantilla aviso_dueno_cita, en el orden de Meta:
 *   {{1}} cliente · {{2}} servicio · {{3}} cuándo (fecha y hora juntas)
 */
export function construirParamsAvisoDueno(record: BookingRecord): string[] {
  const servicio = [record.servicioNombre, record.varianteNombre].filter(Boolean).join(" · ") || "Cita";
  const cliente = record.cliente?.nombre || "Cliente";
  const cuando = cuandoLargoES(record.startIso);
  return [cliente, servicio, cuando];
}

export type OwnerWaResult = { enviado: boolean; modo: string; detail?: string };

/**
 * Envía al dueño el WhatsApp de plantilla (aviso_dueno_cita) por una cita NUEVA.
 * La plantilla dice "Nueva cita", así que en cancelaciones NO se envía (el aviso de
 * cancelación sigue yendo solo por email). Gateado por OWNER_WHATSAPP_ENABLED.
 * Fail-safe: devuelve estado, nunca lanza; si no hay número de dueño, salta sin error.
 */
export async function enviarAvisoDuenoWhatsApp(
  record: BookingRecord,
  business: BusinessBooking,
  tipo: "nueva" | "cancelada",
): Promise<OwnerWaResult> {
  if (tipo !== "nueva") return { enviado: false, modo: "no_aplica_cancelada" };
  if (!ownerWhatsAppEnabled()) return { enviado: false, modo: "flag_off" };
  const to = await resolveOwnerPhone(business);
  if (!to) return { enviado: false, modo: "sin_telefono_dueno" };

  const params = construirParamsAvisoDueno(record);
  const r = await sendWhatsAppTemplate(to, OWNER_TEMPLATE_NAME, OWNER_TEMPLATE_LANG, params);
  if (!r.ok) {
    console.error(`[booking] WhatsApp al dueño (nueva) falló: ${r.reason} — ${r.detail}`);
    return { enviado: false, modo: r.reason, detail: r.detail };
  }
  return { enviado: true, modo: "enviado" };
}
