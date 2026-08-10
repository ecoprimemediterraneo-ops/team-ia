// Detector de intención de "pedir cita" + orquestador de reserva.
//
// Lo usan Pablo (WhatsApp), Carmen (voz) y Eva (email) para que cualquier
// cliente que pida cita por su canal acabe creando la cita en Google
// Calendar vía agendarCita() y emitiendo appointment_set en el event-log.
//
// Flujo:
//   1. detectAppointmentIntent(text) — Haiku clasifica si hay intención de
//      cita y extrae los campos disponibles (nombre, motivo, dateTimeIso).
//   2. findFirstFreeSlot(...) — usa freeBusyQuery para encontrar un hueco
//      libre cercano al solicitado si el solicitado está ocupado.
//   3. tryAgendarFromText({...}) — pega los pasos: detectar → buscar hueco →
//      crear cita o devolver lo que falta.

import "server-only";
import { anthropic, MODELS } from "./claude";
import { freeBusyQuery, type AgendarCitaResult } from "./calendar";
import { DEFAULT_TENANT_ID } from "./tenants";
import type { EventChannel } from "./event-log";

const DEFAULT_DURATION_MIN = 30;
const FOUNDER_EMAIL_FALLBACK = "ecoprimemediterraneo@gmail.com";

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------

export type AppointmentIntent = {
  wantsAppointment: boolean;
  confidence: number;          // 0..1
  fields: {
    nombre?: string;
    motivo?: string;
    startIso?: string;         // ISO completa con fecha+hora si se pudo extraer
    /**
     * SOLO RESTAURACIÓN. Cuántos se sientan y dónde. Se extraen únicamente
     * cuando quien llama pide el modo restaurante; en los otros cuatro sectores
     * ni se piden al modelo ni se rellenan, así que el flujo de siempre no ve
     * ninguna diferencia.
     */
    comensales?: number;
    zona?: "terraza" | "interior" | "indiferente";
    /**
     * SOLO GESTORÍA. `consultaEstado` es la pregunta que más llamadas genera del
     * sector: "¿cómo va lo mío?". No es una cita, así que no entra en `missing`
     * ni bloquea nada; es una intención aparte que el webhook atiende antes.
     * `tramite` es el trámite que menciona, si menciona alguno, para no tener que
     * preguntarle cuál cuando ya lo ha dicho.
     */
    consultaEstado?: boolean;
    tramite?: string;
  };
  /** "personas" solo aparece en modo restaurante. La zona NUNCA bloquea. */
  missing: ("nombre" | "motivo" | "fecha_hora" | "personas")[];
  source: "ai" | "fallback";
};

/**
 * Qué sector está escuchando. Cambia lo que se le pide al modelo y qué se
 * considera imprescindible para cerrar.
 *
 * Restauración necesita el número de personas —una mesa de dos y una de doce no
 * son la misma reserva— y en cambio NO necesita "motivo": el motivo de ir a un
 * restaurante es comer. Pedírselo sonaría a formulario.
 */
export type ModoExtraccion = { restaurante?: boolean; gestoria?: boolean };

export type AgendarFromTextResult =
  | { kind: "no_intent" }
  | { kind: "incomplete"; missing: AppointmentIntent["missing"]; intent: AppointmentIntent }
  | { kind: "slot_taken"; suggested?: string; intent: AppointmentIntent }
  | { kind: "agendada"; result: Extract<AgendarCitaResult, { ok: true }>; intent: AppointmentIntent }
  | { kind: "error"; detail: string };

// -----------------------------------------------------------------------------
// Detección con Haiku
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT = `Eres un clasificador. Recibes UN mensaje de un cliente final (vía WhatsApp, voz transcrita o email) dirigido a un negocio de servicios. Tu trabajo es decidir si ese mensaje contiene la intención de RESERVAR una cita y, si es así, extraer los datos que se mencionen.

Devuelve EXCLUSIVAMENTE un objeto JSON, sin markdown ni explicaciones, con esta forma:
{
  "wantsAppointment": true|false,
  "confidence": 0.0-1.0,
  "nombre": "string o null",
  "motivo": "tratamiento/servicio que quiere o null",
  "startIso": "ISO 8601 local 'YYYY-MM-DDTHH:mm:ss' si se puede deducir, o null"
}

REGLAS para wantsAppointment=true:
- El cliente dice claramente que QUIERE reservar/agendar/pedir cita/hora/hueco. Ej: "Quiero pedir cita", "¿Tenéis hueco para X?", "Reserva para mañana", "Me podéis dar hora?".
- También cuenta si solo confirma un día/hora dentro de una conversación de reserva ("Vale, mañana a las 10").

NO cuenta como cita:
- Preguntas genéricas de información sin acción ("¿Cuánto cuesta una limpieza?").
- Quejas, agradecimientos, dudas técnicas, saludos.

REGLAS para los campos:
- nombre: si el cliente se identifica ("Soy María García") o ha escrito su nombre. null si no aparece.
- motivo: el servicio o tratamiento concreto que pide ("limpieza dental", "corte de pelo", "diagnóstico"). null si no se menciona.
- startIso: SOLO si en el mensaje hay día Y hora concretos. Resuelve relativos como "mañana", "el lunes", "la próxima semana" con respecto a HOY (que es la fecha pasada como contexto). Hora típica: HH:mm en 24h. Devuelve formato "YYYY-MM-DDTHH:mm:ss" SIN zona horaria (se asume Europe/Madrid). Si solo hay día sin hora, o solo hora sin día, devuelve null.

Si el mensaje no es de reserva, los campos pueden ir todos a null.`;

/**
 * Añadido SOLO para restaurantes. Se concatena al prompt de siempre en vez de
 * sustituirlo: la detección de intención y la resolución de fechas ya funcionan
 * y no se tocan.
 */
const EXTRA_RESTAURANTE = `

ESTE NEGOCIO ES UN RESTAURANTE. Añade DOS campos más al JSON:
{
  "comensales": número de personas que vienen, o null,
  "zona": "terraza" | "interior" | "indiferente" | null
}

REGLAS de esos dos campos:
- comensales: cualquier forma de decir cuántos son ("somos cuatro", "una mesa para 2", "seremos 6 o 7" → coge el mayor, "mi mujer y yo" → 2). null si no lo dicen.
- zona: "terraza" si la piden, "interior" si piden dentro/salón/comedor, e "indiferente" SOLO si dicen expresamente que les da igual. null si no lo mencionan.
- En un restaurante NO hace falta "motivo": el motivo es comer. Devuelve motivo null salvo que pidan algo concreto (menú degustación, celebración, evento).`;

/**
 * Añadido SOLO para gestorías. Igual que el de restaurante: se SUMA al prompt de
 * siempre, nunca lo sustituye.
 */
const EXTRA_GESTORIA = `

ESTE NEGOCIO ES UNA GESTORÍA. Añade DOS campos más al JSON:
{
  "consultaEstado": true|false,
  "tramite": "renta" | "nominas" | "autonomos" | "trimestrales" | "sociedades" | null
}

REGLAS de esos dos campos:
- consultaEstado: true si el cliente pregunta por el ESTADO de algo suyo ya en marcha: "¿cómo va lo mío?", "¿se sabe algo de mi renta?", "¿está ya el alta?", "¿lo habéis presentado?", "¿alguna novedad?". Es una pregunta por algo que YA existe, no una petición de trámite nuevo.
- consultaEstado: false si lo que pide es empezar un trámite, un precio, una cita o información general.
- tramite: el trámite concreto que menciona, si lo menciona. null si habla en general ("lo mío", "mi expediente").
- Una consulta de estado NO es una cita: en ese caso wantsAppointment va a false.`;

function fallbackDetection(text: string, modo?: ModoExtraccion): AppointmentIntent {
  const t = text.toLowerCase();
  const intentRe = /\b(reserva|reservar|cita|hueco|hora|agendar|agéndame|agendame|pedir cita|me das hora|mesa|book|appointment)\b/i;
  const wantsAppointment = intentRe.test(t);
  // Sin IA, el heurístico no adivina personas ni zona: los deja por preguntar,
  // que es exactamente lo que hace hoy con nombre y fecha.
  const missing: AppointmentIntent["missing"] = modo?.restaurante
    ? ["nombre", "fecha_hora", "personas"]
    : ["nombre", "motivo", "fecha_hora"];
  return {
    wantsAppointment,
    confidence: wantsAppointment ? 0.5 : 0,
    fields: {},
    missing: wantsAppointment ? missing : [],
    source: "fallback",
  };
}

/**
 * Detecta si el mensaje tiene intención de cita. Si no hay ANTHROPIC_API_KEY
 * o falla la IA, cae a un heurístico simple de regex.
 *
 * `referenceDate` (default: hoy) sirve para resolver "mañana", "lunes", etc.
 */
export async function detectAppointmentIntent(
  text: string,
  referenceDate: Date = new Date(),
  modo?: ModoExtraccion,
): Promise<AppointmentIntent> {
  if (!text?.trim()) {
    return { wantsAppointment: false, confidence: 0, fields: {}, missing: [], source: "fallback" };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackDetection(text, modo);
  }

  try {
    const ai = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 300,
      // El prompt de restaurante se SUMA al de siempre; sin el flag, el system
      // que se manda es byte por byte el que se mandaba antes.
      // Cada sector suma SU bloque; sin ninguno, el system es el de siempre.
      system: SYSTEM_PROMPT
        + (modo?.restaurante ? EXTRA_RESTAURANTE : "")
        + (modo?.gestoria ? EXTRA_GESTORIA : ""),
      messages: [
        {
          role: "user",
          content: `CONTEXTO TEMPORAL\nHoy es ${referenceDate.toISOString().slice(0, 10)} (${["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][referenceDate.getDay()]}).\n\nMENSAJE DEL CLIENTE\n"""${text.slice(0, 1500)}"""`,
        },
      ],
    });
    const raw = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallbackDetection(text, modo);

    let parsed: unknown;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return fallbackDetection(text, modo);
    }
    const j = parsed as {
      wantsAppointment?: boolean;
      confidence?: number;
      nombre?: string | null;
      motivo?: string | null;
      startIso?: string | null;
      comensales?: number | string | null;
      zona?: string | null;
      consultaEstado?: boolean | null;
      tramite?: string | null;
    };

    const wantsAppointment = !!j.wantsAppointment;
    const confidence = Number.isFinite(j.confidence) ? Math.max(0, Math.min(1, j.confidence!)) : 0.7;
    const nombre = typeof j.nombre === "string" && j.nombre.trim() ? j.nombre.trim() : undefined;
    const motivo = typeof j.motivo === "string" && j.motivo.trim() ? j.motivo.trim() : undefined;
    const startIso = typeof j.startIso === "string" && j.startIso.trim() ? j.startIso.trim() : undefined;

    // --- Restauración: personas y zona ---
    const nPersonas = Number(j.comensales);
    const comensales = modo?.restaurante && Number.isFinite(nPersonas) && nPersonas > 0
      ? Math.min(99, Math.round(nPersonas))
      : undefined;
    const zonaCruda = typeof j.zona === "string" ? j.zona.trim().toLowerCase() : "";
    const zona = modo?.restaurante && (zonaCruda === "terraza" || zonaCruda === "interior" || zonaCruda === "indiferente")
      ? (zonaCruda as "terraza" | "interior" | "indiferente")
      : undefined;

    // --- Gestoría: consulta de estado ---
    const consultaEstado = modo?.gestoria ? j.consultaEstado === true : undefined;
    const tramite = modo?.gestoria && typeof j.tramite === "string" && j.tramite.trim()
      ? j.tramite.trim().toLowerCase()
      : undefined;

    const missing: AppointmentIntent["missing"] = [];
    if (wantsAppointment) {
      if (!nombre) missing.push("nombre");
      // En un restaurante el "motivo" es comer: pedirlo suena a formulario. Lo
      // que sí es imprescindible es cuántos son.
      if (modo?.restaurante) {
        if (!comensales) missing.push("personas");
      } else if (!motivo) {
        missing.push("motivo");
      }
      if (!startIso) missing.push("fecha_hora");
    }

    return {
      wantsAppointment,
      confidence,
      // La zona NO entra en `missing` nunca: es opcional, y si el cliente dice
      // que le da igual se guarda "indiferente" y no se vuelve a sacar el tema.
      fields: { nombre, motivo, startIso, comensales, zona, consultaEstado, tramite },
      missing,
      source: "ai",
    };
  } catch (err) {
    console.error("[appointment-intent] AI detect falló:", err);
    return fallbackDetection(text, modo);
  }
}

// -----------------------------------------------------------------------------
// Búsqueda de hueco libre cercano
// -----------------------------------------------------------------------------

/**
 * Comprueba si el slot `[startIso, +durationMin]` está libre en el calendario
 * del usuario. Si no, busca el siguiente hueco libre del mismo día (horario
 * 9-19h, paso de 30 min).
 *
 * Devuelve:
 *   { available: true } → el slot original está libre, úsalo.
 *   { available: false, suggested: ISO } → ocupado, propuesta alternativa.
 *   { available: false } → ocupado y sin alternativa libre ese día.
 */
export async function findFreeSlot(opts: {
  userEmail: string;
  redirectUri: string;
  startIso: string;            // ISO local "YYYY-MM-DDTHH:mm:ss"
  durationMin?: number;
}): Promise<{ available: boolean; suggested?: string }> {
  const duration = opts.durationMin ?? DEFAULT_DURATION_MIN;
  const start = new Date(opts.startIso);
  if (isNaN(start.getTime())) return { available: false };
  const end = new Date(start.getTime() + duration * 60_000);

  // Pedimos el día entero para iterar slots si hay conflicto.
  const dayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
  const dayEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59);

  const fb = await freeBusyQuery(opts.userEmail, opts.redirectUri, dayStart.toISOString(), dayEnd.toISOString());
  if (!fb.ok) return { available: false };

  const overlaps = (s: number, e: number) =>
    fb.busy.some((b) => {
      const bs = new Date(b.start).getTime();
      const be = new Date(b.end).getTime();
      return bs < e && be > s;
    });

  if (!overlaps(start.getTime(), end.getTime())) {
    return { available: true };
  }

  // Buscar siguiente hueco del mismo día (9-19h, paso 30 min) tras el solicitado
  const WINDOW_START_H = 9;
  const WINDOW_END_H = 19;
  let cursor = new Date(start.getTime());
  if (cursor.getHours() < WINDOW_START_H) cursor.setHours(WINDOW_START_H, 0, 0, 0);
  while (cursor.getHours() < WINDOW_END_H) {
    cursor = new Date(cursor.getTime() + 30 * 60_000);
    const cEnd = new Date(cursor.getTime() + duration * 60_000);
    if (cEnd.getHours() > WINDOW_END_H || (cEnd.getHours() === WINDOW_END_H && cEnd.getMinutes() > 0)) break;
    if (!overlaps(cursor.getTime(), cEnd.getTime())) {
      // Formato local ISO sin TZ para casar con agendarCita
      const pad = (n: number) => String(n).padStart(2, "0");
      const suggestedIso = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}T${pad(cursor.getHours())}:${pad(cursor.getMinutes())}:00`;
      return { available: false, suggested: suggestedIso };
    }
  }
  return { available: false };
}

// -----------------------------------------------------------------------------
// Orquestador end-to-end
// -----------------------------------------------------------------------------

export async function tryAgendarFromText(opts: {
  text: string;
  agenteOrigen: EventChannel;
  tenantId?: string;
  founderEmail?: string;        // override; default FOUNDER_EMAIL env
  redirectUri: string;          // del entorno actual (host/proto)
  customerPhone?: string;
  customerNameFallback?: string;
  durationMin?: number;
  intentOverride?: AppointmentIntent; // si Carmen/Eva ya extrajeron campos, los inyectamos
  /** Modo restaurante: extrae personas y zona, y no exige "motivo". */
  modo?: ModoExtraccion;
}): Promise<AgendarFromTextResult> {
  const tenantId = opts.tenantId || DEFAULT_TENANT_ID;
  const founderEmail = opts.founderEmail || process.env.FOUNDER_EMAIL || FOUNDER_EMAIL_FALLBACK;

  const intent = opts.intentOverride ?? (await detectAppointmentIntent(opts.text, new Date(), opts.modo));
  if (!intent.wantsAppointment) return { kind: "no_intent" };

  // Aplica fallback de nombre si no se detectó pero nos lo pasaron
  if (!intent.fields.nombre && opts.customerNameFallback) {
    intent.fields.nombre = opts.customerNameFallback;
    intent.missing = intent.missing.filter((m) => m !== "nombre");
  }

  if (intent.missing.length > 0) {
    return { kind: "incomplete", missing: intent.missing, intent };
  }

  // Reserva a través del ORQUESTADOR central (verifica hueco + lock + log).
  // Import dinámico para evitar ciclo de carga en tiempo de módulo
  // (orchestrator importa findFreeSlot de aquí).
  const { reservarSlot } = await import("./orchestrator");
  try {
    const res = await reservarSlot({
      tenantId,
      userEmail: founderEmail,
      redirectUri: opts.redirectUri,
      nombre: intent.fields.nombre!,
      // En restauración el motivo no se pide: se pone uno fijo para que la
      // agenda y el evento de Google sigan teniendo texto, como el resto.
      motivo: intent.fields.motivo || (opts.modo?.restaurante ? "Mesa" : intent.fields.motivo!),
      startIso: intent.fields.startIso!,
      durationMin: opts.durationMin ?? DEFAULT_DURATION_MIN,
      agenteOrigen: opts.agenteOrigen,
      customerPhone: opts.customerPhone,
      // Van como opcionales: en los otros sectores llegan undefined y todo se
      // comporta igual que antes.
      comensales: intent.fields.comensales,
      zona: intent.fields.zona,
    });
    if (res.ok) {
      return {
        kind: "agendada",
        result: { ok: true, eventId: res.eventId, htmlLink: res.htmlLink, eventLogId: res.eventLogId ?? "" },
        intent,
      };
    }
    if (res.reason === "slot_taken") return { kind: "slot_taken", suggested: res.suggested, intent };
    if (res.reason === "locked") return { kind: "slot_taken", intent }; // otro agente reservando este hueco
    return { kind: "error", detail: res.detail };
  } catch (err) {
    return { kind: "error", detail: err instanceof Error ? err.message : String(err) };
  }
}

// -----------------------------------------------------------------------------
// Helpers de mensaje (para que Pablo/Carmen/Eva respondan al cliente)
// -----------------------------------------------------------------------------

export function missingFieldsToQuestion(
  missing: AppointmentIntent["missing"],
  modo?: ModoExtraccion,
): string {
  if (missing.length === 0) return "";
  // Pregunta solo por UNO (el más prioritario) para no saturar.
  if (modo?.restaurante) {
    // En restauración se juntan día/hora y personas en UNA sola pregunta cuando
    // faltan las dos: "¿para qué día y cuántos sois?" es como se pregunta por
    // teléfono. Encadenar dos preguntas seguidas es lo que suena a interrogatorio.
    const faltaHora = missing.includes("fecha_hora");
    const faltanPersonas = missing.includes("personas");
    if (faltaHora && faltanPersonas) return "¿Para qué día y hora, y cuántos sois?";
    if (faltaHora) return "¿Qué día y a qué hora?";
    if (faltanPersonas) return "¿Cuántos sois?";
    if (missing.includes("nombre")) return "¿A nombre de quién la pongo?";
    return "";
  }
  if (missing.includes("fecha_hora")) return "¿Qué día y a qué hora te viene bien?";
  if (missing.includes("motivo")) return "¿Para qué tratamiento o servicio?";
  if (missing.includes("nombre")) return "¿A nombre de quién la pongo?";
  return "";
}

/**
 * La pregunta de la zona, que va APARTE de `missing` porque nunca bloquea la
 * reserva. Se hace una sola vez y solo si el cliente no ha dicho nada.
 *
 * Con ficha previa no se pregunta en frío: se propone lo de siempre, que es lo
 * que hace un maître que te conoce.
 */
export function preguntaZona(
  zonaYaDicha: string | undefined,
  zonaHabitual?: "terraza" | "interior" | "indiferente",
): string {
  if (zonaYaDicha) return "";
  if (zonaHabitual === "terraza") return "¿Como siempre, en terraza?";
  if (zonaHabitual === "interior") return "¿Como siempre, en el interior?";
  return "¿Prefieres terraza o interior?";
}

export function formatStartHumanES(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const fecha = d.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${fecha} a las ${hora}`;
}
