import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createDraft, getRedirectUri } from "@/lib/gmail";

const schema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const draft = await createDraft(email, getRedirectUri(host, proto), parsed.data);
    if (!draft) return NextResponse.json({ error: "No se pudo guardar el borrador. ¿Gmail conectado?" }, { status: 400 });

    return NextResponse.json({ ok: true, draftId: draft.draftId });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
