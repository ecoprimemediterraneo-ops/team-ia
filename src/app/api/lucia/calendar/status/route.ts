// GET /api/lucia/calendar/status
// Diagnóstico: devuelve los scopes guardados del token de Gmail/Calendar del
// usuario y si incluye calendar.events (lo que necesita la agenda). Útil para
// verificar tras reconectar sin tener que mirar logs.

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getGmailTokens } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { email } = await requireSession();
    const tokens = await getGmailTokens(email);
    if (!tokens) {
      return NextResponse.json({ connected: false, hasCalendar: false, scopes: [], email });
    }
    const scopes = (tokens.scope || "").split(/\s+/).filter(Boolean);
    const hasCalendar = scopes.some((s) => s.includes("calendar.events") || s.endsWith("/auth/calendar"));
    return NextResponse.json({
      connected: true,
      connectedEmail: tokens.email,
      connectedAt: tokens.connectedAt,
      hasCalendar,
      scopes,
      // si scopes está vacío es un token guardado ANTES de este fix (no
      // registraba scope). Reconectar lo rellena.
      scopeUnknown: scopes.length === 0,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
