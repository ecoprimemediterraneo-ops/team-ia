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
import { logEvent, makeEventId } from "./event-log";
import { baseGraph } from "./meta-graph-local";

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
        // Mismo candado que el resto: en local no se pregunta a Meta.
        const base = baseGraph();
        const r = base ? await fetch(
          `${base}/${pub.igMediaId}?fields=permalink`,
          { headers: { Authorization: `Bearer ${tk}` } },
        ) : null;
        if (r && r.ok) {
          const j = (await r.json()) as { permalink?: string };
          permalink = j.permalink;
        }
      }
    } catch { /* noop */ }

    await markProposalPublished(proposal, pub.igMediaId, permalink);
    // Si la propuesta venía de una entrada del calendario, márcala publicada.
    let calEntryId: string | undefined;
    try {
      const calEntry = await findEntryByProposalId(proposal.tenantId, proposal.id);
      if (calEntry) {
        calEntryId = calEntry.id;
        await markCalendarEntryPublished(proposal.tenantId, calEntry.id, pub.igMediaId);
      }
    } catch { /* noop */ }

    // Registro para el informe mensual (sección "contenido publicado"). Este es
    // el TERCER camino que publica de verdad, además del cron del calendario y
    // del botón "Publicar ahora" (los dos pasan por marta-auto-publish): aquí
    // llega lo que el cliente aprueba por WhatsApp o desde el panel. Sin esto,
    // el informe contaría de menos.
    //
    // El id usa la entrada del calendario cuando existe — el MISMO id que
    // escribiría marta-auto-publish — así que si alguna vez los dos caminos
    // tocaran el mismo post, el log lo deduplica en vez de contarlo dos veces.
    try {
      await logEvent(proposal.tenantId, {
        id: makeEventId("post_published", proposal.tenantId, calEntryId || proposal.id),
        type: "post_published",
        channel: "marta",
        meta: {
          entryId: calEntryId,
          proposalId: proposal.id,
          igMediaId: pub.igMediaId,
          permalink,
          tema: proposal.tema,
          mediaType: proposal.mediaType,
          imageUrl: proposal.imageUrl,
          caption: proposal.caption.slice(0, 300),
        },
      });
    } catch (err) {
      console.error("[marta-publish-flow] no se pudo registrar post_published:", err);
    }
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
