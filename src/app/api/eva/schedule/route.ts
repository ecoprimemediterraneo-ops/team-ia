import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { addScheduledEmail, listScheduledEmails, deleteScheduledEmail } from "@/lib/store";

const schema = z.object({
  to: z.string(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  scheduledFor: z.string().min(1), // ISO
});

export async function GET() {
  try {
    const { email } = await requireSession();
    const list = await listScheduledEmails(email);
    return NextResponse.json({ scheduled: list });
  } catch {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const when = new Date(parsed.data.scheduledFor);
    if (isNaN(when.getTime()) || when.getTime() < Date.now()) {
      return NextResponse.json({ error: "La fecha debe estar en el futuro" }, { status: 400 });
    }
    const s = await addScheduledEmail(email, {
      to: parsed.data.to,
      subject: parsed.data.subject,
      body: parsed.data.body,
      scheduledFor: when.toISOString(),
    });
    return NextResponse.json({ ok: true, scheduled: s });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { email } = await requireSession();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    await deleteScheduledEmail(email, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
