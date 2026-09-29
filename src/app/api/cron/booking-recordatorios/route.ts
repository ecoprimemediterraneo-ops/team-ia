// GET/POST /api/cron/booking-recordatorios — envía recordatorios de citas próximas.
// Dispáralo por cron (Vercel es diario) o por n8n con más frecuencia.
// Auth: ?secret=<CRON_SECRET> o header x-cron-secret (o Authorization: Bearer).
//
// Qué se recuerda: toda reserva confirmada de MAÑANA (fecha local del negocio) y,
// como red, las que empiezan dentro de [WINDOW_MIN_H, WINDOW_MAX_H] horas. Una
// sola vez por cita (`recordatorioEnviado`, con candado entre pasadas).
// Por WhatsApp, fuera de la ventana de 24 h hace falta plantilla aprobada:
// `BOOKING_RECORDATORIO_TEMPLATE` (ver `booking-email.ts`).
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { cronAuthError } from "@/lib/cron-auth";
import { listRecords, getBusinessBySlug, getRecord, actualizarRecord, localToEpoch, reintentarAvisosPendientes } from "@/lib/booking";
import crypto from "node:crypto";
import { agendaTryLock, agendaUnlock } from "@/lib/booking-orchestrator";
import { enviarRecordatorio } from "@/lib/booking-email";
import { restauranteRecordatorioEnabled } from "@/lib/restaurante";
import { barrerOfertasCaducadas } from "@/lib/booking-waitlist";
import { pasadaGestoria, pasadaResenas } from "@/lib/pasadas-diarias";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WINDOW_MIN_H = 6;   // no recordar citas a menos de 6h (ya casi encima)
const WINDOW_MAX_H = 30;  // hasta 30h antes (cubre "mañana" con un tick diario)
const LOCK_RECORDATORIO_MS = 5 * 60_000; // reserva la cita mientras se manda

/**
 * Una sola puerta: delega en `cronAuthError`. Antes esta función repetía aquí
 * la lógica del secreto (y cada ruta la suya, con matices distintos). Se queda
 * como envoltorio para no tocar las llamadas de abajo.
 */
function authorized(req: Request, h: Headers): boolean {
  void h; // el secreto por cabecera lo lee ya `cronAuthError` de la propia petición
  return cronAuthError(req) === null;
}

async function run(req: Request) {
  const h = await headers();
  if (!authorized(req, h)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const now = Date.now();
  const min = now + WINDOW_MIN_H * 3600_000;
  const max = now + WINDOW_MAX_H * 3600_000;

  const all = await listRecords();
  let enviados = 0;
  let fallidos = 0;
  const detalle: { id: string; email: string; whatsapp: string }[] = [];

  let saltadosPorFlag = 0;

  for (const r of all) {
    if (r.estado !== "confirmada" || r.recordatorioEnviado) continue;
    const business = await getBusinessBySlug(r.slug);
    if (!business) continue;
    // RESTAURACIÓN, fail-closed: el recordatorio de mesa del día antes no sale
    // hasta que se encienda a mano. Un restaurante mete cien reservas al día y
    // encender esto sin querer son cien WhatsApps a gente real de golpe. Se
    // reconoce por tener config de restaurante, no por el sector del tenant:
    // el registro no sabe de qué tenant cuelga sin otra lectura más.
    if (business.restaurante && !restauranteRecordatorioEnabled()) {
      saltadosPorFlag++;
      continue;
    }
    // startIso es hora local del negocio (sin TZ) → epoch con la zona del negocio
    // (mismo tzOffset/DST que computeFreeSlots; evita el desfase en runtime UTC).
    const tz = business.timezone || "Europe/Madrid";
    const startEpoch = localToEpoch(r.startIso, tz);
    if (isNaN(startEpoch) || startEpoch < now) continue;
    // "EL DÍA ANTES" POR CALENDARIO, no por horas. Con solo la ventana de 6–30 h
    // y el cron a las 11:00 de Madrid, una cita de mañana a las 18:00 caía fuera
    // (31 h) y se recordaba EL MISMO DÍA a las 11:00. Ahora: toda cita de mañana
    // (fecha local del negocio) se recuerda hoy; la ventana se queda como red
    // para las que se reservan tarde.
    const hoyLocal = new Date(now).toLocaleDateString("en-CA", { timeZone: tz });
    const mananaLocal = new Date(Date.parse(`${hoyLocal}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const esManana = r.startIso.slice(0, 10) === mananaLocal;
    if (!esManana && (startEpoch < min || startEpoch > max)) continue;
    // UN RECORDATORIO POR CITA, AUNQUE HAYA DOS PASADAS A LA VEZ.
    //
    // `recordatorioEnviado` se escribe DESPUÉS de enviar, así que dos pasadas
    // solapadas —este cron lo dispara Vercel, y n8n puede dispararlo también—
    // leen las dos la cita sin marcar y le mandan las dos el recordatorio: dos
    // WhatsApps y dos correos a la misma persona. Comprobado. El candado las
    // serializa; la segunda encuentra la cita ya marcada y se la salta.
    const lockCita = `lock:recordatorio:${r.id}`;
    // Candado con dueño único y que también vale en local entre procesos (antes
    // en local no había candado: dos pasadas a la vez mandaban dos recordatorios).
    const duenoLock = `booking-recordatorios:${crypto.randomUUID()}`;
    if (!(await agendaTryLock(lockCita, LOCK_RECORDATORIO_MS, duenoLock))) {
      console.log(`[booking-recordatorios] cita ${r.id} en manos de otra pasada; se salta`);
      continue;
    }
    try {
      // Releer: si la otra pasada acabó entre medias, ya está marcada.
      const fresco = await getRecord(r.id);
      if (!fresco || fresco.recordatorioEnviado || fresco.estado !== "confirmada") continue;
      const notif = await enviarRecordatorio(fresco, business, baseUrl);
      // Solo se apunta el recordatorio, sobre la versión guardada AHORA: antes se
      // guardaba la copia leída antes de enviar, y una cancelación hecha mientras
      // tanto se deshacía (la cita volvía a salir confirmada).
      await actualizarRecord(fresco.id, "recordatorio", (c) => ({ ...c, recordatorioEnviado: true, recordatorioEnviadoEn: new Date().toISOString() }));
      enviados++;
      detalle.push({ id: r.id, email: notif.email.modo, whatsapp: notif.whatsapp.modo });
    } catch (err) {
      fallidos++;
      console.error("[booking-recordatorios] fallo:", err);
    } finally {
      await agendaUnlock(lockCita, duenoLock);
    }
  }
  // Lista de espera inteligente: caduca ofertas sin respuesta y reoferta a la siguiente.
  let espera = { caducadas: 0, reofertadas: 0 };
  try {
    espera = await barrerOfertasCaducadas(baseUrl);
  } catch (e) {
    console.error("[booking-recordatorios] barrido lista de espera falló (no crítico):", e);
  }

  // --- GESTORÍA y RESEÑAS: cuelgan de ESTE cron ---
  // No se crea ninguno nuevo a propósito. Los tres trabajos son diarios y de
  // volumen bajo, así que caben en la misma pasada; y el plan Hobby solo da una
  // ejecución al día por cron, de modo que añadir crons sería gastar el cupo
  // para nada. Los tres son best-effort: si uno falla, no tumba los recordatorios.
  const gestoria = await pasadaGestoria().catch((e) => {
    console.error("[booking-recordatorios] pasada de gestoría falló (no crítico):", e);
    return null;
  });
  const resenas = await pasadaResenas().catch((e) => {
    console.error("[booking-recordatorios] pasada de reseñas falló (no crítico):", e);
    return null;
  });

  // Avisos de citas nuevas que no salieron al reservar (Meta caído, plantilla
  // rechazada…): se reintentan aquí, hasta 6 veces.
  const avisosPendientes = await reintentarAvisosPendientes().catch((e) => {
    console.error("[booking-recordatorios] reintento de avisos falló (no crítico):", e);
    return null;
  });

  return NextResponse.json({
    ok: true, enviados, fallidos, revisados: all.length, detalle, espera, avisosPendientes,
    // Cuántas reservas de restaurante se han dejado pasar por tener el
    // interruptor apagado. Un cero aquí con reservas de mesa en la ventana
    // significa que el flag ya está encendido.
    saltadasRestaurante: saltadosPorFlag,
    restauranteRecordatorio: restauranteRecordatorioEnabled() ? "encendido" : "APAGADO (RESTAURANTE_RECORDATORIO_ENABLED)",
    // Con los interruptores apagados, estos tres bloques dicen CUÁNTOS mensajes
    // habrían salido. Es lo que se mira antes de encender nada.
    gestoria,
    resenas,
  });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
