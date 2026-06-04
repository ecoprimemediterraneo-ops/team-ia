"use server";

// Server actions de /admin/marta-flujo. Solo funciones async exportadas.

import { getSession } from "@/lib/auth";
import { generarCaption } from "@/lib/marta-caption";
import { createProposal } from "@/lib/marta-proposals";
import { sendWhatsAppImage, sendWhatsAppText, sendWhatsAppVideo } from "@/lib/whatsapp-sender";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import type { FlujoState } from "./types";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

async function gate(): Promise<{ email: string } | null> {
  const s = await getSession();
  if (!s) return null;
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") return null;
  return s;
}

export async function generarYEnviarPropuestaAction(
  _prev: FlujoState,
  formData: FormData,
): Promise<FlujoState> {
  const s = await gate();
  if (!s) {
    return { ts: Date.now(), variant: "error", title: "No autorizado" };
  }

  const tenantId = String(formData.get("tenantId") || DEFAULT_TENANT_ID).trim();
  const recipient = String(formData.get("recipient") || "").replace(/\D/g, "");
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const tema = String(formData.get("tema") || "").trim();
  const contexto = String(formData.get("contexto") || "").trim();
  const mediaTypeRaw = String(formData.get("mediaType") || "IMAGE").trim().toUpperCase();
  const mediaType: "IMAGE" | "REELS" | "STORIES_IMAGE" | "STORIES_VIDEO" =
    mediaTypeRaw === "REELS"
      ? "REELS"
      : mediaTypeRaw === "STORIES_IMAGE"
        ? "STORIES_IMAGE"
        : mediaTypeRaw === "STORIES_VIDEO"
          ? "STORIES_VIDEO"
          : "IMAGE";
  const isVideo = mediaType === "REELS" || mediaType === "STORIES_VIDEO";

  if (!recipient) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "Falta número de WhatsApp",
      detail: "Introduce el número del cliente con prefijo internacional, ej. 34600111222.",
    };
  }
  if (!/^https?:\/\//.test(imageUrl)) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "URL de imagen no válida",
      detail: "Debe empezar por http(s):// y ser pública.",
    };
  }

  // 1) Generar caption con Marta.
  const cap = await generarCaption({ tenantId, tema: tema || undefined, contexto: contexto || undefined });
  if (!("ok" in cap) || !cap.ok) {
    const detail = "ok" in cap ? "" : ("detail" in cap ? (cap as { detail?: string }).detail : "");
    return {
      ts: Date.now(),
      variant: "error",
      title: "No se pudo generar el caption",
      detail: detail || "Revisa la ficha del tenant y la API key de Anthropic.",
    };
  }
  const caption = (cap as { ok: true; caption: string }).caption;

  // 2) Crear propuesta pendiente.
  const proposal = await createProposal({
    tenantId,
    recipientWhatsapp: recipient,
    imageUrl,
    caption,
    mediaType,
  });

  // 3) Enviar al WhatsApp del cliente: media + caption + pregunta.
  const mediaRes = isVideo
    ? await sendWhatsAppVideo(recipient, imageUrl, caption)
    : await sendWhatsAppImage(recipient, imageUrl, caption);
  if (!mediaRes.ok) {
    return {
      ts: Date.now(),
      variant: "error",
      title: isVideo
        ? "No se pudo enviar el vídeo por WhatsApp"
        : "No se pudo enviar la imagen por WhatsApp",
      detail: `${mediaRes.reason}: ${mediaRes.detail}`,
      proposalId: proposal.id,
      caption,
      imageUrl,
      recipient,
    };
  }
  const askLabel =
    mediaType === "REELS"
      ? "Reel"
      : mediaType === "STORIES_IMAGE" || mediaType === "STORIES_VIDEO"
        ? "Story"
        : "post";
  const askRes = await sendWhatsAppText(
    recipient,
    `¿Publico este ${askLabel}? Responde OK para publicar o dime qué cambiar (foto, texto o descartar).`,
  );
  if (!askRes.ok) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "Imagen enviada pero el mensaje de confirmación falló",
      detail: `${askRes.reason}: ${askRes.detail}`,
      proposalId: proposal.id,
      caption,
      imageUrl,
      recipient,
    };
  }

  return {
    ts: Date.now(),
    variant: "ok",
    title: "Propuesta enviada al WhatsApp del cliente ✅",
    detail:
      "Cuando el cliente responda OK por WhatsApp, Marta publicará automáticamente en Instagram. Si responde otra cosa, le respondemos 'Vale, lo ajusto' y la propuesta queda pendiente.",
    proposalId: proposal.id,
    caption,
    imageUrl,
    recipient,
  };
}
