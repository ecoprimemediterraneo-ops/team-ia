import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getPabloProfile, upsertPabloProfile } from "@/lib/pablo-profile";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getPabloProfile(s.email);
  return NextResponse.json({ profile });
}

const schema = z.object({
  nombre_negocio: z.string().min(1).max(120).optional(),
  sector: z.string().max(80).optional(),
  horario: z.string().max(200).optional(),
  servicios_destacados: z.string().max(800).optional(),
  tono_marca: z.string().max(200).optional(),
  reglas_custom: z.string().max(1500).optional(),
  saludo_inicial: z.string().max(400).optional(),
  modo_activacion: z.enum(["ruedines", "auto"]).optional(),
});

export async function PUT(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const profile = await upsertPabloProfile(s.email, parsed.data);
    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
