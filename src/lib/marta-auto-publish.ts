// =============================================================================
// Marta Nivel 3 — publicación AUTOMÁTICA de las entradas vencidas del calendario.
// =============================================================================
//
// Cierra el círculo: los posts que el calendario mensual dejó como "scheduled"
// se publican SOLOS en Instagram a su hora, sin intervención humana, disparado
// por un cron externo (n8n).
//
// Qué reutiliza (no se reimplementa NADA de esto):
//   · dueNow() / findEntryById()                    (marta-calendar) → qué toca publicar
//   · publishToInstagram()                          (marta-publish)  → el publicador REAL
//   · markCalendarEntryPublished/Failed()           (marta-calendar) → estado final
//   · kvTryLock/kvUnlock                            (supabase)       → anti-duplicado
//
// Diferencia con /api/admin/marta-calendar/trigger (que sigue existiendo): aquel
// exige sesión de fundador + ?to= y manda la propuesta a APROBAR por WhatsApp.
// Este publica directamente. Son dos caminos distintos sobre el mismo calendario.
//
// DOBLE INTERRUPTOR: hace falta MARTA_AUTO_PUBLISH_ENABLED=true (este módulo) Y
// MARTA_PUBLISH_ENABLED=true (el publicador). Con cualquiera apagado → dry-run.

import "server-only";
import {
  dueNow,
  findEntryById,
  markCalendarEntryPublished,
  markCalendarEntryFailed,
  type CalendarEntry,
} from "./marta-calendar";
import { publishToInstagram, isPublishEnabled, fetchPermalink } from "./marta-publish";
import { kvTryLock, kvUnlock, supabaseEnabled } from "./supabase";
import { logEvent, makeEventId } from "./event-log";

/** Interruptor propio de la publicación automática. Default: APAGADO. */
export function martaAutoPublishEnabled(): boolean {
  return (process.env.MARTA_AUTO_PUBLISH_ENABLED || "").toLowerCase() === "true";
}

/**
 * ¿Se publica de verdad? Hacen falta LOS DOS flags.
 * `isPublishEnabled()` es el del publicador existente (MARTA_PUBLISH_ENABLED).
 */
export function publicacionRealActiva(): boolean {
  return martaAutoPublishEnabled() && isPublishEnabled();
}

const LOCK_TTL_MS = 5 * 60 * 1000; // una publicación no debería tardar más

/**
 * Deja constancia en el event-log de que Marta ha publicado, para que el informe
 * mensual pueda contar los posts del mes y enlazarlos.
 *
 * Este es el ÚNICO sitio donde se escribe `post_published`, y está a propósito
 * dentro de `publicarEntrada`: por aquí pasan LOS DOS caminos que publican de
 * verdad — el cron /api/cron/marta-calendar-publicar y el botón "Publicar ahora"
 * del panel (ambos llaman a `publicarVencidos`). Un único punto = imposible que
 * un camino cuente y el otro no.
 *
 * · Bucket: `logEvent` archiva por tenant + mes a partir de `ts`, y usamos la
 *   fecha REAL de publicación (no la programada), que es la que debe contar.
 * · Idempotencia: id determinista por entrada, así que un reintento no duplica.
 * · Best-effort: cualquier fallo se traga. El post ya está en Instagram; que el
 *   log falle no puede convertir un éxito en error.
 */
async function registrarPostPublicado(
  tenantId: string,
  entry: CalendarEntry,
  igMediaId: string,
): Promise<void> {
  try {
    const permalink = await fetchPermalink(igMediaId);
    await logEvent(tenantId, {
      id: makeEventId("post_published", tenantId, entry.id),
      ts: new Date().toISOString(),
      type: "post_published",
      channel: "marta",
      meta: {
        entryId: entry.id,
        igMediaId,
        permalink: permalink ?? undefined,
        tema: entry.tema,
        temaLabel: entry.temaLabel,
        mediaType: entry.mediaType,
        imageUrl: entry.imageUrl,
        scheduledAt: entry.scheduledAt,
        caption: entry.caption.slice(0, 300),
      },
    });
  } catch (err) {
    console.error("[marta-auto-publish] no se pudo registrar post_published:", err);
  }
}

export type AccionEntrada =
  | "publicaria"   // dry-run: esto es lo que se publicaría
  | "publicada"    // publicada de verdad en Instagram
  | "fallida"      // Instagram devolvió error → marcada failed
  | "omitida";     // no se tocó (no estaba scheduled, o lock, o publicador apagado)

export type ResultadoEntrada = {
  entryId: string;
  scheduledAt: string;
  tema?: string;
  caption: string;
  imageUrl: string;
  accion: AccionEntrada;
  motivo?: string;
  igMediaId?: string;
};

export type ResultadoPublicacion = {
  ok: true;
  dryRun: boolean;
  autoPublishEnabled: boolean;
  publishEnabled: boolean;
  vencidas: number;
  publicadas: number;
  fallidas: number;
  omitidas: number;
  entradas: ResultadoEntrada[];
};

function resumen(entryId: string, e: CalendarEntry, accion: AccionEntrada, extra?: Partial<ResultadoEntrada>): ResultadoEntrada {
  return {
    entryId,
    scheduledAt: e.scheduledAt,
    tema: e.tema,
    caption: e.caption,
    imageUrl: e.imageUrl,
    accion,
    ...extra,
  };
}

/**
 * Publica UNA entrada. Idempotente: si no está en "scheduled" (p. ej. ya
 * "published") no la toca. Con `dryRun` solo dice qué haría.
 */
async function publicarEntrada(
  tenantId: string,
  entry: CalendarEntry,
  dryRun: boolean,
): Promise<ResultadoEntrada> {
  // --- IDEMPOTENCIA (1): estado. Una ya publicada nunca se republica. ---
  if (entry.status !== "scheduled") {
    return resumen(entry.id, entry, "omitida", {
      motivo: `ya está en estado "${entry.status}" (no se republica)`,
    });
  }

  if (dryRun) {
    return resumen(entry.id, entry, "publicaria", {
      motivo: "dry-run: no se ha llamado a Instagram",
    });
  }

  // --- IDEMPOTENCIA (2): lock distribuido, por si el cron se solapa. ---
  const lockKey = `marta-publish-lock:${tenantId}:${entry.id}`;
  let lockTomado = false;
  if (supabaseEnabled()) {
    lockTomado = await kvTryLock(lockKey, LOCK_TTL_MS, "marta-auto-publish");
    if (!lockTomado) {
      return resumen(entry.id, entry, "omitida", { motivo: "otra ejecución la está publicando ahora mismo" });
    }
  }

  try {
    // --- IDEMPOTENCIA (3): relectura tras el lock (pudo publicarse entre medias). ---
    const fresca = await findEntryById(tenantId, entry.id);
    if (!fresca || fresca.status !== "scheduled") {
      return resumen(entry.id, fresca ?? entry, "omitida", {
        motivo: `estado cambiado a "${fresca?.status ?? "desaparecida"}" antes de publicar`,
      });
    }

    const pub = await publishToInstagram({
      mediaType: fresca.mediaType,
      mediaUrl: fresca.imageUrl,
      caption: fresca.caption,
    });

    if ("ok" in pub && pub.ok) {
      await markCalendarEntryPublished(tenantId, fresca.id, pub.igMediaId);
      await registrarPostPublicado(tenantId, fresca, pub.igMediaId);
      return resumen(fresca.id, fresca, "publicada", { igMediaId: pub.igMediaId });
    }

    if ("skipped" in pub && pub.skipped) {
      // Config incompleta (flag del publicador o env). NO la marcamos failed:
      // se queda "scheduled" para que reintente en la siguiente pasada.
      return resumen(fresca.id, fresca, "omitida", {
        motivo: `publicador no disponible (${pub.reason}): ${pub.detail}`,
      });
    }

    const detail = "detail" in pub ? pub.detail : "error desconocido";
    await markCalendarEntryFailed(tenantId, fresca.id, detail);
    return resumen(fresca.id, fresca, "fallida", { motivo: detail });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await markCalendarEntryFailed(tenantId, entry.id, detail);
    return resumen(entry.id, entry, "fallida", { motivo: detail });
  } finally {
    if (lockTomado) await kvUnlock(lockKey);
  }
}

/**
 * Recorre las entradas VENCIDAS (dueNow: status "scheduled" y hora pasada) y las
 * publica. Con `entryId` procesa solo esa (botón "Publicar ahora").
 *
 * `dryRun` por defecto se deduce de los dos flags: si falta cualquiera, dry-run.
 */
export async function publicarVencidos(opts: {
  tenantId: string;
  now?: Date;
  /** Fuerza dry-run aunque los flags estén puestos. */
  dryRun?: boolean;
  /** Solo esta entrada (acción manual). Ignora si está vencida o no. */
  entryId?: string;
  /**
   * Acción manual del panel: se salta MARTA_AUTO_PUBLISH_ENABLED, pero NO el
   * MARTA_PUBLISH_ENABLED del publicador real (que además implica App Review).
   */
  manual?: boolean;
}): Promise<ResultadoPublicacion> {
  const now = opts.now ?? new Date();
  const autoEnabled = martaAutoPublishEnabled();
  const pubEnabled = isPublishEnabled();

  const real = opts.manual ? pubEnabled : autoEnabled && pubEnabled;
  const dryRun = opts.dryRun ?? !real;

  let entradas: CalendarEntry[];
  if (opts.entryId) {
    const e = await findEntryById(opts.tenantId, opts.entryId);
    entradas = e ? [e] : [];
  } else {
    entradas = await dueNow(opts.tenantId, now);
  }

  const resultados: ResultadoEntrada[] = [];
  for (const e of entradas) {
    resultados.push(await publicarEntrada(opts.tenantId, e, dryRun));
  }

  return {
    ok: true,
    dryRun,
    autoPublishEnabled: autoEnabled,
    publishEnabled: pubEnabled,
    vencidas: entradas.length,
    publicadas: resultados.filter((r) => r.accion === "publicada").length,
    fallidas: resultados.filter((r) => r.accion === "fallida").length,
    omitidas: resultados.filter((r) => r.accion === "omitida").length,
    entradas: resultados,
  };
}
