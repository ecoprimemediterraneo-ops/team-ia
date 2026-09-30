// =============================================================================
// POST /api/carmen/agendar — FUNCTION DE RETELL (en directo, durante la llamada)
//
// Carmen (agente de voz en Retell) llama a esta URL como "Custom Function"
// MIENTRAS habla con el cliente. Reserva por el MOTOR DE BOOKING (crearReservaManual):
// crea un BookingRecord con `slug` → la cita sale en /dashboard/clientes del salón, en
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
import { resolverSalonDeLlamada, MENSAJE_SIN_SALON } from "@/lib/carmen-salon";
import { headers } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { normalizarFecha, PASADO } from "@/lib/fecha-es";
import { getBusinessBySlug, citaGuardada, servicioPedido } from "@/lib/booking";
import { reservarSlot } from "@/lib/orchestrator";
import { agenteContratado } from "@/lib/tenants";
import { huecosCercanos, listaDeOpciones } from "@/lib/guion-huecos";
import { idiomaDe } from "@/lib/carmen-llamadas";
import { getRedirectUri } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Salón por defecto si Retell no envía `slug` (la cuenta piloto de Carmen).
// (el salón por defecto lo resuelve ahora `carmen-salon.ts`)


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

  // OJO: "name" NO es el nombre del cliente. En la raíz del cuerpo Retell manda
  // `name: "agendar_cita"` (el nombre de la FUNCIÓN): si Carmen no pasaba el
  // nombre, la cita se guardaba a nombre de "agendar_cita" (llamada del 29/09).
  const nombreCrudo = get("nombre", "customer_name", "cliente", "nombre_cliente");
  const nombre = nombreCrudo && !/^(agendar_cita|gestionar_cita|cancelar|urgencia)$/i.test(nombreCrudo) ? nombreCrudo : undefined;
  // INGLÉS: Retell manda `idioma: "en"` (o se deduce de lo que ha dicho el
  // cliente). Lo que Carmen lee en voz alta sale en su idioma.
  const idiomaPedido = (get("idioma", "language", "lang") || "").toLowerCase();
  const motivo = get("motivo", "appointment_motivo", "reason", "servicio", "asunto", "tratamiento", "descripcion");
  const fechaRaw = get("fecha_hora", "fechaHora", "appointment_datetime", "datetime", "date_time", "fecha", "hora", "when", "cuando", "start", "startIso", "start_time");
  const fromNumber = String(call.from_number ?? "").trim() || undefined;
  const toNumber = String(call.to_number ?? "").trim() || undefined;
  const telefono = get("telefono", "customer_phone", "phone", "telefono_cliente", "numero") || fromNumber;
  // Solo si Retell la dice. Sin ella manda la duración del servicio (un color no dura 30 min).
  const durationMin = Number(get("duracion_min", "duration_min", "duracion", "minutos")) || undefined;
  const profesionalPedida = get("profesional", "empleado", "estilista", "con", "con_quien");
  // Salón (tenant) al que pertenece la cita. Ver `carmen-salon.ts`: PRIMERO
  // por el número al que ha llamado (`call.to_number`, igual que Pablo
  // resuelve por `phone_number_id` de WhatsApp); si no se puede saber de qué
  // negocio es, NO se adivina (antes caía al salón piloto, o sea a la agenda
  // de otro).
  const salon = await resolverSalonDeLlamada(get("slug", "salon", "negocio", "business", "tenant", "salon_slug"), toNumber);
  if (!salon.ok) {
    return NextResponse.json({
      success: false,
      reason: salon.motivo === "no_existe" ? "salon_desconocido" : "salon_ambiguo",
      message: MENSAJE_SIN_SALON,
    });
  }
  const slug = salon.slug;
  // Multi-marca: si este negocio no ha contratado a Carmen, no reserva.
  if (!(await agenteContratado(salon.tenantId, "carmen"))) {
    console.warn(`[carmen/agendar] el tenant ${salon.tenantId} no tiene contratada a Carmen`);
    return NextResponse.json({ success: false, reason: "agente_no_contratado", message: MENSAJE_SIN_SALON });
  }

  console.log("[carmen/agendar] parsed:", JSON.stringify({ nombre, motivo, fechaRaw, telefono, durationMin, slug, call: call.call_id }).slice(0, 800));

  // Todo lo que sigue va dentro de un try: Carmen NUNCA recibe un 500. Un error
  // técnico (Supabase lento, por ejemplo) se convierte en una frase que puede
  // decir y en un reintento, no en "no estamos abiertos" ni en "ya te llamaremos".
  try {
    return await agendarEnLlamada({ req, get, nombre, motivo, fechaRaw, telefono, durationMin, profesionalPedida, idiomaPedido, salon, slug, callId: String(call.call_id ?? "") });
  } catch (err) {
    console.error("[carmen/agendar] error inesperado:", err);
    return NextResponse.json({
      success: false,
      reason: "error_temporal",
      hoy: hoyHablado(),
      message: "Perdona, se me ha trabado la agenda un segundo. ¿Me repites el día y la hora y lo vuelvo a mirar?",
    });
  }
}

/** "martes 29 de septiembre de 2026" (hoy, en Madrid). Va en TODAS las respuestas: Carmen no sabe qué día es. */
function hoyHablado(): string {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const d = new Date(`${hoy}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()} (${hoy})`;
}

async function agendarEnLlamada(o: {
  req: Request; get: (...k: string[]) => string | undefined; nombre?: string; motivo?: string; fechaRaw?: string; telefono?: string;
  durationMin?: number; profesionalPedida?: string; idiomaPedido: string; salon: { tenantId: string; slug: string }; slug: string; callId: string;
}): Promise<NextResponse> {
  const { get, nombre, telefono, durationMin, profesionalPedida, idiomaPedido, salon, slug } = o;
  let motivo = o.motivo;
  let fechaRaw = o.fechaRaw;
  const hoy = hoyHablado();
  const hoyIso = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const responder = (b: Record<string, unknown>) => NextResponse.json({ ...b, hoy });

  // 3) Validaciones → respuestas hablables (200, para que Carmen siga la conversación)
  // LO QUE DIJO EL CLIENTE manda sobre la fecha que calcula el modelo de voz: el
  // modelo no sabe qué día es hoy y convertía "mañana" en una fecha de junio.
  const fechaTexto = get("fecha_texto", "lo_que_dijo", "fecha_dicha", "cuando_dijo");
  if (fechaTexto) {
    const deTexto = normalizarFecha(fechaTexto);
    if (deTexto && deTexto !== PASADO && ISO_RE.test(deTexto) && (!fechaRaw || !ISO_RE.test(fechaRaw) || deTexto.slice(0, 10) !== fechaRaw.slice(0, 10))) {
      console.log(`[carmen/agendar] fecha corregida por lo que dijo el cliente: "${fechaTexto}" → ${deTexto} (el modelo mandó ${fechaRaw ?? "nada"})`);
      fechaRaw = fechaRaw && ISO_RE.test(fechaRaw) && !parseHoraOk(deTexto) ? `${deTexto.slice(0, 10)}T${fechaRaw.slice(11, 19)}` : deTexto;
    } else if (deTexto === PASADO) fechaRaw = deTexto;
  }
  if (!nombre || !motivo || !fechaRaw) {
    return responder({
      success: false,
      reason: "missing_fields",
      message: !nombre && motivo && fechaRaw
        ? "¿A nombre de quién pongo la cita?"
        : "Me faltan datos para agendar: necesito el nombre, el motivo y la fecha con la hora.",
      missing: { nombre: !nombre, motivo: !motivo, fecha_hora: !fechaRaw },
    });
  }
  const en = idiomaPedido.startsWith("en") || (!idiomaPedido && idiomaDe(`${motivo ?? ""} ${fechaRaw}`) === "en");
  const L = (es: string, ing: string) => (en ? ing : es);
  const startIso = normalizarFecha(fechaRaw);
  const negocio = await getBusinessBySlug(slug);
  // Siempre DOS huecos libres de verdad, los más cercanos (mismo día o siguientes),
  // en texto para decirlos y en ISO para reservar el elegido sin volver a calcular la fecha.
  const ofrecer = async (desde: string) => {
    const opciones = await huecosCercanos(salon.tenantId, { startIso: desde, motivo: motivo || "" }).catch(() => [] as string[]);
    const texto = opciones.length
      ? L(` Te puedo ofrecer ${listaDeOpciones(opciones)}. ¿Cuál te viene mejor?`, ` I can offer ${opciones.map((x) => `${x.slice(0, 10)} at ${x.slice(11, 16)}`).join(" or ")}. Which suits you?`)
      : L(" ¿Qué otro día te vendría bien?", " What other day would suit you?");
    return { texto, opciones };
  };
  if (startIso === PASADO) {
    const of = await ofrecer(`${hoyIso}T23:59:00`);
    return responder({
      success: false,
      reason: "pasado",
      opciones: of.opciones,
      message: `${L("Esa hora de hoy ya ha pasado.", "That time today has already passed.")}${of.texto}`,
    });
  }
  if (!ISO_RE.test(startIso) || isNaN(new Date(startIso).getTime())) {
    return responder({
      success: false,
      reason: "bad_datetime",
      message: L("No he entendido bien la fecha y la hora. ¿Me la repites con día y hora?", "Sorry, I didn't catch the date and time. Could you repeat the day and the time?"),
    });
  }
  // FECHA YA PASADA (un día anterior a hoy): casi siempre es el modelo de voz, que
  // no sabe qué día es. NUNCA se dice "cerrado": se le recuerda qué día es hoy y
  // se ofrecen los dos huecos libres más cercanos a partir de hoy.
  if (startIso.slice(0, 10) < hoyIso) {
    const of = await ofrecer(`${hoyIso}T${startIso.slice(11, 19)}`);
    return responder({
      success: false,
      reason: "fecha_pasada",
      opciones: of.opciones,
      nota_para_carmen: `La fecha ${startIso.slice(0, 10)} ya ha pasado: hoy es ${hoy}. Vuelve a calcular la fecha que ha dicho el cliente a partir de hoy (mañana es ${new Date(Date.parse(`${hoyIso}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)}) y llama otra vez a agendar_cita, pasando también fecha_texto con sus palabras.`,
      message: L(`Perdona, déjame confirmar el día: hoy es ${hoy.replace(/ \(.*\)$/, "")}.${of.texto}`, `Sorry, let me check the day: today is ${hoyIso}.${of.texto}`),
    });
  }

  // 4) Reservar por el ORQUESTADOR, igual que Pablo y Marta.
  //
  // ANTES iba por `crearReservaManual`, que es la cita que mete el dueño a mano:
  // NO mira el horario ni la antelación (se podía reservar a las 3 de la mañana,
  // un domingo cerrado o una hora ya pasada), guardaba el motivo como un servicio
  // inventado de 30 minutos (un color de 90 ocupaba 30) y, al no saber el
  // servicio, asignaba a cualquier profesional aunque no lo hiciera. Ahora pasa
  // por `reservarSlot`: horario, antelación, servicio real con su duración,
  // profesional que lo hace, y el MISMO candado por negocio y día que el resto.
  const h2 = await headers();
  const host = h2.get("x-forwarded-host") || h2.get("host") || "localhost:3000";
  const proto = h2.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const emp = profesionalPedida
    ? (negocio?.empleados || []).find((e) => e.activo && norm(e.nombre).split(/\s+/)[0] === norm(profesionalPedida).split(/\s+/)[0])
    : undefined;

  // "LO DE SIEMPRE": su servicio habitual y, si no pide otra, su profesional.
  let profesionalHabitualId: string | undefined;
  if (negocio && telefono && /\b(lo de siempre|lo mismo|lo habitual|como siempre|the usual)\b/i.test(motivo || "")) {
    const { leerMemoria } = await import("@/lib/memoria-clienta");
    const mem = await leerMemoria(negocio.slug, telefono).catch(() => null);
    if (mem?.habitual) {
      motivo = mem.habitual.servicio;
      profesionalHabitualId = mem.habitual.empleadoId;
    }
  }

  // SERVICIO QUE EL SALÓN NO TIENE: se dice y se ofrecen los que sí hay. Nunca se
  // guarda "por defecto" el primero de la lista (29/09: un "blanqueamiento" acabó
  // guardado como "Depilación de cejas").
  if (negocio && !servicioPedido(negocio, motivo!)) {
    const hay = negocio.servicios.filter((x) => x.activo).map((x) => x.nombre);
    return responder({
      success: false,
      reason: "servicio_no_disponible",
      message: L(
        `Eso no lo hacemos en ${negocio.nombre}. Lo que sí tenemos es: ${hay.join(", ")}. ¿Te interesa alguno?`,
        `We don't offer that at ${negocio.nombre}. What we do offer: ${hay.join(", ")}. Would any of these suit you?`,
      ),
      servicios: hay,
      nota_para_carmen: "El servicio pedido no existe en este negocio: NO confirmes ninguna cita. Ofrece los servicios de la lista y, si elige uno, vuelve a llamar a agendar_cita con ese servicio.",
    });
  }

  const pedir = () => reservarSlot({
    tenantId: salon.tenantId,
    userEmail: process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com",
    redirectUri,
    nombre: nombre!,
    motivo: motivo!,
    startIso,
    durationMin,
    agenteOrigen: "carmen",
    customerPhone: telefono,
    empleadoId: emp?.id ?? profesionalHabitualId,
    confirmarAlColgar: true,
  });
  let result = await pedir();
  // Un fallo técnico o la agenda ocupada un instante: se reintenta UNA vez antes de decir nada.
  if (!result.ok && (result.reason === "error" || result.reason === "locked")) {
    console.warn(`[carmen/agendar] reintento tras ${result.reason}${result.reason === "error" ? `: ${result.detail}` : ""}`);
    await new Promise((r) => setTimeout(r, 800));
    result = await pedir();
  }

  // ÉXITO DE VERDAD = la cita está GUARDADA en la agenda del negocio. Si no se
  // puede comprobar, Carmen no confirma: una cita que no queda guardada no existe.
  if (result.ok && negocio) {
    if (!(await citaGuardada(result.recordId, startIso))) {
      console.error(`[carmen/agendar] RESERVA SIN GUARDAR: ok del orquestador pero la cita ${result.recordId ?? "(sin id)"} no está en la agenda de ${negocio.slug} (evento ${result.eventId}).`);
      return responder({
        success: false,
        reason: "no_guardada",
        message: L("Perdona, no he podido dejar la cita guardada, así que todavía no está confirmada. ¿Lo intento otra vez?", "Sorry, I couldn't save the appointment, so it isn't confirmed yet. Shall I try again?"),
        nota_para_carmen: "La cita NO ha quedado guardada: no la confirmes ni digas que le llegará confirmación.",
      });
    }
  }
  if (result.ok) {
    return responder({
      success: true,
      confirmada: true,
      recordId: result.recordId,
      message: L(`Perfecto, te he agendado ${formatoHumano(startIso)}. ¡Te esperamos!`, `Perfect, you're booked for ${startIso.slice(0, 10)} at ${startIso.slice(11, 16)}. See you then!`),
      eventId: result.eventId,
      htmlLink: result.htmlLink,
    });
  }
  if (result.reason === "slot_taken") {
    // "Cerrado" SOLO si de verdad ese día/hora está fuera del horario del negocio.
    const porque =
      result.motivo === "pasado" ? L("Esa hora ya ha pasado o es demasiado pronto para reservarla.", "That time has passed or is too soon to book.")
      : result.motivo === "fuera_de_horario" ? L("A esa hora no tenemos hueco.", "We don't have availability at that time.")
      : L("Ese hueco está ocupado.", "That slot is taken.");
    const of = await ofrecer(startIso);
    return responder({
      success: false,
      reason: "slot_taken",
      motivo: result.motivo,
      opciones: of.opciones,
      message: `${porque}${of.texto}`,
      suggested: result.suggested,
    });
  }
  // Error técnico que persiste tras el reintento: se ofrecen igualmente huecos si se
  // pueden calcular, y si no, se pide repetir. Nunca "cerrado" ni "ya te llamaremos".
  const of = await ofrecer(startIso).catch(() => ({ texto: "", opciones: [] as string[] }));
  return responder({
    success: false,
    reason: result.reason === "locked" ? "locked" : "error",
    opciones: of.opciones,
    message: of.opciones.length
      ? L(`Perdona, esa hora no me deja cerrarla ahora mismo.${of.texto}`, `Sorry, I can't confirm that time right now.${of.texto}`)
      : L("Perdona, se me ha trabado la agenda un segundo. ¿Me repites el día y la hora y lo vuelvo a mirar?", "Sorry, the diary got stuck for a second. Could you repeat the day and time?"),
    detail: result.reason === "error" ? result.detail : undefined,
  });
}

/** ¿Trae hora la fecha resuelta de lo que dijo el cliente? (si no, se conserva la del modelo). */
function parseHoraOk(iso: string): boolean {
  return /T\d{2}:\d{2}/.test(iso) && iso.slice(11, 16) !== "00:00";
}
