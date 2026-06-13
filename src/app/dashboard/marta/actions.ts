"use server";

// Server actions del panel LIVE de Marta para el cliente.
// Auth: cualquier usuario con sesión (no solo fundador). El tenantId se
// resuelve desde la sesión — hoy todo va al tenant fundador (single-tenant
// real en producción); cuando exista mapping email→tenantId se cambia aquí.

import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import { generateArranque } from "@/lib/marta-arranque";
import { generarCaption } from "@/lib/marta-caption";
import { createProposal } from "@/lib/marta-proposals";
import { generatePostImage, styleExistingPhoto } from "@/lib/marta-image-gen";
import { openRoute } from "@/lib/wa-route";
import { resolveTopic } from "@/lib/marta-topics";
import {
  sendWhatsAppImage,
  sendWhatsAppText,
  sendWhatsAppVideo,
} from "@/lib/whatsapp-sender";
import type { ProposalMediaType, MartaProposal } from "@/lib/marta-proposals";
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
  // "tema" ahora es la KEY de un tema predefinido (desplegable).
  const topic = resolveTopic(String(formData.get("tema") || "auto").trim());
  const contextoTexto = String(formData.get("contextoTexto") || "").trim();
  const fotoBriefUser = String(formData.get("fotoBrief") || "").trim();
  // Asunto del caption = el del tema (vacío en "auto" → lo elige la IA).
  const tema = topic.captionTema;
  // Contexto de imagen = guion visual del tema + lo que escriba el cliente.
  const fotoBrief = [topic.imageBrief, fotoBriefUser].filter(Boolean).join(" ");
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
  const hasUrl = /^https?:\/\//.test(imageUrl);

  // Vídeo (reel / story vídeo): el cliente DEBE subir el vídeo. No se genera.
  if (isVideo && !hasUrl) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "Falta el vídeo",
      detail: "Para reels y stories de vídeo tienes que pegar la URL pública del MP4 (no se genera con IA).",
    };
  }

  // -------------------------------------------------------------------------
  // MODO MEZCLA — resolver la imagen final:
  //   imagen + URL  → estilizar la foto del cliente con el estilo de la ficha
  //   imagen sin URL → generar con IA (DALL·E) usando toda la ficha
  //   vídeo          → usar la URL tal cual (subida por el cliente)
  // -------------------------------------------------------------------------
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  let finalUrl = imageUrl;
  let imageSource: MartaProposal["imageSource"] = "subida";
  let imagePrompt: string | undefined;

  if (!isVideo) {
    const isStory = mediaType === "STORIES_IMAGE";
    if (hasUrl) {
      // Estilizar la foto pegada con el estilo de la ficha (si falla, original).
      const styled = await styleExistingPhoto({ tenantId, url: imageUrl, baseUrl });
      if (styled.ok) {
        finalUrl = styled.url;
        imageSource = "subida_estilizada";
      } else {
        finalUrl = imageUrl;
        imageSource = "subida";
        console.warn(`[dashboard/marta/action] estilizado falló, uso foto original: ${styled.detail}`);
      }
    } else {
      // Generar con IA usando TODA la ficha.
      const gen = await generatePostImage({
        tenantId,
        tema: tema || undefined,
        contexto: fotoBrief || undefined, // guion visual del tema + descripción del cliente
        mediaType: isStory ? "STORIES_IMAGE" : "IMAGE",
        baseUrl,
      });
      if (!gen.ok) {
        return {
          ts: Date.now(),
          variant: "error",
          title: "No se pudo generar la imagen",
          detail: `[${gen.reason}] ${gen.detail}`,
        };
      }
      finalUrl = gen.url;
      imageSource = "generada_ia";
      imagePrompt = gen.prompt;
    }
  } else {
    imageSource = "video_subido";
  }

  // 1) Caption desde la ficha.
  const cap = await generarCaption({ tenantId, tema: tema || undefined, contexto: contextoTexto || undefined });
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

  // 2) Crear propuesta (con auditoría del origen + tema/contexto para regenerar).
  const proposal = await createProposal({
    tenantId,
    recipientWhatsapp: recipient,
    imageUrl: finalUrl,
    caption,
    mediaType,
    imageSource,
    imagePrompt,
    tema: tema || undefined,
    contexto: contextoTexto || undefined,
    fotoBrief: fotoBrief || undefined,
    regenCount: 0,
  });
  // Abrimos la sesión de ruteo: las respuestas de este número irán a Marta.
  await openRoute(recipient, "marta", proposal.id);

  // 3) Mandar al cliente por WhatsApp (imagen/vídeo + caption + pregunta).
  const mediaRes = isVideo
    ? await sendWhatsAppVideo(recipient, finalUrl, caption)
    : await sendWhatsAppImage(recipient, finalUrl, caption);
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

  const sourceLabel =
    imageSource === "generada_ia"
      ? "🎨 Imagen generada con IA desde tu ficha."
      : imageSource === "subida_estilizada"
        ? "🖼️ Tu foto, con el estilo de la ficha aplicado."
        : imageSource === "video_subido"
          ? "🎬 Vídeo que subiste."
          : "🖼️ Tu foto.";

  return {
    ts: Date.now(),
    variant: "ok",
    title: "Propuesta enviada a tu WhatsApp ✅",
    detail:
      `${sourceLabel} Cuando respondas OK, Marta publica en Instagram. Si quieres cambios, dile lo que cambiarías y prepara otra.`,
    caption,
    proposalId: proposal.id,
    recipient,
  };
}
