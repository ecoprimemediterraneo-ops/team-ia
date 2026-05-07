import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import fs from "node:fs/promises";
import path from "node:path";

const schema = z.object({
  email: z.string().email("Email no válido"),
  name: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { email, name } = parsed.data;

    const apiKey = process.env.RESEND_API_KEY;
    const audienceId = process.env.RESEND_AUDIENCE_ID;

    if (apiKey) {
      const resend = new Resend(apiKey);
      if (audienceId) {
        await resend.contacts.create({
          email,
          firstName: name,
          audienceId,
          unsubscribed: false,
        });
      }
      await resend.emails.send({
        from: process.env.RESEND_FROM || "Tropa <onboarding@resend.dev>",
        to: email,
        subject: "Estás dentro de la Tropa 🎉",
        html: `<div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:24px;background:#FAF8F3;border:3px solid #000">
          <h1 style="font-family:Impact,sans-serif;font-size:38px;text-transform:uppercase;margin:0 0 12px">Bienvenido${name ? ", " + name : ""}</h1>
          <p>Acabas de reservar tu plaza fundadora en <b>Tropa</b>.</p>
          <p>Lucía, Marta, Diego y Carmen están terminando de prepararse. Te avisamos en cuanto abramos.</p>
          <p style="margin-top:24px;font-size:13px;color:#555">— Equipo Tropa</p>
        </div>`,
      });
    } else {
      const file = path.join(process.cwd(), "waitlist.local.txt");
      await fs.appendFile(file, `${new Date().toISOString()}\t${email}\t${name || ""}\n`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
