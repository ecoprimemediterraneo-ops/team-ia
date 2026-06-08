// GET /api/lucia/calendar/free-busy?from=ISO&to=ISO
// Devuelve los huecos ocupados del calendario "primary" del usuario logueado.
// Para listar SLOTS LIBRES, el cliente resta `busy` a una franja horaria.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { getRedirectUri } from "@/lib/gmail";
import { freeBusyQuery } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { email } = await requireSession();
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json({ ok: false, error: "Faltan from/to (ISO)" }, { status: 400 });
    }
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const redirectUri = getRedirectUri(host, proto);

    const result = await freeBusyQuery(email, redirectUri, from, to);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.detail, reason: result.reason }, { status: result.reason === "no_tokens" ? 401 : 500 });
    }
    return NextResponse.json({ ok: true, busy: result.busy, timezone: result.timezone, range: { from, to } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
