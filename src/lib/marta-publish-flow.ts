// =============================================================================
// Publicación de una propuesta de Marta en Instagram — lógica COMPARTIDA.
// =============================================================================
//
// La usan tanto el webhook de Pablo (aprobación por WhatsApp) como el panel de
// la app (aprobación in-app). Hace: publicar en IG, recuperar el permalink,
// marcar la propuesta publicada, enlazar el calendario si aplica y cerrar la
// sesión de ruteo del número. Devuelve un resultado tipado; quien la llama se
// encarga de avisar al usuario (WhatsApp o UI).
// =============================================================================

import "server-only";
import { publishToInstagram } from "./marta-publish";
import { markProposalPublished, type MartaProposal } from "./marta-proposals";
import { findEntryByProposalId, markCalendarEntryPublished } from "./marta-calendar";
import { closeRoute } from "./wa-route";

export type PublishFlowResult =
  | { ok: true; igMediaId: string; permalink?: string }
  | { ok: false; kind: "disabled"; detail: string }   // MARTA_PUBLISH_ENABLED != true
  | { ok: false; kind: "error"; detail: string };

export async function publishProposal(proposal: MartaProposal): Promise<PublishFlowResult> {
  const pub = await publishToInstagram({
    mediaType: proposal.mediaType,
    mediaUrl: proposal.imageUrl,
    caption: proposal.caption,
  });

  if ("ok" in pub && pub.ok) {
    let permalink: string | undefined;
    try {
      const tk = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
      if (tk) {
        const r = await fetch(
          `https://graph.facebook.com/v21.0/${pub.igMediaId}?fields=permalink`,
          { headers: { Authorization: `Bearer ${tk}` } },
        );
        if (r.ok) {
          const j = (await r.json()) as { permalink?: string };
          permalink = j.permalink;
        }
      }
    } catch { /* noop */ }

    await markProposalPublished(proposal, pub.igMediaId, permalink);
    // Si la propuesta venía de una entrada del calendario, márcala publicada.
    try {
      const calEntry = await findEntryByProposalId(proposal.tenantId, proposal.id);
      if (calEntry) await markCalendarEntryPublished(proposal.tenantId, calEntry.id, pub.igMediaId);
    } catch { /* noop */ }
    // Cierra la sesión de ruteo (si la había). Inocuo si el número está vacío.
    if (proposal.recipientWhatsapp) await closeRoute(proposal.recipientWhatsapp);

    return { ok: true, igMediaId: pub.igMediaId, permalink };
  }

  if ("skipped" in pub && pub.skipped) {
    return { ok: false, kind: "disabled", detail: pub.detail };
  }

  const detail = "detail" in pub ? pub.detail : "error desconocido";
  return { ok: false, kind: "error", detail };
}
