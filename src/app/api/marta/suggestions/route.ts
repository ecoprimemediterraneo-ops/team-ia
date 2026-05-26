/**
 * GET  /api/marta/suggestions          — lista sugerencias pendientes del cliente
 * POST /api/marta/suggestions
 *   body: { id, action: "accept" | "reject" | "dismiss" }
 *   accept → añade la regla a reglas_custom del perfil y marca aceptada
 *   reject → marca rechazada (Claude no lo volverá a sugerir si insiste)
 *   dismiss → "ahora no", se puede volver a evaluar después
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listSuggestions, updateSuggestionStatus } from "@/lib/marta-learning";
import { getMartaProfile, upsertMartaProfile } from "@/lib/marta-profile";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const suggestions = await listSuggestions(s.email, "pending");
  return NextResponse.json({ suggestions });
}

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(["accept", "reject", "dismiss"]),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const statusMap = {
    accept: "accepted" as const,
    reject: "rejected" as const,
    dismiss: "dismissed" as const,
  };

  const updated = await updateSuggestionStatus(parsed.data.id, s.email, statusMap[parsed.data.action]);
  if (!updated) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Si acepta, añadir la regla al perfil
  if (parsed.data.action === "accept") {
    const profile = await getMartaProfile(s.email);
    const newRules = profile.reglas_custom
      ? `${profile.reglas_custom}\n· ${updated.rule_text}`
      : `· ${updated.rule_text}`;
    await upsertMartaProfile(s.email, { reglas_custom: newRules });
  }

  return NextResponse.json({ ok: true });
}
