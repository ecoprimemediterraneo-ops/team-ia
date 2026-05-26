/**
 * POST /api/rocio/approve
 *   body: { id, customText? }
 * Aprueba una respuesta. Marca la review como "responded" y la pending como "approved".
 * Cuando llegue GBP API, aquí también haremos POST a Google.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getRocioPending, updateRocioPendingStatus, setReviewStatus } from "@/lib/rocio-db";
import { incrementRocioCounter } from "@/lib/rocio-profile";

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

  const pending = await getRocioPending(parsed.data.id, s.email);
  if (!pending) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (pending.status !== "pending") return NextResponse.json({ error: "Ya procesado" }, { status: 409 });

  const finalText = parsed.data.customText?.trim() || pending.proposed_response;
  const wasEdited = !!parsed.data.customText && parsed.data.customText !== pending.proposed_response;

  await updateRocioPendingStatus(pending.id, {
    status: "approved",
    approved_text: wasEdited ? finalText : null,
    approved_at: new Date().toISOString(),
    approved_by: s.email,
  });

  await setReviewStatus(pending.review_id, "responded");

  await incrementRocioCounter(s.email, wasEdited ? "rechazo" : "aprobacion");

  // TODO cuando llegue Google Business Profile API: POST a Google con finalText
  return NextResponse.json({
    ok: true,
    edited: wasEdited,
    pasteText: finalText,
    note: "Copia este texto y pégalo en Google Maps. Auto-publicación llegará con Google Business Profile API.",
  });
}
