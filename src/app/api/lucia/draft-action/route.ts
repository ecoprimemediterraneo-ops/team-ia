/**
 * POST /api/lucia/draft-action
 *   body: { id, action: "sent"|"edited"|"rejected", editedText? }
 * El cliente marca qué hizo con el borrador. Lo guardamos para aprendizaje.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getLuciaDraftById, updateLuciaDraftStatus } from "@/lib/lucia-db";
import { incrementLuciaCounter } from "@/lib/lucia-profile";

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(["sent", "edited", "rejected"]),
  editedText: z.string().min(1).max(5000).optional(),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const draft = await getLuciaDraftById(parsed.data.id, s.email);
  if (!draft) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await updateLuciaDraftStatus(parsed.data.id, {
    status: parsed.data.action,
    edited_text: parsed.data.editedText ?? null,
    acted_at: new Date().toISOString(),
  });

  // Contadores: "sent" tal cual = aprobacion. "edited" = rechazo de la propuesta. "rejected" = rechazo.
  if (parsed.data.action === "sent") await incrementLuciaCounter(s.email, "aprobacion");
  else await incrementLuciaCounter(s.email, "rechazo");

  return NextResponse.json({ ok: true });
}
