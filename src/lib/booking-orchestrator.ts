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
// Cuánto se espera a que otra reserva del mismo profesional suelte el candado
// antes de rendirse. Ver `esperarLock`.
const LOCK_ESPERA_MS = 5_000;
const LOCK_REINTENTO_MS = 120;
// Guardar la reserva se reintenta: un corte de un segundo en Supabase no puede
// costar una cita que YA existe en la agenda de Google.
const GUARDAR_INTENTOS = 3;
const GUARDAR_ESPERA_MS = 250;

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
  /**
   * Guardar la reserva. SE EJECUTA DENTRO DEL CANDADO, justo después de crear
   * la cita y antes de soltarlo.
   *
   * Antes el que llamaba guardaba después de que esta función devolviera, o
   * sea con el candado ya suelto. En ese hueco la cita estaba concedida pero
   * todavía no la veía nadie: la siguiente petición miraba la agenda, la veía
   * libre, y se concedía encima. Guardar aquí cierra el hueco.
   */
  persistir?: (cita: { eventId?: string; htmlLink?: string; simulada?: boolean }) => Promise<void>;
  /**
   * Deshacer la cita en Google. Se usa SOLO si `persistir` falla las tres veces.
   *
   * Sin esto quedaba una cita en el calendario que el panel no conoce: ocupa el
   * hueco, nadie la ve, no sale en ningún listado y el cliente tiene un error en
   * pantalla. Y si volvía a intentarlo, se creaba una SEGUNDA. Borrando la
   * primera, reintentar es limpio: ni duplicado ni cita fantasma.
   */
  deshacerCita?: (eventId: string) => Promise<boolean>;
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

/**
 * Coge el candado esperando un poco si está cogido, en vez de rendirse al
 * primer intento.
 *
 * El candado pasó a cubrir TODO EL DÍA de ese profesional (antes cubría solo la
 * hora exacta de inicio, que es justo lo que dejaba pasar dos citas solapadas).
 * Con un candado más ancho, dos personas reservando a la vez horas distintas
 * del mismo profesional se cruzan a menudo — y rendirse ahí les daría un error
 * por algo que no es un conflicto real. Así que se espera: lo normal es que el
 * de delante tarde menos de un segundo.
 */
async function esperarLock(lockKey: string, quien: string): Promise<boolean> {
  const limite = Date.now() + LOCK_ESPERA_MS;
  for (;;) {
    if (await kvTryLock(lockKey, LOCK_TTL_MS, quien)) return true;
    if (Date.now() >= limite) return false;
    await new Promise((r) => setTimeout(r, LOCK_REINTENTO_MS));
  }
}

/**
 * Intenta guardar varias veces. Devuelve null si lo consiguió, o el motivo del
 * último fallo si no. No lanza: quien llama tiene que poder deshacer la cita.
 */
async function guardarConReintentos(fn: () => Promise<void>): Promise<string | null> {
  let ultimo = "";
  for (let i = 1; i <= GUARDAR_INTENTOS; i++) {
    try {
      await fn();
      return null;
    } catch (err) {
      ultimo = err instanceof Error ? err.message : String(err);
      console.error(`[booking-orch] intento ${i}/${GUARDAR_INTENTOS} de guardar la reserva: ${ultimo}`);
      if (i < GUARDAR_INTENTOS) await new Promise((r) => setTimeout(r, GUARDAR_ESPERA_MS * i));
    }
  }
  return ultimo || "error desconocido";
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
  // La clave del candado es el DÍA y el profesional, no la hora exacta.
  //
  // Con la hora exacta, las 09:00 y las 09:15 de treinta minutos eran dos
  // claves distintas: las dos peticiones entraban a la vez, las dos veían el
  // hueco libre y las dos se concedían. La misma persona atendiendo a dos
  // clientes a la misma hora.
  //
  // El día entero es deliberadamente ancho: sigue dejando trabajar en paralelo
  // a profesionales distintos (que es donde importa el paralelismo) y hace
  // imposible que dos citas del mismo profesional se decidan a la vez, se
  // solapen como se solapen. Lo que cuesta es que dos reservas del mismo día se
  // serializan; `esperarLock` se encarga de que eso sea una espera y no un error.
  const dia = input.startIso.slice(0, 10);
  const slotKey = `${tenantId}|${dia}|${input.resourceId ?? "global"}`;

  return withSlotMutex(slotKey, async () => {
    const lockKey = `lock:booking:${slotKey}`;
    const baseLog = { agenteOrigen: input.agenteOrigen, nombre: input.nombre, motivo: input.motivo, startIso: input.startIso, durationMin };

    const got = await esperarLock(lockKey, input.agenteOrigen);
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
        if (input.persistir) {
          try {
            await input.persistir({ eventId: fakeId, simulada: true });
          } catch (err) {
            const detalle = err instanceof Error ? err.message : String(err);
            await logDecision(tenantId, "error", { ...baseLog, detail: `no se pudo guardar: ${detalle}`, simulated: true });
            return { ok: false, reason: "error", detail: `La cita no se pudo guardar (${detalle}).` };
          }
        }
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
      // Guardar ANTES de soltar el candado (ver `persistir`).
      //
      // Si el guardado revienta (Supabase caído, por ejemplo) la cita YA existe
      // en Google. No se puede devolver "ok": el panel no la vería y el hueco
      // quedaría ocupado sin dueño. Se devuelve error y se deja en el log todo
      // lo necesario para recuperarla a mano.
      if (input.persistir) {
        const fallo = await guardarConReintentos(() =>
          input.persistir!({ eventId: res.eventId, htmlLink: res.htmlLink }),
        );
        if (fallo) {
          // La cita existe en Google y no hemos podido apuntarla. Se deshace,
          // para que reintentar no cree una segunda ni quede un hueco ocupado
          // por una cita que nadie ve.
          let deshecha = false;
          if (res.eventId && input.deshacerCita) {
            try {
              deshecha = await input.deshacerCita(res.eventId);
            } catch (err) {
              console.error("[booking-orch] al deshacer la cita:", err);
            }
          }
          const comun =
            `tenant=${tenantId} evento=${res.eventId} inicio=${input.startIso} ` +
            `duracion=${durationMin} recurso=${input.resourceId ?? "—"} ` +
            `cliente="${input.nombre}" motivo="${input.motivo}"`;
          if (deshecha) {
            console.error(`[booking-orch] NO SE PUDO GUARDAR; cita RETIRADA de Google. ${comun} · ${fallo}`);
          } else {
            console.error(
              `[booking-orch] CITA HUÉRFANA: está en Google, NO está en el panel y NO se ha podido retirar. ` +
                `Bórrala a mano en el calendario. ${comun} · ${fallo}`,
            );
          }
          await logDecision(tenantId, "error", {
            ...baseLog,
            eventId: res.eventId,
            detail: deshecha ? `no se pudo guardar, cita retirada: ${fallo}` : `CITA HUÉRFANA en Google: ${fallo}`,
          });
          return {
            ok: false,
            reason: "error",
            detail: deshecha
              ? "No hemos podido registrar la cita. Vuelve a intentarlo."
              : "No hemos podido registrar la cita. Llama al negocio para confirmarla.",
          };
        }
      }
      await logDecision(tenantId, "booked", { ...baseLog, eventId: res.eventId });
      return { ok: true, eventId: res.eventId, htmlLink: res.htmlLink, eventLogId: res.eventLogId };
    } finally {
      await kvUnlock(lockKey);
    }
  });
}
