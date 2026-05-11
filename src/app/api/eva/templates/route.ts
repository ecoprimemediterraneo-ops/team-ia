import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { listEmailTemplates, saveEmailTemplate, deleteEmailTemplate } from "@/lib/store";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
});

export async function GET() {
  try {
    const { email } = await requireSession();
    const templates = await listEmailTemplates(email);
    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const t = await saveEmailTemplate(email, parsed.data);
    return NextResponse.json({ ok: true, template: t });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { email } = await requireSession();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    await deleteEmailTemplate(email, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
