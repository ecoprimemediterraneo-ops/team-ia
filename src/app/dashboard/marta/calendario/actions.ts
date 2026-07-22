"use server";

// Disparador MANUAL del mes de Marta (para revisar antes de que se publique nada).
// Dos acciones, ambas sobre el mismo orquestador (marta-mes):
//   · previsualizar → genera y devuelve SIN tocar el store (seguro con el flag apagado)
//   · programar     → genera y deja los posts como "scheduled" en marta-calendar
// La generación AUTOMÁTICA (n8n) va por /api/cron/marta-mes y sí exige MARTA_AUTO_ENABLED.

import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import { generarMes } from "@/lib/marta-mes";
import { publicarVencidos } from "@/lib/marta-auto-publish";
import type { MesState, PublicarState } from "./types";

async function baseUrlFromHeaders(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function ejecutar(formData: FormData, preview: boolean): Promise<MesState> {
  const s = await getSession();
  if (!s) return { ts: Date.now(), variant: "error", title: "No autorizado" };

  const tenantId = String(formData.get("tenantId") || DEFAULT_TENANT_ID).trim();
  const maxRaw = parseInt(String(formData.get("max") || "6"), 10);
  const max = Math.min(Math.max(Number.isFinite(maxRaw) ? maxRaw : 6, 1), 20);

  const res = await generarMes({
    tenantId,
    baseUrl: await baseUrlFromHeaders(),
    preview,
    max,
    // Acción manual del fundador desde el panel: puede programar aunque el
    // interruptor de la automatización esté apagado. Programar NO publica.
    forzar: true,
  });

  if (!res.ok) {
    return {
      ts: Date.now(),
      variant: "error",
      title: res.reason === "sin_huecos" ? "No quedan fechas este mes" : "No se pudo generar",
      detail: res.detail,
    };
  }
  if ("skipped" in res && res.skipped) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "Automatización apagada",
      detail: 'MARTA_AUTO_ENABLED no está a "true". Usa "Previsualizar" para probar sin guardar.',
    };
  }

  if (!preview) revalidatePath("/dashboard/marta/calendario");

  return {
    ts: Date.now(),
    variant: "ok",
    title: preview
      ? `${res.posts.length} posts generados (previsualización, NO guardados)`
      : `${res.posts.length} posts programados en ${res.mes}`,
    detail: res.errores.length ? `${res.errores.length} aviso(s) durante la generación.` : undefined,
    posts: res.posts,
    warnings: res.errores,
    persistido: res.persistido,
  };
}

/**
 * "Publicar ahora" de UNA entrada concreta (prueba manual y controlada).
 * Se salta MARTA_AUTO_PUBLISH_ENABLED (es una acción humana explícita) pero
 * NO el MARTA_PUBLISH_ENABLED del publicador real: con ese apagado, informa de
 * que no ha publicado en vez de publicar.
 */
export async function publicarAhoraAction(
  _prev: PublicarState,
  formData: FormData,
): Promise<PublicarState> {
  const s = await getSession();
  if (!s) return { ts: Date.now(), variant: "error", mensaje: "No autorizado" };

  const entryId = String(formData.get("entryId") || "").trim();
  if (!entryId) return { ts: Date.now(), variant: "error", mensaje: "Falta la entrada" };
  const tenantId = String(formData.get("tenantId") || DEFAULT_TENANT_ID).trim();

  const res = await publicarVencidos({ tenantId, entryId, manual: true });
  const r = res.entradas[0];
  if (!r) return { ts: Date.now(), variant: "error", mensaje: "Entrada no encontrada" };

  revalidatePath("/dashboard/marta/calendario");

  if (r.accion === "publicada") {
    return { ts: Date.now(), variant: "ok", mensaje: `Publicada en Instagram (${r.igMediaId})` };
  }
  if (r.accion === "publicaria") {
    return { ts: Date.now(), variant: "dry", mensaje: "DRY-RUN: se publicaría, pero no se ha llamado a Instagram" };
  }
  if (r.accion === "omitida") {
    return { ts: Date.now(), variant: "dry", mensaje: `No publicada — ${r.motivo}` };
  }
  return { ts: Date.now(), variant: "error", mensaje: `Error: ${r.motivo}` };
}

/**
 * Una sola acción para los dos botones: el botón pulsado manda `modo`
 * ("preview" | "programar") en el formData.
 */
export async function ejecutarMesAction(_prev: MesState, formData: FormData): Promise<MesState> {
  const preview = String(formData.get("modo") || "preview") !== "programar";
  return ejecutar(formData, preview);
}
