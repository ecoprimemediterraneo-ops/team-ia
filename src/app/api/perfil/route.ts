import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { saveBusiness } from "@/lib/store";

const schema = z.object({
  nombre: z.string().min(1).max(120),
  sector: z.string().min(1).max(200),
  ofrece: z.string().min(1).max(2000),
  tono: z.string().min(1).max(1000),
  publico: z.string().min(1).max(1000),
});

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    await saveBusiness(email, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
