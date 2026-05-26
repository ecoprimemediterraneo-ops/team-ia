import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { generateAbVariants, saveAbTest, listAbTests, resolveAbTest, deleteAbTest } from "@/lib/marta-abtest";
import { getMartaProfile } from "@/lib/marta-profile";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const createSchema = z.object({
  tema: z.string().min(3).max(300),
});
const resolveSchema = z.object({
  action: z.literal("resolve"),
  id: z.string().uuid(),
  winner: z.enum(["A", "B", "C"]),
  metricas: z.record(z.string(), z.number()).optional(),
});
const deleteSchema = z.object({
  action: z.literal("delete"),
  id: z.string().uuid(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tests = await listAbTests(s.email);
  return NextResponse.json({ tests });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: "marta-abtest", ip: getClientIp(req), limit: 15, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json();
  try {
    if (body.action === "resolve") {
      const p = resolveSchema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 });
      await resolveAbTest(p.data.id, s.email, p.data.winner, p.data.metricas || {});
      return NextResponse.json({ ok: true });
    }
    if (body.action === "delete") {
      const p = deleteSchema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 });
      await deleteAbTest(p.data.id, s.email);
      return NextResponse.json({ ok: true });
    }

    const c = createSchema.safeParse(body);
    if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });

    const profile = await getMartaProfile(s.email);
    if (!profile.nombre_negocio) {
      return NextResponse.json({ error: "Configura primero el editor de Marta" }, { status: 400 });
    }
    const variantes = await generateAbVariants({ tema: c.data.tema, profile });
    if (variantes.length === 0) return NextResponse.json({ error: "No se pudieron generar variantes" }, { status: 500 });
    const test = await saveAbTest({ owner_email: s.email, tema: c.data.tema, variantes });
    return NextResponse.json({ test });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
