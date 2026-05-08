import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getContacts, addContact, removeContact } from "@/lib/store";

const addSchema = z.object({
  email: z.string().email("Email no válido"),
  name: z.string().max(80).optional(),
});

export async function GET() {
  try {
    const { email } = await requireSession();
    const contacts = await getContacts(email);
    return NextResponse.json({ contacts });
  } catch {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const body = await req.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    await addContact(email, parsed.data);
    const contacts = await getContacts(email);
    return NextResponse.json({ ok: true, contacts });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { email } = await requireSession();
    const { searchParams } = new URL(req.url);
    const target = searchParams.get("email");
    if (!target) return NextResponse.json({ error: "Falta email" }, { status: 400 });
    await removeContact(email, target);
    const contacts = await getContacts(email);
    return NextResponse.json({ ok: true, contacts });
  } catch {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }
}
