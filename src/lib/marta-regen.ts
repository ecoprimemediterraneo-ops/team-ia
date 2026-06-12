// =============================================================================
// Regeneración de una propuesta de Marta a partir del feedback del cliente.
// =============================================================================
//
// Cuando el cliente pide cambios ("cambia la foto y el texto, pon X"), el
// webhook llama aquí para rehacer DE VERDAD la propuesta (caption y/o imagen)
// con ese feedback, creando una propuesta nueva (que reemplaza a la pendiente)
// y devolviendo lo necesario para mandarla por WhatsApp.
//
// Límite anti-bucle: MAX_REGEN regeneraciones por flujo (control de coste de
// gpt-image-1 + Haiku).
// =============================================================================

import "server-only";
import { generarCaption } from "./marta-caption";
import { generatePostImage } from "./marta-image-gen";
import { createProposal, type MartaProposal } from "./marta-proposals";

export const MAX_REGEN = 5;

export type RegenResult =
  | {
      kind: "ok";
      proposal: MartaProposal;
      imageUrl: string;
      caption: string;
      changedFoto: boolean;
      changedCaption: boolean;
    }
  | { kind: "limit" }            // se alcanzó MAX_REGEN
  | { kind: "needs_video" }      // pidió cambiar la imagen pero es un reel/vídeo
  | { kind: "error"; detail: string };

function isVideo(m: MartaProposal["mediaType"]): boolean {
  return m === "REELS" || m === "STORIES_VIDEO";
}

export async function regenerateProposal(opts: {
  proposal: MartaProposal;
  changeFoto: boolean;
  changeCaption: boolean;
  feedback: string;            // el mensaje del cliente con los cambios pedidos
  baseUrl?: string;
}): Promise<RegenResult> {
  const p = opts.proposal;
  const already = p.regenCount ?? 0;
  if (already >= MAX_REGEN) return { kind: "limit" };

  // Si pide cambiar la imagen pero el media es vídeo, no se puede regenerar.
  if (opts.changeFoto && isVideo(p.mediaType)) {
    // Aún así podemos regenerar el caption si lo pidió; pero el vídeo lo sube él.
    if (!opts.changeCaption) return { kind: "needs_video" };
  }

  // Combinamos el contexto guardado con el nuevo feedback para no perder el tema.
  const contextoRegen = [p.contexto, `Cambios pedidos por el cliente: ${opts.feedback}`]
    .filter(Boolean)
    .join("\n");

  // --- Caption ---
  let caption = p.caption;
  if (opts.changeCaption) {
    const cap = await generarCaption({ tenantId: p.tenantId, tema: p.tema, contexto: contextoRegen });
    if (!cap.ok) return { kind: "error", detail: `caption: [${cap.reason}] ${cap.detail}` };
    caption = cap.caption;
  }

  // --- Imagen (solo para tipos imagen) ---
  let imageUrl = p.imageUrl;
  let imagePrompt = p.imagePrompt;
  let imageSource = p.imageSource;
  const canRegenImage = opts.changeFoto && !isVideo(p.mediaType);
  if (canRegenImage) {
    const gen = await generatePostImage({
      tenantId: p.tenantId,
      tema: p.tema,
      contexto: contextoRegen,
      mediaType: p.mediaType === "STORIES_IMAGE" ? "STORIES_IMAGE" : "IMAGE",
      baseUrl: opts.baseUrl,
    });
    if (!gen.ok) return { kind: "error", detail: `imagen: [${gen.reason}] ${gen.detail}` };
    imageUrl = gen.url;
    imagePrompt = gen.prompt;
    imageSource = "generada_ia";
  }

  // Crea la propuesta nueva (reemplaza la pendiente por (tenant, número)).
  const nueva = await createProposal({
    tenantId: p.tenantId,
    recipientWhatsapp: p.recipientWhatsapp,
    imageUrl,
    caption,
    mediaType: p.mediaType,
    imageSource,
    imagePrompt,
    tema: p.tema,
    contexto: p.contexto,
    regenCount: already + 1,
  });

  return {
    kind: "ok",
    proposal: nueva,
    imageUrl,
    caption,
    changedFoto: canRegenImage,
    changedCaption: opts.changeCaption,
  };
}
