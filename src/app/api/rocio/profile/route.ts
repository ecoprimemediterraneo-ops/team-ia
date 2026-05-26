import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getRocioProfile, upsertRocioProfile } from "@/lib/rocio-profile";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getRocioProfile(s.email);
  return NextResponse.json({ profile });
}

const updateSchema = z.object({
  nombre_negocio: z.string().min(1).max(120).optional(),
  tono_marca: z.string().max(200).optional(),
  firma_respuesta: z.string().max(120).optional(),
  reglas_custom: z.string().max(1500).optional(),
  modo_activacion: z.enum(["ruedines", "auto"]).optional(),
});

export async function PUT(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const profile = await upsertRocioProfile(s.email, parsed.data);
    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
