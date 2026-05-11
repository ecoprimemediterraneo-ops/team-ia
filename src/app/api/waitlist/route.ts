import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import fs from "node:fs/promises";
import path from "node:path";

const schema = z.object({
  email: z.string().email("Email no válido"),
  name: z.string().max(80).optional(),
  sector: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
});

// Misma lógica de path que store: /tmp en Vercel, ./data en local
const DATA_DIR = process.env.VERCEL ? "/tmp/aiteam-data" : path.join(process.cwd(), "data");
const WAITLIST_FILE = path.join(DATA_DIR, "waitlist.json");

type Entry = {
  email: string;
  name?: string;
  sector?: string;
  city?: string;
  createdAt: string;
};

async function readWaitlist(): Promise<Entry[]> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(WAITLIST_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeWaitlist(entries: Entry[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(WAITLIST_FILE, JSON.stringify(entries, null, 2));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { email, name, sector, city } = parsed.data;

    // 1. Guardar en waitlist (JSON)
    const entries = await readWaitlist();
    if (!entries.find((e) => e.email === email)) {
      entries.push({ email, name, sector, city, createdAt: new Date().toISOString() });
      await writeWaitlist(entries);
    }

    // 2. Mandar email de bienvenida + notificarme a mí (founder)
    const apiKey = process.env.RESEND_API_KEY;
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    const from = process.env.RESEND_FROM || "AI-Team <onboarding@resend.dev>";
    const founderEmail = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

    if (apiKey) {
      const resend = new Resend(apiKey);
      if (audienceId) {
        try {
          await resend.contacts.create({
            email,
            firstName: name,
            audienceId,
            unsubscribed: false,
          });
        } catch { /* ignore duplicates */ }
      }

      // Email al lead
      await resend.emails.send({
        from,
        to: email,
        subject: "Estás dentro de AI-Team 🎉",
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#FAF8F3;border:3px solid #000">
          <h1 style="font-family:Impact,Arial,sans-serif;font-size:38px;text-transform:uppercase;margin:0 0 12px;color:#C8202A">Bienvenido${name ? ", " + name : ""}</h1>
          <p style="font-size:16px;line-height:1.5">Acabas de reservar tu plaza fundadora en <b>AI-Team</b>.</p>
          <p style="font-size:16px;line-height:1.5">Pablo, Lucía, Eva, Rocío, Marta y Carmen están preparándose. Te avisamos en cuanto abramos tu plaza.</p>
          <p style="font-size:14px;line-height:1.5;color:#555;margin-top:24px;border-top:2px solid #000;padding-top:16px">
            Mientras tanto, échale un vistazo al equipo:<br>
            <a href="https://aiteam.marketing" style="color:#C8202A;font-weight:bold">aiteam.marketing</a>
          </p>
          <p style="font-size:13px;color:#888;margin-top:24px">— Equipo AI-Team · Hecho desde España, para todo el mundo hispano</p>
        </div>`,
      });

      // Email a mí (founder) con los datos
      try {
        await resend.emails.send({
          from,
          to: founderEmail,
          subject: `🆕 Nueva plaza fundadora: ${name || email} (${sector || "?"})`,
          html: `<div style="font-family:monospace;padding:16px">
            <h2>Nuevo registro AI-Team</h2>
            <ul>
              <li><b>Nombre:</b> ${name || "(no dio)"}</li>
              <li><b>Email:</b> ${email}</li>
              <li><b>Sector:</b> ${sector || "?"}</li>
              <li><b>Ciudad:</b> ${city || "?"}</li>
              <li><b>Fecha:</b> ${new Date().toLocaleString("es-ES")}</li>
            </ul>
            <p>Total en lista: ${entries.length}</p>
          </div>`,
        });
      } catch { /* no critical */ }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

// GET para que veas cuántos hay en lista
export async function GET() {
  try {
    const entries = await readWaitlist();
    return NextResponse.json({ total: entries.length, entries });
  } catch {
    return NextResponse.json({ total: 0, entries: [] });
  }
}
