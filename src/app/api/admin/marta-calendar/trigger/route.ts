// Trigger del calendario de Marta. Llama esto manualmente desde
// /admin/marta-calendario o periódicamente (cron) para que las entradas
// vencidas (status=scheduled, scheduledAt <= now) se envíen al cliente
// para aprobación.
//
// Cada entrada vencida:
//   1. Crea proposal pendiente vía createProposal (B4 store).
//   2. Envía imagen/vídeo + caption por WhatsApp al destinatario configurado
//      en el query param `to` (necesario porque el calendario no almacena
//      número del cliente).
//   3. Manda "¿Lo publico? OK / qué cambiar / descartar."
//   4. Marca la entrada como `proposed` con su proposalId.
//
// La respuesta del cliente se gestiona desde el interceptor de Pablo (B4).

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import {
  dueNow,
  markCalendarEntryProposed,
  markCalendarEntryFailed,
} from "@/lib/marta-calendar";
import { createProposal } from "@/lib/marta-proposals";
import {
  sendWhatsAppImage,
  sendWhatsAppText,
  sendWhatsAppVideo,
} from "@/lib/whatsapp-sender";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false, error: "no_session" }, { status: 403 });
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") {
    return NextResponse.json({ ok: false, error: "not_founder" }, { status: 403 });
  }

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant") || DEFAULT_TENANT_ID;
  const to = (url.searchParams.get("to") || "").replace(/\D/g, "");
  if (!to) {
    return NextResponse.json(
      { ok: false, error: "missing_to", hint: "Pasa ?to=34600111222 con el WhatsApp del cliente." },
      { status: 400 },
    );
  }

  const due = await dueNow(tenantId);
  const processed: unknown[] = [];

  for (const entry of due) {
    try {
      const proposal = await createProposal({
        tenantId,
        recipientWhatsapp: to,
        imageUrl: entry.imageUrl,
        caption: entry.caption,
        mediaType: entry.mediaType,
      });

      const sendMedia =
        entry.mediaType === "REELS"
          ? await sendWhatsAppVideo(to, entry.imageUrl, entry.caption)
          : await sendWhatsAppImage(to, entry.imageUrl, entry.caption);

      if (!sendMedia.ok) {
        await markCalendarEntryFailed(tenantId, entry.id, `${sendMedia.reason}: ${sendMedia.detail}`);
        processed.push({ entryId: entry.id, ok: false, reason: sendMedia.reason });
        continue;
      }
      await sendWhatsAppText(
        to,
        `¿Publico este ${entry.mediaType === "REELS" ? "Reel" : "post"}? Responde OK para publicar o dime qué cambiar (foto, texto o descartar).`,
      );

      await markCalendarEntryProposed(tenantId, entry.id, proposal.id);
      processed.push({ entryId: entry.id, ok: true, proposalId: proposal.id });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      await markCalendarEntryFailed(tenantId, entry.id, detail);
      processed.push({ entryId: entry.id, ok: false, error: detail });
    }
  }

  return NextResponse.json({ ok: true, dueCount: due.length, processed });
}
