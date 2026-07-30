"use server";

// Disparador MANUAL del mes de Marta (para revisar antes de que se publique nada).
// Dos acciones, ambas sobre el mismo orquestador (marta-mes):
//   · previsualizar → genera y devuelve SIN tocar el store (seguro con el flag apagado)
//   · programar     → genera y deja los posts como "scheduled" en marta-calendar
// La generación AUTOMÁTICA (n8n) va por /api/cron/marta-mes y sí exige MARTA_AUTO_ENABLED.

import { headers } from "next/headers";
// getSessionLocal (no getSession): en prod idéntico (el ramo dev no corre en Vercel),
// en local admite el bypass del dashboard para poder usar y revisar el calendario.
import { getSessionLocal } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { DEFAULT_TENANT_ID, savePautaPublicacion, saveMarcaVisual, type PautaDia, type MarcaVisual } from "@/lib/tenants";
import { generarMes, madridInputsToUtc, regenerarImagenPost } from "@/lib/marta-mes";
import { publicarVencidos } from "@/lib/marta-auto-publish";
import { rescheduleEntry, scheduleAtDates, findEntryById, actualizarContenidoEntry, removeCalendarEntry, setCalendarEntryHidden } from "@/lib/marta-calendar";
import { generarCaption } from "@/lib/marta-caption";
import { resolveTopic } from "@/lib/marta-topics";
import { generatePostImage, styleExistingPhoto } from "@/lib/marta-image-gen";
import type { ProposalMediaType } from "@/lib/marta-proposals";
import { anthropic, MODELS } from "@/lib/claude";
import { storeImageDurable } from "@/lib/marta-image-store";
import { TEMA_MANUAL, type PublicarState, type AutoState, type MejorarResult, type CrearManualResult, type MarcaState, type ColoresResult, type LogoResult } from "./types";

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
  const s = await getSessionLocal();
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
  const s = await getSessionLocal();
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
  const s = await getSessionLocal();
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
  const s = await getSessionLocal();
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
// REGENERAR CONTENIDO de una entrada (texto o imagen, por separado). Mantiene
// fecha y estado "scheduled". No toca lo ya publicado (idempotencia).
// -----------------------------------------------------------------------------

// TEMA_MANUAL marca los posts subidos a mano (crearEntradaManualAction): su
// imagen es del usuario → no se regenera; su texto sí (se pule).

/** Regenera SOLO el texto (caption) de una entrada. Auto = caption nuevo del mismo
 *  tema; manual = pule el texto del usuario. Mantiene imagen y fecha. */
export async function regenerarTextoAction(tenantId: string, entryId: string): Promise<PublicarState> {
  // getSessionLocal: en prod idéntico a getSession (el ramo dev no corre en Vercel);
  // en local admite el bypass para poder revisar el regenerado sin magic link.
  const s = await getSessionLocal();
  if (!s) return { ts: Date.now(), variant: "error", mensaje: "No autorizado" };

  const tid = tenantId || DEFAULT_TENANT_ID;
  const entry = await findEntryById(tid, entryId);
  if (!entry) return { ts: Date.now(), variant: "error", mensaje: "Entrada no encontrada" };
  if (entry.status === "published") return { ts: Date.now(), variant: "error", mensaje: "Ya publicada: no se regenera." };

  const cuentaPropia = tid === DEFAULT_TENANT_ID;
  const esManual = (entry.tema || "") === TEMA_MANUAL;

  const cap = esManual
    ? await generarCaption({
        tenantId: tid,
        tema: "Pulir y mejorar el texto del usuario manteniendo su mensaje e intención",
        contexto: `TEXTO ACTUAL DEL USUARIO (mejóralo sin cambiar su idea):\n${entry.caption}`,
        cuentaPropia,
      })
    : await generarCaption({ tenantId: tid, tema: entry.tema || undefined, cuentaPropia });

  if (!cap.ok) return { ts: Date.now(), variant: "error", mensaje: `No se pudo regenerar el texto (${cap.reason}).` };

  const upd = await actualizarContenidoEntry(tid, entryId, { caption: cap.caption });
  if (!upd) return { ts: Date.now(), variant: "error", mensaje: "No se pudo guardar." };

  revalidatePath("/dashboard/marta/calendario");
  return { ts: Date.now(), variant: "ok", mensaje: esManual ? "Texto mejorado." : "Texto regenerado." };
}

/** Regenera SOLO la imagen (marca + plantilla del tenant, durable). Mantiene texto
 *  y fecha. NO aplica a posts subidos a mano (su imagen es del usuario). */
export async function regenerarImagenAction(tenantId: string, entryId: string): Promise<PublicarState> {
  // getSessionLocal: en prod idéntico a getSession; en local admite el bypass (ver arriba).
  const s = await getSessionLocal();
  if (!s) return { ts: Date.now(), variant: "error", mensaje: "No autorizado" };

  const tid = tenantId || DEFAULT_TENANT_ID;
  const entry = await findEntryById(tid, entryId);
  if (!entry) return { ts: Date.now(), variant: "error", mensaje: "Entrada no encontrada" };
  if (entry.status === "published") return { ts: Date.now(), variant: "error", mensaje: "Ya publicada: no se regenera." };
  if ((entry.tema || "") === TEMA_MANUAL) {
    return { ts: Date.now(), variant: "error", mensaje: "La imagen de un post subido a mano es tuya; no se regenera." };
  }

  const res = await regenerarImagenPost({
    tenantId: tid,
    caption: entry.caption,
    tema: entry.tema,
    temaLabel: entry.temaLabel,
    baseUrl: await baseUrlFromHeaders(),
  });
  if (!res.ok) return { ts: Date.now(), variant: "error", mensaje: `No se pudo regenerar la imagen: ${res.detail}` };

  const upd = await actualizarContenidoEntry(tid, entryId, { imageUrl: res.url });
  if (!upd) return { ts: Date.now(), variant: "error", mensaje: "No se pudo guardar." };

  revalidatePath("/dashboard/marta/calendario");
  return { ts: Date.now(), variant: "ok", mensaje: "Imagen regenerada." };
}

/**
 * Borra un post del calendario. Los NO publicados (scheduled, proposed, failed,
 * skipped, rejected) se borran DE VERDAD del store. Los PUBLICADOS no se borran
 * —se perdería el registro (igMediaId/publishedAt)—: se OCULTAN del calendario
 * conservando el historial. No afecta a la publicación (dueNow solo mira
 * "scheduled" y el calendario filtra los ocultos solo en la vista).
 */
export async function eliminarPostAction(tenantId: string, entryId: string): Promise<PublicarState> {
  const s = await getSessionLocal();
  if (!s) return { ts: Date.now(), variant: "error", mensaje: "No autorizado" };

  const tid = tenantId || DEFAULT_TENANT_ID;
  const entry = await findEntryById(tid, entryId);
  if (!entry) return { ts: Date.now(), variant: "error", mensaje: "Entrada no encontrada" };

  if (entry.status === "published") {
    const upd = await setCalendarEntryHidden(tid, entryId, true);
    if (!upd) return { ts: Date.now(), variant: "error", mensaje: "No se pudo ocultar." };
    revalidatePath("/dashboard/marta");
    return { ts: Date.now(), variant: "ok", mensaje: "Post ocultado del calendario (sigue en el registro como publicado)." };
  }

  const ok = await removeCalendarEntry(tid, entryId);
  if (!ok) return { ts: Date.now(), variant: "error", mensaje: "No se encontró el post (¿ya borrado?)." };
  revalidatePath("/dashboard/marta");
  return { ts: Date.now(), variant: "ok", mensaje: "Post borrado." };
}

// -----------------------------------------------------------------------------
// MEJORAR TEXTO CON IA (opcional, solo al pulsar). Reutiliza generarCaption.
// -----------------------------------------------------------------------------

export async function mejorarCaptionAction(texto: string, tenantId: string): Promise<MejorarResult> {
  const s = await getSessionLocal();
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
  const s = await getSessionLocal();
  if (!s) return { ok: false, error: "No autorizado" };

  const tenantId = String(formData.get("tenantId") || DEFAULT_TENANT_ID).trim();
  const captionUser = String(formData.get("caption") || "").trim();
  const fecha = String(formData.get("fecha") || "").trim();
  const hora = String(formData.get("hora") || "").trim();
  // Imagen que el usuario SUBIÓ (URL durable ya generada): se usa TAL CUAL (es suya).
  const imagenSubida = String(formData.get("imageUrl") || "").trim();

  // --- Opciones avanzadas (fusión de la antigua pestaña "Nuevo post") -------
  const imagenExterna = String(formData.get("imageUrlExterna") || "").trim();
  const mediaTypeRaw = String(formData.get("mediaType") || "IMAGE").trim().toUpperCase();
  const mediaType: ProposalMediaType =
    mediaTypeRaw === "REELS" ? "REELS"
    : mediaTypeRaw === "STORIES_IMAGE" ? "STORIES_IMAGE"
    : mediaTypeRaw === "STORIES_VIDEO" ? "STORIES_VIDEO"
    : "IMAGE";
  const topic = resolveTopic(String(formData.get("tema") || "auto").trim());
  const contextoTexto = String(formData.get("contextoTexto") || "").trim();
  const fotoBriefUser = String(formData.get("fotoBrief") || "").trim();
  const fotoBrief = [topic.imageBrief, fotoBriefUser].filter(Boolean).join(" ");
  const captionTema = topic.captionTema;

  const utc = madridInputsToUtc(fecha, hora);
  if (!utc) return { ok: false, error: "Fecha u hora no válidas." };

  const isVideo = mediaType === "REELS" || mediaType === "STORIES_VIDEO";
  const hasExterna = /^https?:\/\//.test(imagenExterna);
  const baseUrl = await baseUrlFromHeaders();

  // --- Resolver imagen final + tema a guardar -------------------------------
  //   vídeo (reel/story vídeo) → URL del MP4 obligatoria (no se genera)
  //   imagen subida por el usuario → tal cual (tema "Subido a mano", su imagen no se regenera)
  //   URL externa de foto → estilizar con la ficha (como hacía "Nuevo post")
  //   sin imagen → generar con IA (tema + describe la foto + ficha); esa SÍ se puede regenerar
  let finalUrl = "";
  let temaEntry: string = TEMA_MANUAL;

  if (isVideo) {
    if (!hasExterna) return { ok: false, error: "Para reels y stories de vídeo pega la URL pública del MP4 (no se genera con IA)." };
    finalUrl = imagenExterna;
    temaEntry = TEMA_MANUAL;
  } else if (imagenSubida) {
    finalUrl = imagenSubida;
    temaEntry = TEMA_MANUAL;
  } else if (hasExterna) {
    const styled = await styleExistingPhoto({ tenantId, url: imagenExterna, baseUrl });
    finalUrl = styled.ok ? styled.url : imagenExterna;
    temaEntry = TEMA_MANUAL;
  } else {
    const gen = await generatePostImage({
      tenantId,
      tema: captionTema || undefined,
      contexto: fotoBrief || undefined,
      mediaType: mediaType === "STORIES_IMAGE" ? "STORIES_IMAGE" : "IMAGE",
      baseUrl,
    });
    if (!gen.ok) return { ok: false, error: `No se pudo generar la imagen [${gen.reason}]: ${gen.detail}` };
    finalUrl = gen.url;
    temaEntry = captionTema || "Post generado por Marta"; // imagen IA → NO es "Subido a mano"
  }

  // --- Resolver caption final -----------------------------------------------
  //   texto escrito → tal cual; vacío → generar con IA desde tema + detalles + ficha
  let caption = captionUser;
  if (!caption) {
    const cap = await generarCaption({
      tenantId,
      tema: captionTema || undefined,
      contexto: contextoTexto || undefined,
      cuentaPropia: tenantId === DEFAULT_TENANT_ID,
    });
    if (!cap.ok) return { ok: false, error: `Escribe un texto o rellena tema/detalles: no se pudo generar [${cap.reason}] ${cap.detail}` };
    caption = cap.caption;
  }

  // Mismo store, misma forma y mismo status "scheduled" que las de Marta → el
  // MISMO bucle de publicación (dueNow) la recoge. No hay publicador nuevo.
  await scheduleAtDates(tenantId, [
    { caption, imageUrl: finalUrl, tema: temaEntry, mediaType, scheduledAt: utc.toISOString() },
  ]);

  revalidatePath("/dashboard/marta");
  return { ok: true, scheduledAt: utc.toISOString() };
}

// -----------------------------------------------------------------------------
// IDENTIDAD VISUAL: guardar la marca del negocio (colores + logo).
// -----------------------------------------------------------------------------

export async function guardarMarcaAction(tenantId: string, marca: Partial<MarcaVisual>): Promise<MarcaState> {
  const s = await getSessionLocal();
  if (!s) return { ts: Date.now(), variant: "error", mensaje: "No autorizado" };

  const guardada = await saveMarcaVisual(tenantId || DEFAULT_TENANT_ID, marca);
  if (!guardada) return { ts: Date.now(), variant: "error", mensaje: "No se encontró el negocio." };

  revalidatePath("/dashboard/marta/calendario");
  return { ts: Date.now(), variant: "ok", mensaje: "Identidad visual guardada. Los próximos posts usarán estos colores y logo." };
}

/**
 * Sube el logo (ya redimensionado en el cliente) a una URL pública DURABLE que
 * /api/og/post pueda descargar semanas después. Reutiliza storeImageDurable
 * (Vercel Blob → si no, store con TTL de 45 días). Conserva el mime (PNG con
 * transparencia). El logo es pequeño, así que va bien por server action.
 */
export async function subirLogoAction(dataUrl: string): Promise<LogoResult> {
  const s = await getSessionLocal();
  if (!s) return { ok: false, error: "No autorizado" };
  const m = dataUrl.match(/^data:(image\/(png|jpeg|webp));base64,(.+)$/);
  if (!m) return { ok: false, error: "Formato de imagen no válido." };
  const mime = m[1];
  const buf = Buffer.from(m[3], "base64");
  if (!buf.length) return { ok: false, error: "Imagen vacía." };
  try {
    const img = await storeImageDurable(buf, mime, await baseUrlFromHeaders());
    return { ok: true, url: img.url };
  } catch (err) {
    return { ok: false, error: `No se pudo subir el logo (${err instanceof Error ? err.message : "error"}).` };
  }
}

// -----------------------------------------------------------------------------
// SACAR COLORES DE UNA CAPTURA (visión de Anthropic). Solo PROPONE: el usuario
// ajusta a mano. Si falla, no rompe nada; se ponen los colores manualmente.
// -----------------------------------------------------------------------------

function hexValido(v: unknown): v is string {
  return typeof v === "string" && /^#([0-9a-fA-F]{6})$/.test(v.trim());
}

export async function extraerColoresAction(imagenBase64Jpeg: string): Promise<ColoresResult> {
  const s = await getSessionLocal();
  if (!s) return { ok: false, error: "No autorizado" };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Falta ANTHROPIC_API_KEY; pon los colores a mano." };

  // Aceptamos tanto data URL como base64 pelado.
  const data = imagenBase64Jpeg.replace(/^data:image\/[a-zA-Z]+;base64,/, "").trim();
  if (!data) return { ok: false, error: "No llegó la imagen." };

  try {
    const r = await anthropic.messages.create({
      model: MODELS.strong, // sonnet: con visión
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
            {
              type: "text",
              text:
                "Esta es una captura del Instagram de un negocio. Deduce sus TRES colores de marca dominantes: " +
                "fondo (el claro de sus publicaciones), acento (su color vivo/principal) y texto (oscuro, para leer). " +
                'Responde SOLO con un JSON, sin explicaciones: {"fondo":"#RRGGBB","acento":"#RRGGBB","texto":"#RRGGBB"}.',
            },
          ],
        },
      ],
    });
    const raw = r.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("").trim();
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, error: "La IA no devolvió colores; ponlos a mano." };
    const parsed = JSON.parse(m[0]) as { fondo?: string; acento?: string; texto?: string };
    if (!hexValido(parsed.fondo) || !hexValido(parsed.acento) || !hexValido(parsed.texto)) {
      return { ok: false, error: "Colores no válidos; ponlos a mano." };
    }
    return { ok: true, fondo: parsed.fondo!, acento: parsed.acento!, texto: parsed.texto! };
  } catch (err) {
    return { ok: false, error: `No se pudo analizar la imagen (${err instanceof Error ? err.message : "error"}).` };
  }
}
