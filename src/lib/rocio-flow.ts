// Orquestador del ciclo de Rocío:
//   1. Listar reseñas nuevas (sin reviewReply) de la ubicación conectada.
//   2. Por cada reseña → generar respuesta con Haiku según rating.
//   3. Si ROCIO_AUTO_REPLY y rating=5 sin texto → publicar directo.
//      Si no → crear proposal y enviar al WhatsApp del cliente para
//      aprobación (interceptor de Pablo).
//   4. Emitir review_in (siempre) y review_replied (si publica direct).

import "server-only";
import { logEvent, makeEventId } from "./event-log";
import { resolveTenantFromMeta, DEFAULT_TENANT_ID, getTenant } from "./tenants";
import { getGbpTokens } from "./store";
import { listReviews, replyToReview, type GbpReview } from "./google-business";
import { generateReviewReply, shouldAutoReply } from "./rocio-reviews";
import { createRocioProposal } from "./rocio-proposals";
import { sendWhatsAppText } from "./whatsapp-sender";

export type ProcessResult = {
  scanned: number;
  newAlreadyAnswered: number;
  autoPublished: number;
  proposedToClient: number;
  errors: string[];
  details: Array<{
    reviewId: string;
    rating: number;
    reviewer: string;
    action: "auto_replied" | "proposed" | "skipped_already_answered" | "error";
    detail?: string;
  }>;
};

export async function processNewReviews(opts: {
  userEmail: string;
  redirectUri: string;
  recipientWhatsapp?: string;     // si está, propuestas van aquí; si no, sin envío
  tenantId?: string;
}): Promise<ProcessResult> {
  const tenantId = opts.tenantId || DEFAULT_TENANT_ID;
  const tokens = await getGbpTokens(opts.userEmail);
  // En modo mock listReviews funciona sin tokens.
  const locationName = tokens?.locationName || "accounts/MOCK/locations/MOCK";

  const reviews = await listReviews(opts.userEmail, opts.redirectUri, locationName);
  const result: ProcessResult = {
    scanned: reviews.length,
    newAlreadyAnswered: 0,
    autoPublished: 0,
    proposedToClient: 0,
    errors: [],
    details: [],
  };

  for (const review of reviews) {
    if (review.reviewReply) {
      result.newAlreadyAnswered++;
      result.details.push({
        reviewId: review.reviewId,
        rating: review.starRating,
        reviewer: review.reviewer.displayName,
        action: "skipped_already_answered",
      });
      continue;
    }

    // Emitir review_in (idempotente por reviewName).
    try {
      await logEvent(tenantId, {
        id: makeEventId("review_in", review.name),
        ts: review.createTime,
        type: "review_in",
        channel: "rocio",
        meta: { rating: review.starRating, sector: undefined },
      });
    } catch { /* noop */ }

    // Generar borrador.
    const gen = await generateReviewReply(tenantId, review);
    if (!("ok" in gen) || !gen.ok) {
      const detail = "ok" in gen ? "" : (gen as { detail?: string }).detail || "";
      result.errors.push(`Generar respuesta ${review.reviewId}: ${detail}`);
      result.details.push({
        reviewId: review.reviewId,
        rating: review.starRating,
        reviewer: review.reviewer.displayName,
        action: "error",
        detail,
      });
      continue;
    }
    const draft = (gen as { ok: true; reply: string }).reply;

    // ¿Auto-reply?
    if (shouldAutoReply(review)) {
      const r = await replyToReview(opts.userEmail, opts.redirectUri, review.name, draft);
      if (r.ok) {
        result.autoPublished++;
        try {
          await logEvent(tenantId, {
            id: makeEventId("review_replied", review.name),
            type: "review_replied",
            channel: "rocio",
            meta: { rating: review.starRating, auto: true },
          });
        } catch { /* noop */ }
        result.details.push({
          reviewId: review.reviewId,
          rating: review.starRating,
          reviewer: review.reviewer.displayName,
          action: "auto_replied",
          detail: draft,
        });
        continue;
      }
      result.errors.push(`Auto reply ${review.reviewId}: ${r.reason}`);
    }

    // Proposal al cliente.
    if (!opts.recipientWhatsapp) {
      result.errors.push(`Reseña ${review.reviewId} sin WhatsApp del cliente — no se envía.`);
      result.details.push({
        reviewId: review.reviewId,
        rating: review.starRating,
        reviewer: review.reviewer.displayName,
        action: "error",
        detail: "Falta WhatsApp del cliente.",
      });
      continue;
    }
    const proposal = await createRocioProposal({
      tenantId,
      recipientWhatsapp: opts.recipientWhatsapp,
      reviewName: review.name,
      reviewerName: review.reviewer.displayName,
      rating: review.starRating,
      reviewText: review.comment,
      draftReply: draft,
    });

    const txt = formatProposalForWhatsapp(review, draft);
    const send = await sendWhatsAppText(opts.recipientWhatsapp, txt);
    if (!send.ok) {
      result.errors.push(`Enviar WhatsApp ${review.reviewId}: ${send.reason}: ${send.detail}`);
      result.details.push({
        reviewId: review.reviewId,
        rating: review.starRating,
        reviewer: review.reviewer.displayName,
        action: "error",
        detail: send.detail,
      });
      continue;
    }
    result.proposedToClient++;
    result.details.push({
      reviewId: review.reviewId,
      rating: review.starRating,
      reviewer: review.reviewer.displayName,
      action: "proposed",
      detail: `prop ${proposal.id}`,
    });
  }
  return result;
}

function formatProposalForWhatsapp(review: GbpReview, draftReply: string): string {
  const stars = "⭐".repeat(review.starRating);
  return (
    `Reseña nueva en Google ${stars}\n` +
    `De: ${review.reviewer.displayName}\n` +
    (review.comment ? `"${review.comment.slice(0, 600)}"\n\n` : `(sin texto, solo estrellas)\n\n`) +
    `Te propongo responder:\n\n"${draftReply}"\n\n` +
    `¿La publico? Responde OK para publicar o dime qué cambiar.`
  );
}

/**
 * Atajo: ¿este usuario tiene Rocío "live"? (= tokens GBP + tenant existe).
 * Modo MOCK también cuenta como live para que la UI muestre el panel funcional.
 */
export async function isRocioLive(userEmail: string): Promise<boolean> {
  const t = await getGbpTokens(userEmail);
  if (t) return true;
  return (process.env.ROCIO_USE_MOCK || "").toLowerCase() === "true";
}

export async function resolveTenantForRocio(): Promise<string> {
  await getTenant(DEFAULT_TENANT_ID); // asegura seed
  // En multi-tenant: resolver por userEmail. Single-tenant en beta.
  return DEFAULT_TENANT_ID;
}

void resolveTenantFromMeta;
