"use server";

// Vídeos de Marta desde el panel: generar (vista previa) y después mandarlo al
// MISMO flujo que las imágenes — revisar en la app, WhatsApp o calendario.
// El tenant sale SIEMPRE del contexto del panel, nunca del formulario.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { generarVideo, mediaTypeDe, type PlantillaVideo, type FormatoVideo, type VideoSpec } from "@/lib/marta-video";
import { createProposal } from "@/lib/marta-proposals";
import { scheduleAtDates } from "@/lib/marta-calendar";
import { madridInputsToUtc } from "@/lib/marta-mes";
import { openRoute } from "@/lib/wa-route";
import { sendWhatsAppText, sendWhatsAppVideo } from "@/lib/whatsapp-sender";

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type VideoPreview =
  | { ok: true; url: string; caption: string; spec: VideoSpec; costeUSD: number; renderS: number; duracionS: number; usados: number; limite: number; nota?: string }
  | { ok: false; error: string };

export async function generarVideoAction(input: {
  plantilla: PlantillaVideo;
  formato: FormatoVideo;
  slug?: string;
  servicioId?: string;
  precioOferta?: number;
  hasta?: string;
  fotos?: string[];
  indicaciones?: string;
}): Promise<VideoPreview> {
  if (!(await getSessionLocal())) return { ok: false, error: "Inicia sesión" };
  const { tenantId } = await contextoPanelODefecto();
  if (!["oferta", "antes_despues", "hueco_libre"].includes(input.plantilla)) return { ok: false, error: "Plantilla desconocida" };
  const r = await generarVideo({
    tenantId,
    plantilla: input.plantilla,
    formato: input.formato === "historia" ? "historia" : "reel",
    slug: input.slug || undefined,
    servicioId: input.servicioId || undefined,
    precioOferta: input.precioOferta && input.precioOferta > 0 ? input.precioOferta : undefined,
    hasta: input.hasta || undefined,
    fotos: (input.fotos || []).slice(0, 3),
    indicaciones: (input.indicaciones || "").slice(0, 300) || undefined,
    baseUrl: await baseUrl(),
  });
  if (!r.ok) return { ok: false, error: r.detail };
  revalidatePath("/dashboard/marta");
  return { ok: true, url: r.url, caption: r.caption, spec: r.spec, costeUSD: r.costeUSD, renderS: Math.round(r.renderMs / 100) / 10, duracionS: r.duracionS, usados: r.usados, limite: r.limite, nota: r.nota };
}

export async function enviarVideoAction(input: {
  url: string;
  caption: string;
  spec: VideoSpec;
  destino: "app" | "whatsapp" | "calendario";
  recipient?: string;
  fecha?: string;
  hora?: string;
}): Promise<{ ok: boolean; mensaje: string }> {
  if (!(await getSessionLocal())) return { ok: false, mensaje: "Inicia sesión" };
  const { tenantId } = await contextoPanelODefecto();
  if (!/^https?:\/\//.test(input.url)) return { ok: false, mensaje: "Falta el vídeo" };
  const caption = input.caption.trim().slice(0, 2200);
  if (!caption) return { ok: false, mensaje: "Escribe el texto del post" };
  const mediaType = mediaTypeDe(input.spec.formato);
  const tema = `Vídeo · ${input.spec.plantilla}`;

  if (input.destino === "calendario") {
    const utc = madridInputsToUtc(input.fecha || "", input.hora || "");
    if (!utc || utc.getTime() < Date.now()) return { ok: false, mensaje: "Pon una fecha y hora futuras." };
    await scheduleAtDates(tenantId, [{ caption, imageUrl: input.url, tema, temaLabel: tema, mediaType, scheduledAt: utc.toISOString(), video: input.spec }]);
    revalidatePath("/dashboard/marta");
    return { ok: true, mensaje: "Programado en el calendario. A su hora sigue el mismo camino que los posts de imagen." };
  }

  const recipient = (input.recipient || "").replace(/\D/g, "");
  if (input.destino === "whatsapp" && !recipient) return { ok: false, mensaje: "Pon tu número de WhatsApp con prefijo." };
  const proposal = await createProposal({
    tenantId, recipientWhatsapp: input.destino === "whatsapp" ? recipient : "", imageUrl: input.url, caption, mediaType,
    imageSource: "video_plantilla", tema, contexto: input.spec.indicaciones, regenCount: 0, video: input.spec,
  });
  if (input.destino === "app") {
    revalidatePath("/dashboard/marta");
    return { ok: true, mensaje: "Listo para revisar en la pestaña «Historial»: publícalo, pide cambios o descártalo." };
  }
  await openRoute(recipient, "marta", proposal.id);
  const env = await sendWhatsAppVideo(recipient, input.url, caption);
  if (!env.ok) return { ok: false, mensaje: `No se pudo enviar por WhatsApp: ${env.reason}: ${env.detail}` };
  await sendWhatsAppText(recipient, `¿Publico este ${mediaType === "REELS" ? "Reel" : "vídeo en historias"}? Responde OK para publicar o dime qué cambiar.`);
  return { ok: true, mensaje: "Enviado a tu WhatsApp. Contesta OK para publicarlo o dile qué cambiar." };
}
