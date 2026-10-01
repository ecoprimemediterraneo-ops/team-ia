// =============================================================================
// Orquestador central de reservas — el "cerebro" de la agenda compartida.
// =============================================================================
//
// NO es un personaje ni un agente con cara. Es lógica central. Pablo, Carmen,
// Eva y Lucía NO llaman ya a agendarCita() directamente: pasan por aquí. El
// cliente nunca lo ve.
//
// Qué resuelve (lo que antes faltaba):
//   1. Verificación de disponibilidad ANTES de crear la cita (ya existía en
//      appointment-intent.findFreeSlot, pero Lucía la saltaba).
//   2. Lock / cola para que DOS agentes que piden el MISMO hueco a la vez no
//      creen dos citas solapadas (race condition de doble-booking).
//   3. Log de CADA decisión en el event-log (no solo las citas creadas:
//      también los rechazos por conflicto y los bloqueos por lock).
//
// Estrategia de concurrencia (dos capas):
//   - Mutex en memoria por slot: serializa llamadas dentro de la MISMA
//     instancia serverless. Elimina el doble-booking del caso más común
//     (dos webhooks que caen en el mismo lambda).
//   - Lock distribuido best-effort en kv_store (Supabase) con TTL: cubre el
//     caso de dos instancias distintas. Tras adquirirlo, SIEMPRE se re-consulta
//     Google Calendar (fuente de verdad) justo antes de crear, dejando la
//     ventana de carrera en milisegundos. Si no hay Supabase (local), se confía
//     solo en el mutex en memoria.
//
// Para single-tenant beta con baja concurrencia esto es más que suficiente.
// Cuando escale a multi-tenant alto volumen: mover el lock a un INSERT atómico
// con tabla dedicada y constraint único (ver kvTryLock en supabase.ts).
// =============================================================================

import "server-only";
import { agendarCita } from "./calendar";
import { findFreeSlot } from "./appointment-intent";
import { logEvent, makeEventId, getMonthEvents, monthKey, type EventChannel, type AnalyticsEvent } from "./event-log";
import { DEFAULT_TENANT_ID } from "./tenants";
import { kvTryLock, kvUnlock, supabaseEnabled } from "./supabase";
import { reservarSlotBooking } from "./booking-orchestrator";

const DEFAULT_DURATION_MIN = 30;
const LOCK_TTL_MS = 30_000;

// Agentes de AI-Team cuyas citas se registran además como BookingRecord (visibles y
// cancelables en /dashboard/clientes, sujetas a anti-doble-reserva por records y con
// aviso al dueño). TODOS pasan por reservarSlot(): el record apunta al MISMO evento de
// Google que se acaba de crear, sin segundo evento ni segundo camino de reserva.
// Añadir un canal aquí es lo único necesario para unificarlo al motor.
const AGENTES_CON_RECORD: ReadonlySet<EventChannel> = new Set<EventChannel>([
  "pablo",
  "carmen",
  "eva",
  "lucia",
  "marta",
  // "dashboard": citas creadas desde el chat del propio panel (confirmadas por
  // el dueño, no por un cliente externo) — dental, por ahora.
  "dashboard",
]);

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------

export type ReservaInput = {
  tenantId?: string;
  userEmail: string;
  redirectUri: string;
  nombre: string;
  motivo: string;
  startIso: string;
  durationMin?: number;
  agenteOrigen: EventChannel;
  customerPhone?: string;
  attendees?: string[];
  location?: string;
  /**
   * SOLO RESTAURACIÓN. Cuántos se sientan y dónde. Viajan hasta el
   * `BookingRecord` y hasta los metadatos del evento del informe mensual. En los
   * otros sectores llegan `undefined` y nada cambia.
   */
  comensales?: number;
  zona?: "terraza" | "interior" | "indiferente";
  /** Solo para pruebas locales sin tokens de Google: simula la disponibilidad. */
  simulate?: boolean;
  /**
   * Preparación del servicio. Si el tenant tiene negocio de reservas y no se dice
   * `durationMin`, duración y padding salen del servicio que corresponde al
   * motivo (el mismo criterio de la lista de huecos).
   */
  paddingBeforeMin?: number;
  paddingAfterMin?: number;
  /** Profesional pedida (negocios con personal). Sin ella se asigna la primera libre que haga el servicio. */
  empleadoId?: string;
  /**
   * El servicio YA ELEGIDO (id del catálogo). Lo pasan los chats del panel, que
   * ya han confirmado con la dueña cuál es: sin esto se volvía a deducir del
   * texto y «Corte» podía guardarse como «Corte y peinado».
   */
  serviceId?: string;
  /**
   * Cita cogida EN UNA LLAMADA de Carmen: la confirmación al cliente (WhatsApp
   * con plantilla) no sale ahora, sino al colgar, desde el webhook de fin de
   * llamada, junto con cualquier cambio o anulación de esa misma llamada. El
   * aviso al dueño sí sale al momento.
   */
  confirmarAlColgar?: boolean;
  /** La confirmación va en la respuesta de la conversación (Pablo): sin el aviso automático al cliente. */
  confirmacionEnConversacion?: boolean;
};

export type ReservaResult =
  | { ok: true; eventId: string; htmlLink?: string; eventLogId?: string; simulated?: boolean; /** La cita GUARDADA en la agenda del negocio (si lo tiene). */ recordId?: string }
  | { ok: false; reason: "slot_taken"; suggested?: string; motivo?: "fuera_de_horario" | "pasado" | "ocupado" | "no_calendar" }
  | { ok: false; reason: "locked" }
  | { ok: false; reason: "error"; detail: string };

export type OrquestadorDecision =
  | "booked"
  | "rejected_conflict"
  | "locked"
  | "error";

// -----------------------------------------------------------------------------
// Mutex en memoria por slot (serializa dentro de la misma instancia)
// -----------------------------------------------------------------------------

const inflight = new Map<string, Promise<unknown>>();

function withSlotMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = inflight.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  // Guardamos la cola (ignorando errores para no romper la cadena del siguiente).
  inflight.set(key, run.catch(() => undefined));
  // Limpieza: si esta es la última de la cola, libera la entrada del Map.
  run.catch(() => undefined).finally(() => {
    if (inflight.get(key) === undefined) inflight.delete(key);
  });
  return run;
}

// -----------------------------------------------------------------------------
// Log de decisiones
// -----------------------------------------------------------------------------

async function logDecision(
  tenantId: string,
  decision: OrquestadorDecision,
  data: {
    agenteOrigen: EventChannel;
    nombre: string;
    motivo: string;
    startIso: string;
    durationMin: number;
    suggested?: string;
    eventId?: string;
    detail?: string;
    simulated?: boolean;
  },
): Promise<void> {
  try {
    await logEvent(tenantId, {
      id: makeEventId("orchestrator", decision, data.startIso, data.agenteOrigen, String(Date.now())),
      type: "orchestrator_decision",
      channel: "system",
      meta: {
        tipo: "orquestador",
        decision,
        agenteOrigen: data.agenteOrigen,
        nombre: data.nombre,
        motivo: data.motivo,
        startIso: data.startIso,
        durationMin: data.durationMin,
        ...(data.suggested ? { suggested: data.suggested } : {}),
        ...(data.eventId ? { eventId: data.eventId } : {}),
        ...(data.detail ? { detail: data.detail } : {}),
        ...(data.simulated ? { simulated: true } : {}),
      },
    });
  } catch (err) {
    console.error("[orchestrator] no se pudo loguear la decisión:", err);
  }
}

// -----------------------------------------------------------------------------
// API pública — el punto único de reserva
// -----------------------------------------------------------------------------

/**
 * Reserva un hueco de forma segura. Punto ÚNICO por el que pasan todos los
 * agentes. Verifica disponibilidad, evita doble-booking con lock, crea la cita
 * y registra la decisión en el event-log.
 */
export async function reservarSlot(input: ReservaInput): Promise<ReservaResult> {
  const tenantId = input.tenantId || DEFAULT_TENANT_ID;

  // UN SOLO CAMINO cuando el tenant tiene negocio de reservas: la disponibilidad
  // se pregunta con la MISMA función que la lista de huecos (horario, antelación,
  // duración y padding del servicio, reservas y bloqueos propios, y Google solo si
  // el negocio lo tiene conectado), el candado es el de la agenda del negocio (el
  // mismo que usa la reserva online, así que chat, Pablo, Carmen, Marta y la web
  // pública no se pisan) y la cita se guarda DENTRO del candado. Sin negocio (la
  // cuenta comercial de AI-Team) sigue el camino de siempre, contra Google.
  if (!input.simulate) {
    const negocio = await reservarConNegocio(input, tenantId);
    if (negocio) return negocio;
  }
  const durationMin = input.durationMin ?? DEFAULT_DURATION_MIN;
  const slotKey = `${tenantId}|${input.startIso}|${durationMin}`;

  const result: ReservaResult = await withSlotMutex(slotKey, async (): Promise<ReservaResult> => {
    const lockKey = `lock:cita:${slotKey}`;
    const baseLog = {
      agenteOrigen: input.agenteOrigen,
      nombre: input.nombre,
      motivo: input.motivo,
      startIso: input.startIso,
      durationMin,
    };

    // Lock distribuido (best-effort; no-op si no hay Supabase → solo mutex local)
    const got = await kvTryLock(lockKey, LOCK_TTL_MS, input.agenteOrigen);
    if (!got) {
      await logDecision(tenantId, "locked", baseLog);
      return { ok: false, reason: "locked" };
    }

    try {
      // --- Modo simulación (pruebas locales sin tokens de Google) ---
      if (input.simulate) {
        return await simulateReserva(tenantId, input, durationMin, baseLog);
      }

      // 1) Re-verificar disponibilidad contra Google (fuente de verdad)
      const slot = await findFreeSlot({
        userEmail: input.userEmail,
        redirectUri: input.redirectUri,
        startIso: input.startIso,
        durationMin,
      });
      if (!slot.available) {
        await logDecision(tenantId, "rejected_conflict", { ...baseLog, suggested: slot.suggested });
        return { ok: false, reason: "slot_taken", suggested: slot.suggested };
      }

      // 2) Crear la cita
      const res = await agendarCita({
        tenantId,
        userEmail: input.userEmail,
        nombre: input.nombre,
        motivo: input.motivo,
        start: input.startIso,
        durationMin,
        agenteOrigen: input.agenteOrigen,
        customerPhone: input.customerPhone,
        attendees: input.attendees,
        location: input.location,
        redirectUri: input.redirectUri,
        comensales: input.comensales,
        zona: input.zona,
      });
      if (!res.ok) {
        await logDecision(tenantId, "error", { ...baseLog, detail: res.detail });
        return { ok: false, reason: "error", detail: res.detail };
      }

      await logDecision(tenantId, "booked", { ...baseLog, eventId: res.eventId });
      return { ok: true, eventId: res.eventId, htmlLink: res.htmlLink, eventLogId: res.eventLogId };
    } finally {
      await kvUnlock(lockKey);
    }
  });

  // Unificación de canales: si la cita la hizo un agente de AI-Team (Pablo, Carmen,
  // Eva o Lucía) y el tenant tiene un negocio de booking, la registramos TAMBIÉN como
  // BookingRecord (con token, visible y cancelable en el panel, contando para la
  // anti-doble-reserva) apuntando al MISMO evento de Google — sin crear un segundo
  // evento ni un segundo camino de reserva. registrarRecordDeCita es idempotente por
  // eventId y dispara el aviso al dueño (OWNER_NOTIFY_ENABLED). Best-effort: nunca
  // rompe la reserva.
  if (result.ok && AGENTES_CON_RECORD.has(input.agenteOrigen)) {
    try {
      const { getBusinessByTenant, registrarRecordDeCita } = await import("./booking");
      const business = await getBusinessByTenant(tenantId);
      if (business) {
        // Origen público para el enlace de cancelar de la confirmación al cliente.
        let baseUrl: string | undefined;
        try { baseUrl = new URL(input.redirectUri).origin; } catch { baseUrl = undefined; }
        await registrarRecordDeCita({
          slug: business.slug,
          startIso: input.startIso,
          durationMin,
          motivo: input.motivo,
          cliente: {
            nombre: input.nombre,
            telefono: input.customerPhone || "",
            email: input.attendees?.[0],
          },
          eventId: result.eventId,
          htmlLink: result.htmlLink,
          baseUrl,
          comensales: input.comensales,
          zona: input.zona,
        });
      }
    } catch (e) {
      console.error("[orchestrator] no se pudo crear BookingRecord (no crítico):", e);
    }
  }

  return result;
}

async function reservarConNegocio(input: ReservaInput, tenantId: string): Promise<ReservaResult | null> {
  const { getBusinessByTenant, resolveCalendarEmail, servicioPedido, resolverServicio, disponibilidadParaReserva, registrarRecordDeCita, avisosDeCitaNuevaTrasResponder } =
    await import("./booking");
  const business = await getBusinessByTenant(tenantId);
  if (!business) return null;

  // Duración y padding: los que diga quien llama, o los del servicio que
  // corresponde al motivo (por defecto el de referencia de la lista de huecos).
  let durationMin = input.durationMin;
  let pB = input.paddingBeforeMin ?? 0;
  let pA = input.paddingAfterMin ?? 0;
  // El servicio PEDIDO; si el negocio no lo tiene, ninguno (nunca el primero de la lista).
  const svPorId = input.serviceId ? business.servicios.find((x) => x.id === input.serviceId && x.activo) : undefined;
  const svPedido = svPorId ?? servicioPedido(business, input.motivo);
  let asignado: { id: string; nombre: string } | undefined;
  if (!durationMin) {
    const sv = svPedido;
    if (sv) {
      const sel = resolverServicio(sv, {});
      durationMin = sel.durationMin; pB = sel.paddingBeforeMin; pA = sel.paddingAfterMin;
    }
  }
  durationMin = durationMin ?? DEFAULT_DURATION_MIN;

  // El calendario es el DEL NEGOCIO, no el del fundador.
  const calendarEmail = await resolveCalendarEmail(business);
  const startNorm = input.startIso.length === 16 ? `${input.startIso}:00` : input.startIso.slice(0, 19);
  let ultima: Awaited<ReturnType<typeof disponibilidadParaReserva>> | null = null;
  let record: Awaited<ReturnType<typeof registrarRecordDeCita>> = null;

  const res = await reservarSlotBooking({
    tenantId,
    userEmail: calendarEmail,
    redirectUri: input.redirectUri,
    nombre: input.nombre,
    motivo: input.motivo,
    motivoFinal: () => input.motivo + (asignado ? ` · ${asignado.nombre}` : ""),
    startIso: startNorm,
    durationMin,
    agenteOrigen: input.agenteOrigen,
    customerPhone: input.customerPhone,
    attendees: input.attendees,
    location: input.location,
    simulate: process.env.BOOKING_SIMULATE === "1" ? true : undefined,
    googleDespues: true,
    alCrearEvento: async (eventId, htmlLink) => {
      const guardada = record as { id: string } | null;
      if (!guardada || eventId.startsWith("int_")) return;
      const { actualizarRecord } = await import("./booking");
      await actualizarRecord(guardada.id, "google-despues", (f) => (f.eventId?.startsWith("int_") ? { ...f, eventId, htmlLink } : null));
    },
    revalidate: async () => {
      ultima = await disponibilidadParaReserva(tenantId, { startIso: startNorm, durationMin: durationMin!, paddingBeforeMin: pB, paddingAfterMin: pA, serviceId: svPedido?.id, preferidoId: input.empleadoId }, input.redirectUri);
      if (ultima.negocio && ultima.available) asignado = ultima.empleado ? { id: ultima.empleado.id, nombre: ultima.empleado.nombre } : undefined;
      return ultima.negocio && ultima.available;
    },
    persistir: async (cita) => {
      if (!AGENTES_CON_RECORD.has(input.agenteOrigen)) return;
      let baseUrl: string | undefined;
      try { baseUrl = new URL(input.redirectUri).origin; } catch { baseUrl = undefined; }
      record = await registrarRecordDeCita({
        slug: business.slug, startIso: startNorm, durationMin: durationMin!, paddingBeforeMin: pB, paddingAfterMin: pA,
        empleadoId: asignado?.id, empleadoNombre: asignado?.nombre, serviceId: svPedido?.id, servicioNombre: svPedido?.nombre,
        motivo: input.motivo,
        cliente: { nombre: input.nombre, telefono: input.customerPhone || "", email: input.attendees?.[0] },
        eventId: cita.eventId, htmlLink: cita.htmlLink, baseUrl,
        comensales: input.comensales, zona: input.zona,
      }, { sinAvisos: true, nueva: true });
    },
  });

  if (res.ok) {
    // Fuera del candado: los avisos tardan y no deben retener la agenda.
    // Y DESPUÉS de responder: aviso al dueño, WhatsApp y email no retienen a
    // quien reserva (Carmen esperaba 11 s). Si fallan, quedan pendientes y se reintentan.
    const guardada = record as { id: string } | null;
    if (guardada) {
      let baseUrl: string | undefined;
      try { baseUrl = new URL(input.redirectUri).origin; } catch { baseUrl = undefined; }
      avisosDeCitaNuevaTrasResponder(record!, baseUrl, { sinConfirmacionCliente: input.confirmarAlColgar || input.confirmacionEnConversacion });
    }
    return { ...res, ...(guardada && res.ok ? { recordId: guardada.id } : {}) } as ReservaResult;
  }
  if (res.reason === "slot_taken") {
    const u = ultima as Awaited<ReturnType<typeof disponibilidadParaReserva>> | null;
    if (u && u.negocio && !u.available) {
      if (u.motivo === "no_calendar") return { ok: false, reason: "error", detail: "calendario de Google desconectado" };
      if (u.motivo === "error") return { ok: false, reason: "error", detail: u.detail || "no se pudo consultar el calendario" };
      return { ok: false, reason: "slot_taken", suggested: u.suggested, motivo: u.motivo };
    }
  }
  return res;
}

// -----------------------------------------------------------------------------
// Simulación local — sin Google. Usa un set de huecos "reservados" en memoria
// para que el panel /admin/orquestador pueda demostrar conflicto + lock.
// -----------------------------------------------------------------------------

const simBooked = new Set<string>();

async function simulateReserva(
  tenantId: string,
  input: ReservaInput,
  durationMin: number,
  baseLog: { agenteOrigen: EventChannel; nombre: string; motivo: string; startIso: string; durationMin: number },
): Promise<ReservaResult> {
  const key = `${tenantId}|${input.startIso}`;
  // Pequeña espera para que dos peticiones casi simultáneas se solapen y se vea
  // el efecto del mutex/lock en el panel.
  await new Promise((r) => setTimeout(r, 150));
  if (simBooked.has(key)) {
    await logDecision(tenantId, "rejected_conflict", baseLog);
    return { ok: false, reason: "slot_taken" };
  }
  simBooked.add(key);
  const fakeId = `sim_${input.startIso}`;
  await logDecision(tenantId, "booked", { ...baseLog, eventId: fakeId, simulated: true });
  return { ok: true, eventId: fakeId, simulated: true };
}

/** Limpia las reservas simuladas (botón "reset" del panel). */
export function resetSimulacion(): void {
  simBooked.clear();
}

// -----------------------------------------------------------------------------
// Lectura del log de decisiones (para el panel)
// -----------------------------------------------------------------------------

export type DecisionRow = {
  id: string;
  ts: string;
  decision: OrquestadorDecision;
  agenteOrigen: string;
  nombre: string;
  motivo: string;
  startIso: string;
  suggested?: string;
  eventId?: string;
  detail?: string;
  simulated?: boolean;
};

export async function listDecisions(tenantId?: string, limit = 50): Promise<DecisionRow[]> {
  const tid = tenantId || DEFAULT_TENANT_ID;
  // Mes actual + anterior para no perder decisiones a fin de mes.
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const months = [monthKey(now), monthKey(prev)];
  const all: AnalyticsEvent[] = (
    await Promise.all(months.map((m) => getMonthEvents(tid, m)))
  ).flat();

  return all
    .filter((e) => e.type === "orchestrator_decision")
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, limit)
    .map((e) => {
      const m = (e.meta ?? {}) as Record<string, unknown>;
      return {
        id: e.id,
        ts: e.ts,
        decision: (m.decision as OrquestadorDecision) ?? "error",
        agenteOrigen: String(m.agenteOrigen ?? e.channel),
        nombre: String(m.nombre ?? ""),
        motivo: String(m.motivo ?? ""),
        startIso: String(m.startIso ?? ""),
        suggested: m.suggested ? String(m.suggested) : undefined,
        eventId: m.eventId ? String(m.eventId) : undefined,
        detail: m.detail ? String(m.detail) : undefined,
        simulated: m.simulated === true,
      };
    });
}

export { supabaseEnabled };
