"use server";

// Server actions del panel LIVE de Marta para el cliente.
// Auth: cualquier usuario con sesión (no solo fundador). El tenantId se
// resuelve desde la sesión — hoy todo va al tenant fundador (single-tenant
// real en producción); cuando exista mapping email→tenantId se cambia aquí.

import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import { generateArranque } from "@/lib/marta-arranque";
import { generarCaption } from "@/lib/marta-caption";
import { createProposal } from "@/lib/marta-proposals";
import {
  sendWhatsAppImage,
  sendWhatsAppText,
  sendWhatsAppVideo,
} from "@/lib/whatsapp-sender";
import type { ProposalMediaType } from "@/lib/marta-proposals";
import type { ArranqueState, ProposalState } from "./types";

async function gateTenantId(): Promise<string | null> {
  const s = await getSession();
  if (!s) return null;
  // Single-tenant durante la beta. Mapping email→tenantId va aquí cuando exista.
  return DEFAULT_TENANT_ID;
}

// -----------------------------------------------------------------------------
// Arranque (BIO + N posts)
// -----------------------------------------------------------------------------

export async function arranqueClientAction(
  _prev: ArranqueState,
  formData: FormData,
): Promise<ArranqueState> {
  const tenantId = await gateTenantId();
  if (!tenantId) return { ts: Date.now(), variant: "error", title: "Inicia sesión" };

  const countRaw = parseInt(String(formData.get("count") || "6"), 10);
  const count = Math.min(Math.max(Number.isFinite(countRaw) ? countRaw : 6, 1), 9);

  const result = await generateArranque(tenantId, count);
  if (!("ok" in result) || !result.ok) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "No se pudo generar el arranque",
      detail: "ok" in result ? "" : (result as { detail?: string }).detail || "",
    };
  }
  return {
    ts: Date.now(),
    variant: "ok",
    title: `Generado: BIO + ${result.drafts.length} posts`,
    detail: result.errors.length ? `${result.errors.length} aviso(s).` : "Todo listo para revisar.",
    bio: result.bio.ok ? result.bio.bio : `(bio no generada: ${result.bio.detail})`,
    drafts: result.drafts,
    warnings: result.errors,
  };
}

// -----------------------------------------------------------------------------
// Nueva propuesta → WhatsApp → aprobación → publicación
// -----------------------------------------------------------------------------

export async function nuevaPropuestaClientAction(
  _prev: ProposalState,
  formData: FormData,
): Promise<ProposalState> {
  const tenantId = await gateTenantId();
  if (!tenantId) return { ts: Date.now(), variant: "error", title: "Inicia sesión" };

  const recipient = String(formData.get("recipient") || "").replace(/\D/g, "");
  const imageUrl = String(formData.get("imageUrl") || "").trim();
  const tema = String(formData.get("tema") || "").trim();
  const contexto = String(formData.get("contexto") || "").trim();
  const mediaTypeRaw = String(formData.get("mediaType") || "IMAGE").trim().toUpperCase();
  const mediaType: ProposalMediaType =
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
      title: "Falta tu número de WhatsApp",
      detail: "Pon tu número con prefijo (ej. 34600111222) para recibir la propuesta y aprobarla.",
    };
  }
  if (!/^https?:\/\//.test(imageUrl)) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "URL no válida",
      detail: "Debe empezar por https:// y ser pública (JPG/PNG para post/story imagen; MP4 para reel/story vídeo).",
    };
  }

  // 1) Caption desde la ficha.
  const cap = await generarCaption({ tenantId, tema: tema || undefined, contexto: contexto || undefined });
  if (!cap.ok) {
    console.error(`[dashboard/marta/action] generarCaption falló: reason=${cap.reason} detail=${cap.detail}`);
    return {
      ts: Date.now(),
      variant: "error",
      title: "No se pudo generar el texto",
      detail: `[${cap.reason}] ${cap.detail || "Revisa la ficha y la API key de Anthropic."}`,
    };
  }
  const caption = cap.caption;

  // 2) Crear propuesta.
  const proposal = await createProposal({
    tenantId,
    recipientWhatsapp: recipient,
    imageUrl,
    caption,
    mediaType,
  });

  // 3) Mandar al cliente por WhatsApp (imagen/vídeo + caption + pregunta).
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
      caption,
      proposalId: proposal.id,
      recipient,
    };
  }
  const askLabel =
    mediaType === "REELS"
      ? "Reel"
      : mediaType === "STORIES_IMAGE" || mediaType === "STORIES_VIDEO"
        ? "Story"
        : "post";
  await sendWhatsAppText(
    recipient,
    `¿Publico este ${askLabel}? Responde OK para publicar o dime qué cambiar (foto, texto o descartar).`,
  );

  return {
    ts: Date.now(),
    variant: "ok",
    title: "Propuesta enviada a tu WhatsApp ✅",
    detail:
      "Cuando respondas OK, Marta publica en Instagram. Si quieres cambios, dile lo que cambiarías y prepara otra.",
    caption,
    proposalId: proposal.id,
    recipient,
  };
}
