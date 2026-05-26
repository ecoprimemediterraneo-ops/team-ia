import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listKeywords, createKeyword, deleteKeyword } from "@/lib/pablo-crm";

const createSchema = z.object({
  keyword: z.string().min(2).max(255),
  accion: z.enum(["escalar", "bloquear_auto", "alerta"]),
  motivo: z.string().max(500).optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listKeywords(s.email);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.action === "delete") {
    if (typeof body.id !== "string") return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await deleteKeyword(body.id, s.email);
    return NextResponse.json({ ok: true });
  }
  const c = createSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  const created = await createKeyword({ owner_email: s.email, ...c.data });
  return NextResponse.json({ keyword: created });
}
