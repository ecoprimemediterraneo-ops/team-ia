/**
 * POST /api/marta/approve
 *   body: { id, customText?: string }
 * Aprueba una respuesta pendiente. Si customText viene, lo usa en lugar de la propuesta.
 * Envía el DM a Instagram, registra en marta_ig_messages, sube contador.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getPendingById, updatePendingStatus } from "@/lib/marta-pending";
import { incrementApprovalCounter } from "@/lib/marta-profile";
import { sendIgDm } from "@/lib/marta-ig-meta";
import { insertMessage } from "@/lib/marta-ig-db";
import { canSendIgMessage } from "@/lib/marta-ig-ratelimit";

const schema = z.object({
  id: z.string().uuid(),
  customText: z.string().min(1).max(800).optional(),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const pending = await getPendingById(parsed.data.id, s.email);
  if (!pending) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (pending.status !== "pending") {
    return NextResponse.json({ error: "Ya procesado" }, { status: 409 });
  }

  const finalText = parsed.data.customText?.trim() || pending.proposed_response;
  const wasEdited = !!parsed.data.customText && parsed.data.customText !== pending.proposed_response;

  // Rate limit antes de enviar
  const rl = canSendIgMessage(pending.ig_user_id);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit IG: espera ${Math.ceil((rl.waitMs ?? 0) / 1000)}s` },
      { status: 429 },
    );
  }

  // Enviar a Instagram (si hay token Meta)
  const sent = await sendIgDm(pending.ig_user_id, finalText);

  // Loguear en historial de la conversación
  await insertMessage({
    conversation_id: pending.conversation_id,
    direction: "out",
    message_type: "dm",
    content: finalText,
    media_url: null,
    intent: pending.intent,
    confidence: pending.confidence,
    reasoning: wasEdited ? "Aprobado con edición humana" : "Aprobado tal cual",
    responded_by: "human",
    meta_message_id: sent.ok ? (sent.messageId ?? null) : null,
  });

  // Actualizar estado del pending
  await updatePendingStatus(pending.id, {
    status: sent.ok ? "sent" : "approved",
    approved_text: wasEdited ? finalText : null,
    approved_at: new Date().toISOString(),
    approved_by: s.email,
    meta_message_id: sent.ok ? (sent.messageId ?? null) : null,
  });

  // Contadores: si edita = rechazo (la propuesta no servía tal cual). Si aprueba tal cual = aprobación.
  await incrementApprovalCounter(s.email, wasEdited ? "rechazo" : "aprobacion");

  return NextResponse.json({
    ok: true,
    sent: sent.ok,
    sentReason: sent.ok ? null : sent.reason,
    edited: wasEdited,
  });
}
