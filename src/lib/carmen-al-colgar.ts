// =============================================================================
// WHATSAPP AL COLGAR — lo que manda el webhook de fin de llamada de Carmen.
//
// Carmen coge, cambia y anula citas EN DIRECTO (agendar_cita / gestionar_cita).
// Durante la llamada no se le manda nada al cliente; al colgar (evento
// `call_ended` de Retell) se mira qué ha pasado en ESA llamada con ESE teléfono
// y se manda UN WhatsApp por cita:
//   · creada o cambiada → confirmación con la plantilla aprobada
//     (BOOKING_CONFIRMACION_TEMPLATE = aiteam_cita_confirmacion): día, hora,
//     servicio, dirección del negocio y botón "Anular o cambiar";
//   · anulada          → aviso de anulación (enviarAnulacion).
// Si en la llamada no se tocó ninguna cita, no se manda nada.
//
// Cómo se sabe qué citas son "de esta llamada": mismo negocio (el número al que
// se llamó), mismo teléfono (el que llama) y la marca de tiempo del cambio
// (creadaEn / reprogramadaEn / canceladaEn) dentro de la llamada. Retell puede
// repetir el webhook: cada envío se apunta en la cita (`avisosAlColgar`) dentro
// del candado, y un segundo aviso de la misma llamada no vuelve a enviar.
// =============================================================================
import { resolverSalonDeLlamada } from "./carmen-salon";
import { listRecordsDeNegocio, getBusinessBySlug, actualizarRecord, type BookingRecord } from "./booking";

export type LlamadaRetell = {
  call_id?: string;
  from_number?: string;
  to_number?: string;
  direction?: string;
  start_timestamp?: number;
  end_timestamp?: number;
};

export type TipoAlColgar = "creada" | "cambiada" | "anulada";
export type AvisoAlColgar = { recordId: string; tipo: TipoAlColgar; startIso: string; enviado: boolean; modo: string };

const MARGEN_MS = 60_000;
const cola9 = (t?: string) => (t || "").replace(/\D/g, "").slice(-9);

/** Qué le ha pasado a cada cita del cliente durante la llamada (sin enviar nada). */
export function cambiosDeLaLlamada(citas: BookingRecord[], telefono: string, desde: number, hasta: number): { record: BookingRecord; tipo: TipoAlColgar }[] {
  const en = (iso?: string) => {
    const t = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(t) && t >= desde && t <= hasta;
  };
  const tel = cola9(telefono);
  const out: { record: BookingRecord; tipo: TipoAlColgar }[] = [];
  for (const r of citas) {
    if (r.tipo === "bloqueo" || tel.length !== 9 || cola9(r.cliente?.telefono) !== tel) continue;
    const creada = en(r.creadaEn);
    if (r.estado === "cancelada") {
      // Cogida y anulada en la misma llamada: no hay nada que contarle.
      if (en(r.canceladaEn) && !creada) out.push({ record: r, tipo: "anulada" });
      continue;
    }
    if (creada) out.push({ record: r, tipo: "creada" });
    else if (en(r.reprogramadaEn)) out.push({ record: r, tipo: "cambiada" });
  }
  return out;
}

export async function whatsappAlColgar(call: LlamadaRetell, baseUrl?: string): Promise<{ ok: boolean; motivo?: string; avisos: AvisoAlColgar[] }> {
  // Solo llamadas ENTRANTES: el cliente llama al número del negocio. En las
  // salientes (recordatorios) el número del negocio es el `from`.
  if (call.direction && call.direction !== "inbound") return { ok: true, motivo: "saliente", avisos: [] };
  const telefono = call.from_number || "";
  if (cola9(telefono).length !== 9) return { ok: true, motivo: "sin_telefono", avisos: [] };
  const salon = await resolverSalonDeLlamada(undefined, call.to_number || undefined);
  if (!salon.ok) return { ok: false, motivo: "salon_desconocido", avisos: [] };

  const ahora = Date.now();
  const desde = (call.start_timestamp || ahora - 60 * 60_000) - MARGEN_MS;
  const hasta = (call.end_timestamp || ahora) + MARGEN_MS;
  const cambios = cambiosDeLaLlamada(await listRecordsDeNegocio(salon.slug), telefono, desde, hasta);
  if (!cambios.length) return { ok: true, motivo: "sin_citas", avisos: [] };

  const business = await getBusinessBySlug(salon.slug);
  if (!business) return { ok: false, motivo: "sin_negocio", avisos: [] };
  const base = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://aiteam.marketing";
  const { enviarConfirmacion, enviarAnulacion } = await import("./booking-email");

  const avisos: AvisoAlColgar[] = [];
  for (const { record, tipo } of cambios) {
    const clave = `${call.call_id || `${telefono}-${desde}`}:${tipo}`;
    // Se apunta ANTES de enviar, dentro del candado: dos webhooks repetidos no mandan dos veces.
    const marca = await actualizarRecord(record.id, "carmen-al-colgar", (fresca) =>
      (fresca.avisosAlColgar || []).includes(clave) ? null : { ...fresca, avisosAlColgar: [...(fresca.avisosAlColgar || []), clave] });
    if (!marca.ok || !marca.record) {
      avisos.push({ recordId: record.id, tipo, startIso: record.startIso, enviado: false, modo: marca.ok ? "ya_enviado" : marca.reason });
      continue;
    }
    const cita = marca.record;
    const w = tipo === "anulada"
      ? await enviarAnulacion(cita, business, base)
      : (await enviarConfirmacion(cita, business, base)).whatsapp;
    if (!w.enviado) {
      // No ha salido: se quita la marca para que un reintento de Retell lo vuelva a intentar.
      await actualizarRecord(record.id, "carmen-al-colgar", (fresca) =>
        ({ ...fresca, avisosAlColgar: (fresca.avisosAlColgar || []).filter((x) => x !== clave) })).catch(() => {});
    }
    avisos.push({ recordId: record.id, tipo, startIso: cita.startIso, enviado: w.enviado, modo: w.modo });
  }
  return { ok: true, avisos };
}
