/**
 * POST /api/lucia/sandbox — prueba Lucía con un email ficticio sin tocar Gmail real.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getLuciaProfile } from "@/lib/lucia-profile";
import { classifyEmail, generateLuciaDraft } from "@/lib/lucia-responder";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  from_name: z.string().max(120).optional(),
  from_email: z.string().email().optional(),
  subject: z.string().min(1).max(200),
  body: z.string().min(2).max(5000),
  profileOverride: z.object({
    nombre_persona: z.string().optional(),
    cargo: z.string().optional(),
    empresa: z.string().optional(),
    firma: z.string().optional(),
    tono_marca: z.string().optional(),
    reglas_custom: z.string().optional(),
  }).optional(),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: "lucia-sandbox", ip: getClientIp(req), limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const stored = await getLuciaProfile(s.email);
  const profile = {
    ...stored,
    ...(parsed.data.profileOverride
      ? {
          nombre_persona: parsed.data.profileOverride.nombre_persona ?? stored.nombre_persona,
          cargo: parsed.data.profileOverride.cargo ?? stored.cargo,
          empresa: parsed.data.profileOverride.empresa ?? stored.empresa,
          firma: parsed.data.profileOverride.firma ?? stored.firma,
          tono_marca: parsed.data.profileOverride.tono_marca ?? stored.tono_marca,
          reglas_custom: parsed.data.profileOverride.reglas_custom ?? stored.reglas_custom,
        }
      : {}),
  };

  const ctx = {
    fromName: parsed.data.from_name ?? null,
    fromEmail: parsed.data.from_email ?? null,
    subject: parsed.data.subject,
    body: parsed.data.body,
  };

  const { intent, confidence, reasoning } = await classifyEmail(ctx);

  let respuesta = "";
  if (intent === "spam") respuesta = "(Lucía marcaría este email como spam — NO generaría borrador)";
  else respuesta = await generateLuciaDraft(ctx, profile, intent);

  return NextResponse.json({ intent, confidence, reasoning, respuesta });
}
