// =============================================================================
// Motor de reservas PROPIO del booking (AI-Team Booking).
//
// Existe para NO tocar el orquestador compartido (orchestrator.ts) que usan
// Lucía/Carmen/Pablo. Reutiliza solo las PIEZAS ya expuestas —agendarCita,
// findFreeSlot, el lock distribuido y el event-log— pero la orquestación
// (mutex, lock, re-validación, creación, log) vive aquí, aislada.
//
// Soporta dos modos:
//   - resourceId (empleado): aísla el lock/mutex POR recurso → dos profesionales
//     pueden ocupar el mismo instante en paralelo (agenda multi-empleado).
//   - revalidate: re-chequeo del recurso DENTRO del lock (sustituye al
//     findFreeSlot global, que asume un único calendario). Si no se pasa, usa
//     findFreeSlot contra Google como el motor compartido (negocio de agenda única).
// =============================================================================

import "server-only";
import { agendarCita } from "./calendar";
import { findFreeSlot } from "./appointment-intent";
import { logEvent, makeEventId, type EventChannel } from "./event-log";
import { DEFAULT_TENANT_ID } from "./tenants";
import { kvTryLock, kvUnlock } from "./supabase";
import type { ReservaResult } from "./orchestrator";

const DEFAULT_DURATION_MIN = 30;
const LOCK_TTL_MS = 30_000;

export type ReservaBookingInput = {
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
  simulate?: boolean;
  resourceId?: string; // empleado → aísla lock/mutex por recurso (paralelismo)
  revalidate?: () => Promise<boolean>; // re-chequeo del recurso dentro del lock
};

// Mutex en memoria por (slot|recurso) — serializa dentro de la misma instancia.
const inflight = new Map<string, Promise<unknown>>();
function withSlotMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = inflight.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  inflight.set(key, run.catch(() => undefined));
  run.catch(() => undefined).finally(() => { if (inflight.get(key) === undefined) inflight.delete(key); });
  return run;
}

type Decision = "booked" | "rejected_conflict" | "locked" | "error";
async function logDecision(
  tenantId: string,
  decision: Decision,
  d: { agenteOrigen: EventChannel; nombre: string; motivo: string; startIso: string; durationMin: number; suggested?: string; eventId?: string; detail?: string; simulated?: boolean },
): Promise<void> {
  try {
    await logEvent(tenantId, {
      id: makeEventId("booking-orch", decision, d.startIso, d.agenteOrigen, String(Date.now())),
      type: "orchestrator_decision",
      channel: "system",
      meta: {
        tipo: "orquestador", decision, agenteOrigen: d.agenteOrigen, nombre: d.nombre, motivo: d.motivo, startIso: d.startIso, durationMin: d.durationMin,
        ...(d.suggested ? { suggested: d.suggested } : {}),
        ...(d.eventId ? { eventId: d.eventId } : {}),
        ...(d.detail ? { detail: d.detail } : {}),
        ...(d.simulated ? { simulated: true } : {}),
      },
    });
  } catch (err) {
    console.error("[booking-orch] no se pudo loguear la decisión:", err);
  }
}

// Dedup de simulación local (por slot|recurso) — solo para pruebas sin Google.
const simBooked = new Set<string>();

/** Reserva un hueco de forma segura para el BOOKING. No usa el orquestador compartido. */
export async function reservarSlotBooking(input: ReservaBookingInput): Promise<ReservaResult> {
  const tenantId = input.tenantId || DEFAULT_TENANT_ID;
  const durationMin = input.durationMin ?? DEFAULT_DURATION_MIN;
  const slotKey = `${tenantId}|${input.startIso}|${durationMin}${input.resourceId ? "|" + input.resourceId : ""}`;

  return withSlotMutex(slotKey, async () => {
    const lockKey = `lock:booking:${slotKey}`;
    const baseLog = { agenteOrigen: input.agenteOrigen, nombre: input.nombre, motivo: input.motivo, startIso: input.startIso, durationMin };

    const got = await kvTryLock(lockKey, LOCK_TTL_MS, input.agenteOrigen);
    if (!got) {
      await logDecision(tenantId, "locked", baseLog);
      return { ok: false, reason: "locked" };
    }

    try {
      // 1) Disponibilidad (dentro del lock).
      if (typeof input.revalidate === "function") {
        if (!(await input.revalidate())) {
          await logDecision(tenantId, "rejected_conflict", baseLog);
          return { ok: false, reason: "slot_taken" };
        }
      } else if (input.simulate) {
        const k = `${tenantId}|${input.startIso}${input.resourceId ? "|" + input.resourceId : ""}`;
        await new Promise((r) => setTimeout(r, 50));
        if (simBooked.has(k)) {
          await logDecision(tenantId, "rejected_conflict", baseLog);
          return { ok: false, reason: "slot_taken" };
        }
        simBooked.add(k);
      } else {
        const slot = await findFreeSlot({ userEmail: input.userEmail, redirectUri: input.redirectUri, startIso: input.startIso, durationMin });
        if (!slot.available) {
          await logDecision(tenantId, "rejected_conflict", { ...baseLog, suggested: slot.suggested });
          return { ok: false, reason: "slot_taken", suggested: slot.suggested };
        }
      }

      // 2) Crear la cita.
      if (input.simulate) {
        const fakeId = `sim_${input.startIso}${input.resourceId ? "_" + input.resourceId : ""}`;
        await logDecision(tenantId, "booked", { ...baseLog, eventId: fakeId, simulated: true });
        return { ok: true, eventId: fakeId, simulated: true };
      }
      const res = await agendarCita({
        tenantId, userEmail: input.userEmail, nombre: input.nombre, motivo: input.motivo, start: input.startIso, durationMin,
        agenteOrigen: input.agenteOrigen, customerPhone: input.customerPhone, attendees: input.attendees, location: input.location, redirectUri: input.redirectUri,
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
}
