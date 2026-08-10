// GET/POST /api/cron/booking-recordatorios — envía recordatorios de citas próximas.
// Dispáralo por cron (Vercel es diario) o por n8n con más frecuencia.
// Auth: ?secret=<CRON_SECRET> o header x-cron-secret (o Authorization: Bearer).
//
// Ventana: reservas confirmadas que empiezan dentro de [WINDOW_MIN_H, WINDOW_MAX_H]
// horas y aún sin recordatorio → efectivamente "el día antes" con un cron diario.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { listRecords, getBusinessBySlug, saveRecord, localToEpoch } from "@/lib/booking";
import { enviarRecordatorio } from "@/lib/booking-email";
import { restauranteRecordatorioEnabled } from "@/lib/restaurante";
import { barrerOfertasCaducadas } from "@/lib/booking-waitlist";
import { pasadaGestoria, pasadaResenas } from "@/lib/pasadas-diarias";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WINDOW_MIN_H = 6;   // no recordar citas a menos de 6h (ya casi encima)
const WINDOW_MAX_H = 30;  // hasta 30h antes (cubre "mañana" con un tick diario)

function authorized(req: Request, h: Headers): boolean {
  const expected = process.env.CRON_SECRET || "";
  // Fail-CLOSED en producción: si falta el secreto, NO abrimos el endpoint
  // (evita disparos públicos que enviarían emails/WhatsApp reales a clientes).
  // En dev sin secreto, seguimos permitiendo para no dar fricción.
  if (!expected) return process.env.NODE_ENV !== "production";
  const url = new URL(req.url);
  const qp = url.searchParams.get("secret") || "";
  const hdr = h.get("x-cron-secret") || "";
  const bearer = (h.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return qp === expected || hdr === expected || bearer === expected;
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
    const startEpoch = localToEpoch(r.startIso, business.timezone || "Europe/Madrid");
    if (isNaN(startEpoch) || startEpoch < min || startEpoch > max) continue;
    try {
      const notif = await enviarRecordatorio(r, business, baseUrl);
      await saveRecord({ ...r, recordatorioEnviado: true });
      enviados++;
      detalle.push({ id: r.id, email: notif.email.modo, whatsapp: notif.whatsapp.modo });
    } catch (err) {
      fallidos++;
      console.error("[booking-recordatorios] fallo:", err);
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

  return NextResponse.json({
    ok: true, enviados, fallidos, revisados: all.length, detalle, espera,
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
