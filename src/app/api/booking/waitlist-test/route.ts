// Ruta de PRUEBA de la lista de espera inteligente.
// Simula un hueco liberado y manda el WhatsApp de oferta a UN número de prueba
// (el tuyo), para verificar que llega y con el texto correcto ANTES de activar el
// envío real a clientas (WAITLIST_SEND_ENABLED).
//
//   GET/POST /api/booking/waitlist-test?to=34600111222&send=1[&slug=...][&secret=...]
//
//   - to    : teléfono destino en formato internacional SIN "+" (obligatorio).
//   - send  : "1" para enviar de verdad; por defecto (0) solo devuelve el texto.
//   - slug  : negocio para tomar el nombre del salón (opcional; usa el primero si no).
//   - secret: WAITLIST_TEST_SECRET o CRON_SECRET (en local sin secreto, permitido).
//
// El envío de prueba se salta el flag global a propósito (va gateado por el secreto
// y por el número explícito), para no tener que activar los envíos a clientas.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getBusinessBySlug, listBusinesses } from "@/lib/booking";
import { sendWhatsAppText } from "@/lib/whatsapp-sender";
import { textoOferta, waitlistSendEnabled } from "@/lib/booking-waitlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: Request, h: Headers): boolean {
  const expected = process.env.WAITLIST_TEST_SECRET || process.env.CRON_SECRET || "";
  if (!expected) return process.env.NODE_ENV !== "production"; // dev/local sin secreto: permitido
  const url = new URL(req.url);
  const qp = url.searchParams.get("secret") || "";
  const hdr = h.get("x-cron-secret") || "";
  const bearer = (h.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return qp === expected || hdr === expected || bearer === expected;
}

async function run(req: Request) {
  const h = await headers();
  if (!authorized(req, h)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const to = (url.searchParams.get("to") || "").replace(/[^\d]/g, "");
  const send = url.searchParams.get("send") === "1";
  const slug = url.searchParams.get("slug") || "";
  if (!to || to.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Falta ?to=<teléfono internacional sin +>. Ej: 34600111222" },
      { status: 400 },
    );
  }

  const biz = slug ? await getBusinessBySlug(slug) : (await listBusinesses())[0];
  const salon = biz?.nombre || "Tu Salón";

  // Escenario simulado: hueco liberado mañana 17:00, su cita actual dentro de ~3 semanas.
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const huecoStartIso = `${manana.toISOString().slice(0, 10)}T17:00:00`;
  const lejana = new Date();
  lejana.setDate(lejana.getDate() + 21);
  const actualStartIso = `${lejana.toISOString().slice(0, 10)}T11:00:00`;

  const mensaje = textoOferta({
    nombre: "Cris",
    salon,
    servicio: "Corte + peinado",
    huecoStartIso,
    actualStartIso,
  });

  const credencialesWhatsApp = !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
  let enviado = false;
  let resultado: unknown = {
    enviado: false,
    nota: "send=0 → no se ha enviado. Añade &send=1 para mandarlo de verdad a tu número.",
  };
  if (send) {
    const r = await sendWhatsAppText(to, mensaje);
    enviado = r.ok;
    resultado = r;
  }

  return NextResponse.json({
    ok: true,
    entorno: {
      credencialesWhatsApp, // si es false en local, el envío real no saldrá desde aquí
      WAITLIST_SEND_ENABLED: waitlistSendEnabled(),
    },
    destino: to,
    salon,
    escenario: { huecoStartIso, actualStartIso, servicio: "Corte + peinado" },
    mensaje,
    enviado,
    resultado,
    comoActivar:
      "Cuando confirmes que este WhatsApp de prueba llega bien, pon WAITLIST_SEND_ENABLED=true para que el flujo real (tras una cancelación) empiece a enviar a clientas.",
  });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
