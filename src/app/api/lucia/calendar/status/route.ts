// GET /api/lucia/calendar/status
// Diagnóstico: devuelve los scopes guardados del token de Gmail/Calendar del
// usuario y si incluye calendar.events (lo que necesita la agenda). Útil para
// verificar tras reconectar sin tener que mirar logs.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { getGmailTokens } from "@/lib/store";
import { getRedirectUri } from "@/lib/gmail";
import { getLiveGrantedScopes } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { email } = await requireSession();
    const tokens = await getGmailTokens(email);
    if (!tokens) {
      return NextResponse.json({ connected: false, hasCalendar: false, scopes: [], email });
    }

    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");

    // FUENTE DE VERDAD: scopes REALES que concede el refresh_token guardado,
    // consultados en vivo a Google. La cadena `tokens.scope` que guardamos
    // puede quedar desincronizada (p. ej. si en una reconexión Google no
    // devolvió refresh_token nuevo y conservamos el viejo de solo-Gmail).
    const live = await getLiveGrantedScopes(email, getRedirectUri(host, proto));

    const storedScopes = (tokens.scope || "").split(/\s+/).filter(Boolean);

    if (live.ok) {
      return NextResponse.json({
        connected: true,
        connectedEmail: tokens.email,
        connectedAt: tokens.connectedAt,
        hasCalendar: live.hasCalendar,   // verdad en vivo
        scopes: live.scopes,             // scopes reales del token
        storedScopes,                    // lo que teníamos guardado (diagnóstico)
        source: "live",
      });
    }

    // Si el chequeo en vivo falla (token revocado/expirado) caemos a lo guardado
    // pero lo marcamos como no fiable.
    return NextResponse.json({
      connected: true,
      connectedEmail: tokens.email,
      connectedAt: tokens.connectedAt,
      hasCalendar: false,
      scopes: storedScopes,
      storedScopes,
      source: "stored",
      liveError: live.reason,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
