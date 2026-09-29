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

import { despuesDeResponder } from "./segundo-plano";
import "server-only";
import { agendarCita } from "./calendar";
import { findFreeSlot } from "./appointment-intent";
import { logEvent, makeEventId, type EventChannel } from "./event-log";
import { DEFAULT_TENANT_ID } from "./tenants";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { kvTryLock, kvUnlockDe, supabaseEnabled } from "./supabase";
import type { ReservaResult } from "./orchestrator";

const DEFAULT_DURATION_MIN = 30;
const LOCK_TTL_MS = 30_000;
// Cuánto se espera a que otra reserva del mismo profesional suelte el candado
// antes de rendirse. Ver `esperarLock`.
// Con 20 peticiones a la vez sobre el mismo día cada una espera su turno; cada
// turno dura poco (mirar la agenda y guardar), pero en producción son varias
// idas y vueltas a Supabase. 5 s dejaba a las últimas con un "no puedo ahora"
// en vez de un "ocupado, te ofrezco…". 20 s cubre ese caso con margen y sigue
// muy por debajo del límite de Retell y de la función (60 s).
const LOCK_ESPERA_MS = 20_000;
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
  /** Identidad estable de la cita en el event-log. Ver `agendarCita`. */
  eventLogRef?: string;
  /** Bloqueos: ocupan agenda pero no son citas y no se cuentan como tales. */
sinEventLog?: boolean;
  /**
   * Crear el evento de Google DESPUÉS de responder. Dentro del candado solo se
   * GUARDA la cita (con un id interno `int_…`): eso es lo que ocupa el hueco y
   * lo que protege de la doble reserva. El evento de Google (1-2 s) se crea
   * después y `alCrearEvento` apunta su id en la cita.
   */
  googleDespues?: boolean;
  alCrearEvento?: (eventId: string, htmlLink?: string) => Promise<void>;
  /**
   * El texto de la cita, calculado DESPUÉS de `revalidate`. Sirve cuando el
   * profesional se decide dentro del candado y su nombre va en el título del evento.
   */
  motivoFinal?: () => string;
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

// -----------------------------------------------------------------------------
// EL CANDADO DE LA AGENDA
//
// Producción (Supabase): una fila en kv_store (ver `kvTryLock`), que vale entre
// varias instancias de Vercel a la vez.
// Local (sin Supabase): un directorio en data/.candados. `mkdir` es atómico en
// el sistema de ficheros, así que también vale entre VARIOS PROCESOS: antes en
// local no había candado real entre procesos (solo el mutex en memoria) y la
// prueba de concurrencia solo podía hacerse dentro de un proceso.
// El candado lleva un dueño único: soltarlo solo borra el SUYO. Antes se borraba
// por clave: si un candado caducaba y otro lo cogía, el primero al terminar le
// quitaba el candado al segundo.
// -----------------------------------------------------------------------------
const CANDADOS_DIR = path.join(process.cwd(), "data", ".candados");
const nombreCandado = (k: string) => path.join(CANDADOS_DIR, crypto.createHash("sha1").update(k).digest("hex"));

async function candadoLocal(key: string, ttlMs: number, dueno: string): Promise<boolean> {
  await fs.mkdir(CANDADOS_DIR, { recursive: true });
  const dir = nombreCandado(key);
  const coger = async () => {
    try {
      await fs.mkdir(dir);
      await fs.writeFile(path.join(dir, "dueno.json"), JSON.stringify({ dueno, exp: Date.now() + ttlMs }));
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw e;
    }
  };
  if (await coger()) return true;
  // ¿Caducado? El robo pasa por un segundo candado ("robo") para que dos no roben a la vez.
  let exp = 0;
  try {
    exp = JSON.parse(await fs.readFile(path.join(dir, "dueno.json"), "utf-8")).exp || 0;
  } catch {
    // Recién creado y aún sin escribir el dueño: si el directorio es de hace nada, es de otro.
    const st = await fs.stat(dir).catch(() => null);
    if (st && Date.now() - st.mtimeMs < ttlMs) return false;
  }
  if (exp > Date.now()) return false;
  const robo = `${dir}.robo`;
  try {
    await fs.mkdir(robo);
  } catch {
    const st = await fs.stat(robo).catch(() => null);
    if (st && Date.now() - st.mtimeMs > 10_000) await fs.rm(robo, { recursive: true, force: true });
    return false;
  }
  try {
    const actual = JSON.parse(await fs.readFile(path.join(dir, "dueno.json"), "utf-8").catch(() => "{}"));
    if ((actual.exp || 0) > Date.now()) return false;
    await fs.rm(dir, { recursive: true, force: true });
    return await coger();
  } finally {
    await fs.rm(robo, { recursive: true, force: true });
  }
}
async function soltarLocal(key: string, dueno: string): Promise<void> {
  const dir = nombreCandado(key);
  try {
    const actual = JSON.parse(await fs.readFile(path.join(dir, "dueno.json"), "utf-8"));
    if (actual.dueno !== dueno) return; // ya no es nuestro: no se toca
  } catch {
    return;
  }
  await fs.rm(dir, { recursive: true, force: true });
}

/** Coge un candado de agenda (varias instancias / procesos). */
export async function agendaTryLock(key: string, ttlMs: number, dueno: string): Promise<boolean> {
  return supabaseEnabled() ? kvTryLock(key, ttlMs, dueno) : candadoLocal(key, ttlMs, dueno);
}
/** Suelta un candado de agenda, solo si sigue siendo de `dueno`. */
export async function agendaUnlock(key: string, dueno: string): Promise<void> {
  if (supabaseEnabled()) await kvUnlockDe(key, dueno);
  else await soltarLocal(key, dueno);
}

/**
 * Coge el candado esperando un poco si está cogido, en vez de rendirse al
 * primer intento.
 *
 * El candado pasó a cubrir TODO EL DÍA de ese negocio (antes cubría solo la
 * hora exacta de inicio, que es justo lo que dejaba pasar dos citas solapadas).
 * Con un candado más ancho, dos personas reservando a la vez horas distintas
 * se cruzan a menudo — y rendirse ahí les daría un error por algo que no es un
 * conflicto real. Así que se espera: lo normal es que el de delante tarde
 * menos de un segundo.
 */
async function esperarLock(lockKey: string, dueno: string): Promise<boolean> {
  const limite = Date.now() + LOCK_ESPERA_MS;
  for (;;) {
    if (await agendaTryLock(lockKey, LOCK_TTL_MS, dueno)) return true;
    if (Date.now() >= limite) return false;
    // Un poco de azar: si no, los que esperan reintentan todos a la vez.
    await new Promise((r) => setTimeout(r, LOCK_REINTENTO_MS + Math.floor(Math.random() * LOCK_REINTENTO_MS)));
  }
}

/**
 * Ejecuta `fn` con la agenda de ESE negocio y ESE día cerrada para los demás:
 * es el MISMO candado que usan las reservas. Todo lo que cambia una cita
 * (cancelar, cambiar de estado, apuntar un recordatorio) pasa por aquí, para
 * que nunca se pisen dos cambios: antes cancelar y mover guardaban la cita
 * entera sin candado, y si coincidían, la última escritura resucitaba la cita
 * cancelada o deshacía el cambio de hora.
 * Devuelve `{ ok: false, reason: "locked" }` si no consigue el candado a tiempo.
 */
export async function conAgenda<T>(tenantId: string, dia: string, quien: string, fn: () => Promise<T>): Promise<{ ok: true; valor: T } | { ok: false; reason: "locked" }> {
  const slotKey = `${tenantId || DEFAULT_TENANT_ID}|${dia.slice(0, 10)}`;
  return withSlotMutex(slotKey, async () => {
    const lockKey = `lock:booking:${slotKey}`;
    const dueno = `${quien}:${crypto.randomUUID()}`;
    if (!(await esperarLock(lockKey, dueno))) return { ok: false as const, reason: "locked" as const };
    try {
      return { ok: true as const, valor: await fn() };
    } finally {
      await agendaUnlock(lockKey, dueno);
    }
  });
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
  // UN SOLO CANDADO POR NEGOCIO Y DÍA, para cualquier reserva: la web pública, Pablo,
  // Carmen, Marta, el chat del panel y las citas a mano, con o sin profesional
  // elegido.
  //
  // Antes el candado era por día Y profesional. Sonaba razonable (dos
  // profesionales pueden trabajar a la vez) pero dejaba dos agujeros: una reserva
  // "cualquiera" o de un agente no tenía profesional y usaba OTRO candado que la
  // reserva online de una profesional concreta, así que podían decidirse a la vez
  // sobre la misma hora; y elegir profesional dentro del candado exige mirar a
  // todas. Con un solo candado, quien entra ve la agenda entera ya al día, elige a
  // quién asignar y lo guarda antes de que entre nadie más. Lo que cuesta: dos
  // reservas del mismo negocio y día se hacen una detrás de otra (`esperarLock`
  // convierte eso en una espera de milisegundos y no en un error).
  const dia = input.startIso.slice(0, 10);
  const slotKey = `${tenantId}|${dia}`;

  return withSlotMutex(slotKey, async () => {
    const lockKey = `lock:booking:${slotKey}`;
    const baseLog = { agenteOrigen: input.agenteOrigen, nombre: input.nombre, motivo: input.motivo, startIso: input.startIso, durationMin };
    const dueno = `${input.agenteOrigen}:${crypto.randomUUID()}`;
    // Dónde se va el tiempo de una reserva (sale en el log de Vercel).
    const t0 = Date.now();
    const ms: Record<string, number> = {};
    const marca = (fase: string) => { ms[fase] = Date.now() - t0 - Object.values(ms).reduce((a, b) => a + b, 0); };

    const got = await esperarLock(lockKey, dueno);
    marca("candado");
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

      marca("disponibilidad");
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
        despuesDeResponder("decisión booked (simulada)", () => logDecision(tenantId, "booked", { ...baseLog, eventId: fakeId, simulated: true }).then(() => undefined));
        return { ok: true, eventId: fakeId, simulated: true };
      }
      const datosCita = {
        tenantId, userEmail: input.userEmail, nombre: input.nombre, motivo: input.motivoFinal ? input.motivoFinal() : input.motivo, start: input.startIso, durationMin,
        agenteOrigen: input.agenteOrigen, customerPhone: input.customerPhone, attendees: input.attendees, location: input.location, redirectUri: input.redirectUri,
        eventLogRef: input.eventLogRef, sinEventLog: input.sinEventLog,
      };
      if (input.googleDespues && input.persistir) {
        // Se guarda YA con id interno; Google (y el registro del informe) después.
        const interno = `int_${input.startIso}_${crypto.randomBytes(3).toString("hex")}`;
        const fallo = await guardarConReintentos(() => input.persistir!({ eventId: interno }));
        marca("guardar");
        if (fallo) {
          await logDecision(tenantId, "error", { ...baseLog, detail: `no se pudo guardar: ${fallo}` });
          return { ok: false, reason: "error", detail: "No hemos podido registrar la cita. Vuelve a intentarlo." };
        }
        despuesDeResponder(`google ${input.startIso}`, async () => {
          const g = await agendarCita(datosCita);
          if (!g.ok) {
            console.error(`[booking-orch] la cita ${interno} está GUARDADA pero no se ha podido crear en Google: ${g.detail}`);
          } else if (g.eventId && input.alCrearEvento) {
            await input.alCrearEvento(g.eventId, g.htmlLink);
          }
          await logDecision(tenantId, "booked", { ...baseLog, eventId: g.ok ? g.eventId : interno });
        });
        return { ok: true, eventId: interno };
      }
      const res = await agendarCita(datosCita);
      marca("google");
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
      marca("guardar");
      // El registro de la decisión (informe) no hace falta para responder.
      despuesDeResponder("decisión booked", () => logDecision(tenantId, "booked", { ...baseLog, eventId: res.eventId }).then(() => undefined));
      return { ok: true, eventId: res.eventId, htmlLink: res.htmlLink, eventLogId: res.eventLogId };
    } finally {
      await agendaUnlock(lockKey, dueno);
      marca("soltar");
      console.log(`[reserva] ${input.agenteOrigen} ${input.startIso} ms ${JSON.stringify({ ...ms, total: Date.now() - t0 })}`);
    }
  });
}
