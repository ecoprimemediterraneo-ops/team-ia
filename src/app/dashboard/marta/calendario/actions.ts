"use server";

// Disparador MANUAL del mes de Marta (para revisar antes de que se publique nada).
// Dos acciones, ambas sobre el mismo orquestador (marta-mes):
//   · previsualizar → genera y devuelve SIN tocar el store (seguro con el flag apagado)
//   · programar     → genera y deja los posts como "scheduled" en marta-calendar
// La generación AUTOMÁTICA (n8n) va por /api/cron/marta-mes y sí exige MARTA_AUTO_ENABLED.

import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { DEFAULT_TENANT_ID, savePautaPublicacion, type PautaDia } from "@/lib/tenants";
import { generarMes, madridInputsToUtc } from "@/lib/marta-mes";
import { publicarVencidos } from "@/lib/marta-auto-publish";
import { rescheduleEntry, scheduleAtDates } from "@/lib/marta-calendar";
import { generarCaption } from "@/lib/marta-caption";
import type { PublicarState, AutoState, MejorarResult, CrearManualResult } from "./types";

async function baseUrlFromHeaders(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const DIAS_ABREV = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

function resumenPauta(dias: PautaDia[]): string {
  return [...dias]
    .sort((a, b) => ORDEN.indexOf(a.dow) - ORDEN.indexOf(b.dow))
    .map((d) => `${DIAS_ABREV[d.dow]} ${String(d.hora).padStart(2, "0")}:${String(d.minuto).padStart(2, "0")}`)
    .join(" · ");
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

// -----------------------------------------------------------------------------
// PAUTA (una hora por día) + GENERACIÓN — Bloque 1 (automático)
// -----------------------------------------------------------------------------

/** Guarda la pauta por negocio (cada día con su hora). Se llama directamente. */
export async function guardarPautaAction(tenantId: string, dias: PautaDia[]): Promise<AutoState> {
  const s = await getSession();
  if (!s) return { ts: Date.now(), variant: "error", mensaje: "No autorizado" };
  if (!dias.length) return { ts: Date.now(), variant: "error", mensaje: "Marca al menos un día." };

  const guardada = await savePautaPublicacion(tenantId || DEFAULT_TENANT_ID, { dias });
  if (!guardada) return { ts: Date.now(), variant: "error", mensaje: "No se encontró el negocio." };

  revalidatePath("/dashboard/marta/calendario");
  return { ts: Date.now(), variant: "ok", mensaje: `Pauta guardada: ${resumenPauta(guardada.dias)}.` };
}

/**
 * Guarda la pauta Y genera los posts del mes (los deja "scheduled"). Reparte el
 * total entre las fechas de la pauta. Es una acción del fundador: fuerza la
 * generación aunque MARTA_AUTO_ENABLED esté apagado (programar NO publica).
 */
export async function generarMesAction(
  tenantId: string,
  dias: PautaDia[],
  total: number,
): Promise<AutoState> {
  const s = await getSession();
  if (!s) return { ts: Date.now(), variant: "error", mensaje: "No autorizado" };
  if (!dias.length) return { ts: Date.now(), variant: "error", mensaje: "Marca al menos un día en la pauta." };

  const tid = tenantId || DEFAULT_TENANT_ID;
  // Guardamos la pauta antes de generar → lo que ves es lo que se genera y lo
  // que usará la generación automática (n8n) a partir de ahora.
  const guardada = await savePautaPublicacion(tid, { dias });
  if (!guardada) return { ts: Date.now(), variant: "error", mensaje: "No se encontró el negocio." };

  const max = Math.min(Math.max(Number.isFinite(total) ? Math.floor(total) : 8, 1), 20);
  const res = await generarMes({ tenantId: tid, baseUrl: await baseUrlFromHeaders(), max, dias: guardada.dias, forzar: true });

  if (!res.ok) {
    return {
      ts: Date.now(),
      variant: "error",
      mensaje: res.reason === "sin_huecos"
        ? "No quedan fechas futuras este mes con esa pauta."
        : `No se pudo generar: ${res.detail}`,
    };
  }

  revalidatePath("/dashboard/marta/calendario");
  return {
    ts: Date.now(),
    variant: "ok",
    mensaje: `${res.posts.length} posts programados en ${res.mes} (pauta: ${resumenPauta(guardada.dias)}).`
      + (res.errores.length ? ` ${res.errores.length} aviso(s).` : ""),
    generados: res.posts.length,
  };
}

// -----------------------------------------------------------------------------
// REPROGRAMAR una entrada (cambiar su fecha/hora, sigue scheduled)
// -----------------------------------------------------------------------------

export async function reprogramarAction(_prev: PublicarState, formData: FormData): Promise<PublicarState> {
  const s = await getSession();
  if (!s) return { ts: Date.now(), variant: "error", mensaje: "No autorizado" };

  const entryId = String(formData.get("entryId") || "").trim();
  const tenantId = String(formData.get("tenantId") || DEFAULT_TENANT_ID).trim();
  const fecha = String(formData.get("fecha") || "").trim();
  const hora = String(formData.get("hora") || "").trim();
  if (!entryId) return { ts: Date.now(), variant: "error", mensaje: "Falta la entrada" };

  const utc = madridInputsToUtc(fecha, hora);
  if (!utc) return { ts: Date.now(), variant: "error", mensaje: "Fecha u hora no válidas" };

  const actualizada = await rescheduleEntry(tenantId, entryId, utc.toISOString());
  if (!actualizada) return { ts: Date.now(), variant: "error", mensaje: "Entrada no encontrada" };
  if (actualizada.status === "published") {
    return { ts: Date.now(), variant: "error", mensaje: "Ya está publicada: no se puede reprogramar." };
  }

  revalidatePath("/dashboard/marta/calendario");
  const cuando = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(utc);
  return { ts: Date.now(), variant: "ok", mensaje: `Reprogramado para ${cuando}.` };
}

// -----------------------------------------------------------------------------
// MEJORAR TEXTO CON IA (opcional, solo al pulsar). Reutiliza generarCaption.
// -----------------------------------------------------------------------------

export async function mejorarCaptionAction(texto: string, tenantId: string): Promise<MejorarResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "No autorizado" };
  const limpio = (texto || "").trim();
  if (!limpio) return { ok: false, error: "Escribe primero un texto para mejorar." };

  const cap = await generarCaption({
    tenantId: tenantId || DEFAULT_TENANT_ID,
    tema: "Pulir y mejorar el borrador que aporta el usuario, manteniendo su mensaje e intención",
    contexto: `BORRADOR DEL USUARIO (mejóralo sin cambiar su idea):\n${limpio}`,
    cuentaPropia: (tenantId || DEFAULT_TENANT_ID) === DEFAULT_TENANT_ID,
  });
  if (!cap.ok) return { ok: false, error: `No se pudo mejorar (${cap.reason}): ${cap.detail}` };
  return { ok: true, texto: cap.caption };
}

// -----------------------------------------------------------------------------
// CREAR ENTRADA MANUAL (imagen ya subida a URL durable + texto propio + fecha)
// -----------------------------------------------------------------------------

export async function crearEntradaManualAction(formData: FormData): Promise<CrearManualResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "No autorizado" };

  const tenantId = String(formData.get("tenantId") || DEFAULT_TENANT_ID).trim();
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const caption = String(formData.get("caption") || "").trim();
  const fecha = String(formData.get("fecha") || "").trim();
  const hora = String(formData.get("hora") || "").trim();

  if (!imageUrl) return { ok: false, error: "Falta la imagen (súbela antes de guardar)." };
  if (!caption) return { ok: false, error: "Falta el texto del post." };
  const utc = madridInputsToUtc(fecha, hora);
  if (!utc) return { ok: false, error: "Fecha u hora no válidas." };

  // Mismo store, misma forma y mismo status "scheduled" que las de Marta → el
  // MISMO bucle de publicación (dueNow) la recoge. No hay publicador nuevo.
  await scheduleAtDates(tenantId, [
    { caption, imageUrl, tema: "Subido a mano", mediaType: "IMAGE", scheduledAt: utc.toISOString() },
  ]);

  revalidatePath("/dashboard/marta/calendario");
  return { ok: true, scheduledAt: utc.toISOString() };
}
