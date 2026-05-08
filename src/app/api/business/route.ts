import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { saveBusiness } from "@/lib/store";

const schema = z.object({
  nombre: z.string().min(1).max(80),
  sector: z.string().min(1).max(120),
  ofrece: z.string().min(1).max(400),
  tono: z.string().min(1).max(200),
  publico: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    await saveBusiness(email, parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }
}
