import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByWidgetToken, addContact, logActivity, bumpStats } from "@/lib/store";
import { getResend, RESEND_FROM } from "@/lib/resend";

const schema = z.object({
  email: z.string().email("Email no válido"),
  name: z.string().max(80).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  hp: z.string().max(0).optional(), // honeypot debe ir vacío
});

function htmlFromText(text: string, businessName: string) {
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = safe
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:Inter,system-ui,sans-serif;line-height:1.55;color:#0c0c0c;max-width:560px;padding:24px">${paragraphs}<hr style="margin:28px 0;border:none;border-top:1px solid #e5e5e5"/><p style="font-size:11px;color:#888">${businessName} · enviado vía AI-Team</p></div>`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const user = await findUserByWidgetToken(token);
    if (!user || !user.widget?.enabled) {
      return NextResponse.json({ error: "Formulario no disponible" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    if (parsed.data.hp) {
      // honeypot disparado, fingimos éxito
      return NextResponse.json({ ok: true });
    }

    const contactName = parsed.data.name?.trim() || undefined;
    const contactPhone = parsed.data.phone?.trim();
    const fullName = contactPhone ? `${contactName || "Sin nombre"} · ${contactPhone}` : contactName;

    await addContact(user.email, {
      email: parsed.data.email,
      name: fullName,
    });
    await logActivity(user.email, {
      type: "lead_captured",
      detail: `${fullName || parsed.data.email}`,
    });

    // Enviar welcome email si está configurado y hay key Resend
    if (user.widget.welcomeEmailEnabled && process.env.RESEND_API_KEY) {
      try {
        const resend = getResend();
        const businessName = user.business?.nombre || "AI-Team";
        const from = RESEND_FROM.replace(/^[^<]+/, `${businessName} `);
        await resend.emails.send({
          from,
          to: parsed.data.email,
          subject: user.widget.welcomeSubject,
          html: htmlFromText(user.widget.welcomeBody, businessName),
        });
        await bumpStats(user.email, { emailsSent: 1 });
      } catch (e) {
        console.error("welcome email failed", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
