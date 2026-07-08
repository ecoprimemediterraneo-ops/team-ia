// =============================================================================
// POST /api/carmen/agendar — FUNCTION DE RETELL (en directo, durante la llamada)
//
// Carmen (agente de voz en Retell) llama a esta URL como "Custom Function"
// MIENTRAS habla con el cliente. Reutiliza el MISMO punto de reserva que Lucía
// (reservarSlot → agendarCita → Google Calendar `primary` del dueño), así que la
// cita se crea de verdad donde Lucía las crea, con comprobación de hueco libre y
// lock anti-doble-reserva.
//
// A diferencia de /api/carmen/webhook (post-call, al colgar), esto responde EN
// DIRECTO con un mensaje "hablable" para que Carmen confirme o proponga otra hora.
//
// ─── AUTENTICACIÓN ───────────────────────────────────────────────────────────
//   Secreto compartido `CARMEN_WEBHOOK_SECRET` (el mismo que ya usa el webhook):
//     - en la URL:  ...?secret=<CARMEN_WEBHOOK_SECRET>     (recomendado en Retell)
//     - o header:   x-carmen-secret: <CARMEN_WEBHOOK_SECRET>
//
// ─── CÓMO DARLO DE ALTA EN RETELL (panel → tu agente Carmen → Functions) ──────
//   Add function (Custom):
//     · Name:        agendar_cita
//     · URL (POST):  https://aiteam.marketing/api/carmen/agendar?secret=TU_SECRETO
//     · Description: "Agenda la cita cuando ya tienes nombre, motivo, fecha y hora.
//                     Llama a esta función para crear la cita de verdad."
//     · Parameters (JSON schema):
//         - nombre        (string, requerido)  → nombre del cliente
//         - motivo        (string, requerido)  → motivo de la cita
//         - fecha_hora    (string, requerido)  → ISO Europe/Madrid "2026-06-15T10:00:00"
//                                                (resuelve "mañana a las 10" a fecha absoluta)
//         - telefono      (string, opcional)
//         - duracion_min  (number, opcional, por defecto 30)
//     · Speak during execution: "Un momento que lo agendo…"
//   Y en Vercel: env var  CARMEN_WEBHOOK_SECRET = TU_SECRETO  (Production).
//
// ─── RESPUESTA (la lee la LLM de Retell y Carmen la dice) ─────────────────────
//   { "success": true,  "message": "Perfecto, te he agendado el martes 15…" }
//   { "success": false, "reason": "slot_taken", "message": "Ese hueco está ocupado. Te ofrezco…" }
// =============================================================================

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { reservarSlot } from "@/lib/orchestrator";
import { getRedirectUri } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

type RetellFunctionBody = {
  // Retell envuelve los argumentos de la función bajo `args`; toleramos raíz también.
  args?: Record<string, unknown>;
  call?: { call_id?: string; from_number?: string };
  name?: string;
  [k: string]: unknown;
};

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Auth por secreto compartido (query `?secret=` o header `x-carmen-secret`). */
function auth(req: Request, h: Headers): "ok" | "no_secret_configured" | "unauthorized" {
  const expected = process.env.CARMEN_WEBHOOK_SECRET || "";
  if (!expected) return "no_secret_configured";
  const qp = new URL(req.url).searchParams.get("secret") || "";
  const hdr = h.get("x-carmen-secret") || "";
  if ((qp && safeEqual(qp, expected)) || (hdr && safeEqual(hdr, expected))) return "ok";
  return "unauthorized";
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/**
 * Formatea "2026-06-15T10:00:00" (hora local Europe/Madrid) a algo hablable:
 * "el martes 15 de junio a las 10:00". Trabaja sobre los componentes del string
 * (sin conversión de zona horaria), para no desplazar la hora.
 */
function formatoHumano(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d, hh, mm] = m;
  // Día de la semana: mediodía UTC de esa fecha (evita líos de DST).
  const wd = new Date(`${y}-${mo}-${d}T12:00:00Z`).getUTCDay();
  return `el ${DIAS[wd]} ${parseInt(d, 10)} de ${MESES[parseInt(mo, 10) - 1]} a las ${hh}:${mm}`;
}

function normalizarFecha(raw: string): string {
  let s = String(raw).trim();
  // "2026-06-15 10:00" → "2026-06-15T10:00"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:/.test(s)) s = s.replace(" ", "T");
  return s;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export async function POST(req: Request) {
  const h = await headers();

  // 1) Auth
  const a = auth(req, h);
  if (a === "no_secret_configured") {
    return NextResponse.json(
      { success: false, message: "El servidor no tiene configurado el secreto de Carmen.", error: "no_secret_configured" },
      { status: 503 },
    );
  }
  if (a === "unauthorized") {
    return NextResponse.json({ success: false, message: "No autorizado.", error: "unauthorized" }, { status: 401 });
  }

  // 2) Parsear payload de la Function de Retell
  let body: RetellFunctionBody;
  try {
    body = (await req.json()) as RetellFunctionBody;
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud no válida.", error: "bad_json" }, { status: 400 });
  }

  const args = (body.args && typeof body.args === "object" ? body.args : {}) as Record<string, unknown>;
  const get = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = (args[k] ?? (body as Record<string, unknown>)[k]) as unknown;
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    return undefined;
  };

  const nombre = get("nombre", "customer_name", "name");
  const motivo = get("motivo", "appointment_motivo", "reason");
  const fechaRaw = get("fecha_hora", "appointment_datetime", "datetime", "start", "startIso");
  const telefono = get("telefono", "customer_phone", "phone") || body.call?.from_number || undefined;
  const durationMin = Number(get("duracion_min", "duration_min")) || 30;

  console.log("[carmen/agendar] in:", JSON.stringify({ nombre, motivo, fechaRaw, telefono, durationMin, call: body.call?.call_id }).slice(0, 800));

  // 3) Validaciones → respuestas hablables (200, para que Carmen siga la conversación)
  if (!nombre || !motivo || !fechaRaw) {
    return NextResponse.json({
      success: false,
      reason: "missing_fields",
      message: "Me faltan datos para agendar: necesito el nombre, el motivo y la fecha con la hora.",
      missing: { nombre: !nombre, motivo: !motivo, fecha_hora: !fechaRaw },
    });
  }
  const startIso = normalizarFecha(fechaRaw);
  if (!ISO_RE.test(startIso) || isNaN(new Date(startIso).getTime())) {
    return NextResponse.json({
      success: false,
      reason: "bad_datetime",
      message: "No he entendido bien la fecha y la hora. ¿Me la repites con día y hora?",
    });
  }

  // 4) Reservar por el ORQUESTADOR (mismo sitio donde agenda Lucía)
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);

  const result = await reservarSlot({
    userEmail: FOUNDER_EMAIL,
    redirectUri,
    nombre,
    motivo,
    startIso,
    durationMin,
    agenteOrigen: "carmen",
    customerPhone: telefono,
  });

  // 5) Traducir el resultado a algo que Carmen pueda decir
  if (result.ok) {
    return NextResponse.json({
      success: true,
      message: `Perfecto, te he agendado ${formatoHumano(startIso)}. ¡Te esperamos!`,
      eventId: result.eventId,
      htmlLink: result.htmlLink,
      eventLogId: result.eventLogId,
    });
  }

  if (result.reason === "slot_taken") {
    return NextResponse.json({
      success: false,
      reason: "slot_taken",
      message: result.suggested
        ? `Ese hueco está ocupado. Te puedo ofrecer ${formatoHumano(result.suggested)}. ¿Te viene bien?`
        : "Ese hueco está ocupado y no me queda otro libre ese día. ¿Probamos otro día?",
      suggested: result.suggested,
    });
  }
  if (result.reason === "locked") {
    return NextResponse.json({
      success: false,
      reason: "locked",
      message: "Dame un segundo, estoy confirmando ese hueco. ¿Te lo confirmo en un momento?",
    });
  }
  // error (incluye agenda no conectada / sin tokens de Google)
  return NextResponse.json({
    success: false,
    reason: "error",
    message: "Ahora mismo no puedo acceder a la agenda. Tomo tus datos y te confirmamos enseguida.",
    detail: result.detail,
  });
}
