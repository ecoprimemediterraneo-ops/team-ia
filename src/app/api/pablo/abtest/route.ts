import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { generateAbVariants, saveAbTest, listAbTests, resolveAbTest } from "@/lib/pablo-analytics";
import { getPabloProfile } from "@/lib/pablo-profile";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const createSchema = z.object({ tema: z.string().min(3).max(500), intent: z.string().min(1).max(48) });
const resolveSchema = z.object({ action: z.literal("resolve"), id: z.string().uuid(), winner: z.enum(["A", "B", "C"]) });

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listAbTests(s.email);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "pablo-ab", ip: getClientIp(req), limit: 10, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json();
  if (body.action === "resolve") {
    const c = resolveSchema.safeParse(body);
    if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
    await resolveAbTest(c.data.id, s.email, c.data.winner);
    return NextResponse.json({ ok: true });
  }
  const c = createSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  const profile = await getPabloProfile(s.email);
  if (!profile.nombre_negocio) return NextResponse.json({ error: "Configura el editor de Pablo primero" }, { status: 400 });
  const variantes = await generateAbVariants({ tema: c.data.tema, intent: c.data.intent, profile });
  if (variantes.length === 0) return NextResponse.json({ error: "No se generaron variantes" }, { status: 500 });
  const saved = await saveAbTest({ owner_email: s.email, intent: c.data.intent, tema: c.data.tema, variantes });
  return NextResponse.json({ test: saved });
}
