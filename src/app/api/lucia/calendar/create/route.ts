// POST /api/lucia/calendar/create
// Body JSON: { nombre, motivo, start, end?, durationMin?, agenteOrigen?,
//              attendees?, location?, customerPhone? }
//
// Crea la cita PASANDO POR EL ORQUESTADOR (verificación de disponibilidad +
// lock + log de decisión). Antes Lucía reservaba a ciegas; ahora no.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { getRedirectUri } from "@/lib/gmail";
import { reservarSlot } from "@/lib/orchestrator";
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

    // Si se pasa `end`, derivamos la duración en minutos para el orquestador.
    let durationMin = body.durationMin;
    if (!durationMin && body.end) {
      const ms = new Date(body.end).getTime() - new Date(body.start).getTime();
      if (ms > 0) durationMin = Math.round(ms / 60_000);
    }

    const result = await reservarSlot({
      userEmail: email,
      redirectUri,
      nombre: body.nombre.trim(),
      motivo: body.motivo.trim(),
      startIso: body.start,
      durationMin,
      agenteOrigen: body.agenteOrigen || "lucia",
      attendees: body.attendees,
      location: body.location,
      customerPhone: body.customerPhone,
    });

    if (!result.ok) {
      if (result.reason === "slot_taken") {
        return NextResponse.json(
          { ok: false, error: "slot_taken", reason: "slot_taken", suggested: result.suggested },
          { status: 409 },
        );
      }
      if (result.reason === "locked") {
        return NextResponse.json(
          { ok: false, error: "Otro agente está reservando ese hueco ahora mismo. Reintenta en unos segundos.", reason: "locked" },
          { status: 423 },
        );
      }
      return NextResponse.json({ ok: false, error: result.detail, reason: "error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, eventId: result.eventId, htmlLink: result.htmlLink, eventLogId: result.eventLogId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
