import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getLuciaProfile, upsertLuciaProfile } from "@/lib/lucia-profile";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getLuciaProfile(s.email);
  return NextResponse.json({ profile });
}

const schema = z.object({
  nombre_persona: z.string().min(1).max(120).optional(),
  cargo: z.string().max(120).optional(),
  empresa: z.string().max(120).optional(),
  firma: z.string().max(500).optional(),
  tono_marca: z.string().max(200).optional(),
  reglas_custom: z.string().max(1500).optional(),
  idiomas: z.string().max(80).optional(),
  modo_activacion: z.enum(["drafts", "auto"]).optional(),
});

export async function PUT(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const profile = await upsertLuciaProfile(s.email, parsed.data);
    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
