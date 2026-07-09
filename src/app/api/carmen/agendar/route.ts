// =============================================================================
// POST /api/carmen/agendar — FUNCTION DE RETELL (en directo, durante la llamada)
//
// Carmen (agente de voz en Retell) llama a esta URL como "Custom Function"
// MIENTRAS habla con el cliente. Reserva por el MOTOR DE BOOKING (crearReservaManual):
// crea un BookingRecord con `slug` → la cita sale en /dashboard/reservas del salón, en
// el MISMO Google Calendar (un solo evento, sin duplicar) y con el anti-doble-reserva
// del booking. El `slug` llega en el body de Retell; si no viene, cae a "bendito-arte".
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
import * as chrono from "chrono-node";
import { crearReservaManual } from "@/lib/booking";
import { getRedirectUri } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Salón por defecto si Retell no envía `slug` (la cuenta piloto de Carmen).
const DEFAULT_SLUG = "bendito-arte";


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

const PAD = (n: number) => String(n).padStart(2, "0");

/** Componentes de "ahora" en Europe/Madrid (para resolver relativos: mañana, jueves…). */
function madridNow(): { y: number; mo: number; d: number; h: number; mi: number } {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  })
    .formatToParts(new Date())
    .reduce((a, x) => ((a[x.type] = x.value), a), {} as Record<string, string>);
  return { y: +p.year, mo: +p.month, d: +p.day, h: p.hour === "24" ? 0 : +p.hour, mi: +p.minute };
}

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const sinTildes = (x: string) => x.normalize("NFD").replace(DIACRITICS, "");
const NUM_ES: Record<string, number> = {
  una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};

/**
 * Extrae la HORA de una expresión española y la devuelve en 24h. Cubre lo que
 * chrono.es NO resuelve bien: meridiano ("de la tarde/noche/mañana/madrugada"),
 * números escritos ("a las cinco"), "y media/cuarto", "mediodía/medianoche".
 * Solo la considera hora si va anclada a "a las…" o lleva meridiano → no confunde
 * el número de un día ("el 10 de julio"). Devuelve null si no hay hora clara.
 */
function parseHoraEs(textLow: string): { hour: number; min: number } | null {
  const t = sinTildes(textLow);
  if (/\bmediodia\b/.test(t)) return { hour: 12, min: 0 };
  if (/\bmedianoche\b/.test(t)) return { hour: 0, min: 0 };
  const num = Object.keys(NUM_ES).join("|");
  const meridiem = "(?:\\s+(?:de\\s+la|del|de)\\s+(manana|tarde|noche|madrugada|mediodia))?";
  const cuerpo = `\\b(\\d{1,2}|${num})\\b(?:\\s*[:.h]\\s*(\\d{2}))?(?:\\s+y\\s+(media|cuarto|treinta|quince))?${meridiem}`;
  // 1) "a las 4 [de la tarde]"  2) "4 de la tarde" (meridiano explícito).
  let m = t.match(new RegExp(`(?:a\\s+las?\\s+)${cuerpo}`));
  if (!m) m = t.match(new RegExp(`${cuerpo.replace(meridiem, "")}\\s+(?:de\\s+la|del|de)\\s+(manana|tarde|noche|madrugada|mediodia)`));
  if (!m) return null;
  let hour = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUM_ES[m[1]];
  if (hour == null || hour > 23) return null;
  let min = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3]) min = /media|treinta/.test(m[3]) ? 30 : 15;
  const mer = m[4];
  if (mer) {
    if (mer === "tarde") { if (hour >= 1 && hour < 12) hour += 12; }
    else if (mer === "noche") { if (hour >= 1 && hour < 12) hour += 12; else if (hour === 12) hour = 0; }
    else if (mer === "madrugada") { if (hour === 12) hour = 0; } // "12 de la madrugada" = 00:00
    // "de la mañana": AM tal cual; "las 12 de la mañana" = mediodía → se queda 12.
    else if (mer === "mediodia") hour = 12;
  }
  if (min > 59) return null;
  return { hour, min };
}

/**
 * Convierte la fecha a "YYYY-MM-DDTHH:MM:SS" (hora local Europe/Madrid) aceptando:
 *   - ISO ya formado ("2026-07-10T10:00[:00]") o con espacio → passthrough.
 *   - Lenguaje natural español: "mañana a las 10", "el 10 de julio a las 11",
 *     "jueves a las 4 de la tarde", "pasado mañana", "el lunes que viene a las 9:30"…
 * chrono.es resuelve la FECHA (forwardDate); la HORA la fija parseHoraEs (meridiano
 * español) y prevalece sobre la de chrono. SIEMPRE futuro (guardia anti-pasado).
 * Devuelve "" si no logra fecha CON hora (el llamador pedirá repetir).
 */
function normalizarFecha(raw: string): string {
  let s = String(raw).trim();
  if (!s) return "";
  // Ya viene en ISO (o con espacio en vez de T): determinista, no tocamos.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) return s.replace(" ", "T");

  const now = madridNow();
  const low = s.toLowerCase();

  // "pasado mañana" → chrono.es no siempre lo cubre: lo sustituimos por su fecha.
  if (/\bpasado\s+ma[nñ]ana\b/.test(low)) {
    const t = new Date(Date.UTC(now.y, now.mo - 1, now.d + 2));
    s = low.replace(/\bpasado\s+ma[nñ]ana\b/, `${t.getUTCFullYear()}-${PAD(t.getUTCMonth() + 1)}-${PAD(t.getUTCDate())}`);
  }

  // Referencia = "ahora" en Madrid codificado como UTC → chrono opera sobre los
  // mismos números de calendario; solo usamos los COMPONENTES del resultado (TZ-safe).
  const ref = new Date(Date.UTC(now.y, now.mo - 1, now.d, now.h, now.mi));
  let results: ReturnType<typeof chrono.es.parse>;
  try {
    results = chrono.es.parse(s, ref, { forwardDate: true });
  } catch {
    return "";
  }
  if (!results.length) return "";
  const c = results[0].start;
  const y = c.get("year");
  const mo = c.get("month");
  const d = c.get("day");

  // HORA: parseHoraEs (español) manda; si no la detecta, la de chrono.
  const horaEs = parseHoraEs(low);
  const hh = horaEs ? horaEs.hour : c.get("hour");
  const mi = horaEs ? horaEs.min : (c.get("minute") ?? 0);
  if (!y || !mo || !d || hh === null || hh === undefined) return ""; // sin hora → que pida repetir

  // Guardia "nunca en el pasado": si quedó antes de ahora (Madrid), empuja al futuro
  // más cercano — mismo día ya pasado → +1 día; fecha absoluta ya pasada este año → +1 año.
  const nowMs = Date.UTC(now.y, now.mo - 1, now.d, now.h, now.mi);
  if (Date.UTC(y, mo - 1, d, hh, mi) < nowMs) {
    if (y === now.y && mo === now.mo && d === now.d) {
      const t = new Date(Date.UTC(y, mo - 1, d + 1, hh, mi));
      return `${t.getUTCFullYear()}-${PAD(t.getUTCMonth() + 1)}-${PAD(t.getUTCDate())}T${PAD(hh)}:${PAD(mi)}:00`;
    }
    return `${y + 1}-${PAD(mo)}-${PAD(d)}T${PAD(hh)}:${PAD(mi)}:00`;
  }
  return `${y}-${PAD(mo)}-${PAD(d)}T${PAD(hh)}:${PAD(mi)}:00`;
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
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud no válida.", error: "bad_json" }, { status: 400 });
  }

  // LOG del body CRUDO → para saber EXACTAMENTE qué estructura y nombres manda Retell.
  try {
    console.log("[carmen/agendar] RAW keys:", Object.keys(body).join(","));
    console.log("[carmen/agendar] RAW body:", JSON.stringify(body).slice(0, 1800));
  } catch { /* noop */ }

  // Retell puede anidar los argumentos bajo distintas claves (args/arguments/parameters/
  // function.arguments/tool.arguments/call.arguments…) y a veces como STRING JSON.
  // Reunimos todos los contenedores posibles + la raíz en un único lookup ordenado.
  const asObj = (v: unknown): Record<string, unknown> | null => {
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    if (typeof v === "string" && v.trim().startsWith("{")) {
      try { const o = JSON.parse(v); if (o && typeof o === "object") return o as Record<string, unknown>; } catch { /* noop */ }
    }
    return null;
  };
  const fn = asObj(body.function) || {};
  const tool = asObj(body.tool) || {};
  const call = asObj(body.call) || {};
  const containers = [
    asObj(body.args),
    asObj(body.arguments),
    asObj(body.parameters),
    asObj(body.params),
    asObj(fn.arguments),
    asObj(tool.arguments),
    asObj(call.arguments),
    body, // raíz al final
  ].filter((c): c is Record<string, unknown> => c !== null);

  const get = (...keys: string[]): string | undefined => {
    for (const src of containers) {
      for (const k of keys) {
        const v = src[k];
        if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
      }
    }
    return undefined;
  };

  const nombre = get("nombre", "customer_name", "name", "cliente", "nombre_cliente");
  const motivo = get("motivo", "appointment_motivo", "reason", "servicio", "asunto", "tratamiento", "descripcion");
  const fechaRaw = get("fecha_hora", "fechaHora", "appointment_datetime", "datetime", "date_time", "fecha", "hora", "when", "cuando", "start", "startIso", "start_time");
  const fromNumber = String(call.from_number ?? "").trim() || undefined;
  const telefono = get("telefono", "customer_phone", "phone", "telefono_cliente", "numero") || fromNumber;
  const durationMin = Number(get("duracion_min", "duration_min", "duracion", "minutos")) || 30;
  // Salón (tenant) al que pertenece la cita. Retell lo manda en `slug`; si no viene,
  // caemos al salón piloto por defecto.
  const slug = get("slug", "salon", "negocio", "business", "tenant", "salon_slug") || DEFAULT_SLUG;

  console.log("[carmen/agendar] parsed:", JSON.stringify({ nombre, motivo, fechaRaw, telefono, durationMin, slug, call: call.call_id }).slice(0, 800));

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

  // 4) Reservar por el MOTOR DE BOOKING (crearReservaManual) → crea un BookingRecord
  // con `slug`, así la cita sale en /dashboard/reservas del salón, en el MISMO Google
  // Calendar (sin duplicar el evento) y con el anti-doble-reserva del booking.
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);

  const result = await crearReservaManual({
    slug,
    startIso,
    cliente: { nombre, telefono: telefono || "" },
    customNombre: motivo,
    customDurationMin: durationMin,
    redirectUri,
  });

  // 5) Traducir el resultado a algo que Carmen pueda decir (misma forma que antes)
  if (result.ok) {
    return NextResponse.json({
      success: true,
      message: `Perfecto, te he agendado ${formatoHumano(result.record.startIso)}. ¡Te esperamos!`,
      eventId: result.record.eventId,
      htmlLink: result.record.htmlLink,
      bookingId: result.record.id,
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
  // error (incluye agenda no conectada / sin tokens de Google, o salón no encontrado)
  return NextResponse.json({
    success: false,
    reason: "error",
    message: "Ahora mismo no puedo acceder a la agenda. Tomo tus datos y te confirmamos enseguida.",
    detail: result.detail,
  });
}
