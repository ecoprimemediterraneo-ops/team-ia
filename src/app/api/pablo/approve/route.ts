import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getPabloPendingById, updatePabloPendingStatus } from "@/lib/pablo-pending";
import { incrementPabloCounter } from "@/lib/pablo-profile";
import { sendWaText } from "@/lib/pablo-wa-meta";
import { insertWaMessage } from "@/lib/pablo-wa-db";

const schema = z.object({
  id: z.string().uuid(),
  customText: z.string().min(1).max(800).optional(),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const pending = await getPabloPendingById(parsed.data.id, s.email);
  if (!pending) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (pending.status !== "pending") return NextResponse.json({ error: "Ya procesado" }, { status: 409 });

  const finalText = parsed.data.customText?.trim() || pending.proposed_response;
  const wasEdited = !!parsed.data.customText && parsed.data.customText !== pending.proposed_response;

  const sent = await sendWaText(pending.wa_phone_number, finalText);

  await insertWaMessage({
    conversation_id: pending.conversation_id,
    direction: "out",
    content: finalText,
    intent: pending.intent,
    confidence: pending.confidence,
    reasoning: wasEdited ? "Aprobado con edición humana" : "Aprobado tal cual",
    responded_by: "human",
    wa_message_id: sent.ok ? (sent.messageId ?? null) : null,
  });

  await updatePabloPendingStatus(pending.id, {
    status: sent.ok ? "sent" : "approved",
    approved_text: wasEdited ? finalText : null,
    approved_at: new Date().toISOString(),
    approved_by: s.email,
    wa_message_id: sent.ok ? (sent.messageId ?? null) : null,
  });

  await incrementPabloCounter(s.email, wasEdited ? "rechazo" : "aprobacion");

  return NextResponse.json({ ok: true, sent: sent.ok, sentReason: sent.ok ? null : sent.reason, edited: wasEdited });
}
