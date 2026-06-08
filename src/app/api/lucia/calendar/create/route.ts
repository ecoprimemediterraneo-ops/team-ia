// POST /api/lucia/calendar/create
// Body JSON: { nombre, motivo, start, end?, durationMin?, agenteOrigen?,
//              attendees?, location?, customerPhone? }
//
// Crea la cita usando agendarCita() y deja registro en el event-log.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { getRedirectUri } from "@/lib/gmail";
import { agendarCita } from "@/lib/calendar";
import type { EventChannel } from "@/lib/event-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const body = (await req.json().catch(() => ({}))) as {
      nombre?: string;
      motivo?: string;
      start?: string;
      end?: string;
      durationMin?: number;
      agenteOrigen?: EventChannel;
      attendees?: string[];
      location?: string;
      customerPhone?: string;
    };

    if (!body.nombre?.trim() || !body.motivo?.trim() || !body.start?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos: nombre, motivo y start son obligatorios." },
        { status: 400 },
      );
    }

    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const redirectUri = getRedirectUri(host, proto);

    const result = await agendarCita({
      userEmail: email,
      nombre: body.nombre.trim(),
      motivo: body.motivo.trim(),
      start: body.start,
      end: body.end,
      durationMin: body.durationMin,
      agenteOrigen: body.agenteOrigen || "lucia",
      attendees: body.attendees,
      location: body.location,
      customerPhone: body.customerPhone,
      redirectUri,
    });

    if (!result.ok) {
      const status = result.reason === "no_tokens" ? 401 : result.reason === "invalid_input" ? 400 : 500;
      return NextResponse.json({ ok: false, error: result.detail, reason: result.reason }, { status });
    }
    return NextResponse.json({ ok: true, eventId: result.eventId, htmlLink: result.htmlLink, eventLogId: result.eventLogId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
