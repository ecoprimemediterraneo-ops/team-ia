import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getContacts, getUser } from "@/lib/store";
import { getResend, RESEND_FROM } from "@/lib/resend";

const schema = z.object({
  subject: z.string().min(1, "Falta asunto").max(150),
  body: z.string().min(1, "Falta cuerpo").max(20000),
  // "all" = a toda la lista de contactos. Array = a esos emails sueltos.
  to: z.union([z.literal("all"), z.array(z.string().email()).min(1)]),
});

function bodyToHtml(text: string) {
  // Si parece HTML (tiene tags), lo dejamos. Si no, párrafos simples.
  if (/<[a-z][^>]*>/i.test(text)) return text;
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = safe
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:Inter,system-ui,sans-serif;line-height:1.55;color:#0c0c0c;max-width:560px;padding:24px">${paragraphs}<hr style="margin:28px 0;border:none;border-top:1px solid #e5e5e5"/><p style="font-size:11px;color:#888">Enviado por Eva · AI-Team</p></div>`;
}

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const user = await getUser(email);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    let recipients: string[];
    if (parsed.data.to === "all") {
      const contacts = await getContacts(email);
      if (contacts.length === 0) {
        return NextResponse.json({ error: "Tu lista de contactos está vacía. Añade al menos uno." }, { status: 400 });
      }
      recipients = contacts.map((c) => c.email);
    } else {
      recipients = parsed.data.to;
    }

    const resend = getResend();
    const fromName = user.business?.nombre || "AI-Team";
    const from = RESEND_FROM.replace(/^[^<]+/, `${fromName} `);

    const results: { to: string; id?: string; error?: string }[] = [];
    for (const to of recipients) {
      try {
        const r = await resend.emails.send({
          from,
          to,
          subject: parsed.data.subject,
          html: bodyToHtml(parsed.data.body),
        });
        results.push({ to, id: r.data?.id });
      } catch (err) {
        results.push({ to, error: err instanceof Error ? err.message : "Error" });
      }
    }

    const sent = results.filter((r) => r.id).length;
    const failed = results.length - sent;
    return NextResponse.json({ ok: true, sent, failed, results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
