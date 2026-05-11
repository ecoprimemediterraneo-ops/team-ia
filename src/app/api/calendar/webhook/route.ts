/**
 * Webhook receptor de Cal.com / Google Calendar.
 * Recibe eventos de cita creada/cancelada/reagendada y dispara acciones:
 *  - Notificar al cliente (mail al founder + log)
 *  - Mandar recordatorio al paciente (vía Resend o WhatsApp template)
 *  - Pedir confirmación 24h antes (cron en otra ruta)
 *
 * Configurar en Cal.com → Webhooks → Add new:
 *  - URL: https://aiteam.marketing/api/calendar/webhook
 *  - Triggers: BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED
 *  - Secret: el que pongas en CALCOM_WEBHOOK_SECRET
 */

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { Resend } from "resend";
import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = process.env.VERCEL ? "/tmp/aiteam-data" : path.join(process.cwd(), "data");
const BOOKINGS_FILE = path.join(DATA_DIR, "calendar-bookings.json");

type Booking = {
  uid: string;
  trigger: string;
  receivedAt: string;
  payload: Record<string, unknown>;
};

async function appendBooking(b: Booking) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  let arr: Booking[] = [];
  try {
    arr = JSON.parse(await fs.readFile(BOOKINGS_FILE, "utf-8"));
  } catch { /* first time */ }
  arr.push(b);
  await fs.writeFile(BOOKINGS_FILE, JSON.stringify(arr, null, 2));
}

function verifyCalcomSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (!secret || !signature) return !secret; // si no hay secret configurado, aceptar
  const computed = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return computed === signature;
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const sig = req.headers.get("x-cal-signature-256");
    if (!verifyCalcomSignature(raw, sig)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(raw);
    const trigger = body.triggerEvent || body.type || "UNKNOWN";
    const payload = body.payload || body;

    await appendBooking({
      uid: payload.uid || payload.id || crypto.randomUUID(),
      trigger,
      receivedAt: new Date().toISOString(),
      payload,
    });

    // Notificar al founder
    const apiKey = process.env.RESEND_API_KEY;
    const founder = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
    const from = process.env.RESEND_FROM || "AI-Team <onboarding@resend.dev>";

    if (apiKey) {
      const resend = new Resend(apiKey);
      const attendee = payload.attendees?.[0] || {};
      const startTime = payload.startTime || payload.start || "";
      try {
        await resend.emails.send({
          from,
          to: founder,
          subject: `📅 ${trigger}: ${attendee.name || "Sin nombre"} — ${startTime}`,
          html: `<div style="font-family:monospace;padding:16px">
            <h2>${trigger}</h2>
            <ul>
              <li><b>Paciente:</b> ${attendee.name || "?"}</li>
              <li><b>Email:</b> ${attendee.email || "?"}</li>
              <li><b>Cuándo:</b> ${startTime}</li>
              <li><b>Tipo:</b> ${payload.type || payload.eventType?.title || "?"}</li>
              <li><b>Notas:</b> ${payload.responses?.notes || payload.description || "—"}</li>
            </ul>
            <p style="margin-top:16px;color:#888">Recuerda confirmarlo en tu software dental (Gesden / Clinic Cloud / etc).</p>
          </div>`,
        });
      } catch { /* no critical */ }
    }

    return NextResponse.json({ ok: true, trigger });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const arr = JSON.parse(await fs.readFile(BOOKINGS_FILE, "utf-8")) as Booking[];
    return NextResponse.json({ total: arr.length, bookings: arr.slice(-20) });
  } catch {
    return NextResponse.json({ total: 0, bookings: [] });
  }
}
