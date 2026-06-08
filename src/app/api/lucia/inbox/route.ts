import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { fetchInbox, getRedirectUri } from "@/lib/gmail";

export async function GET() {
  try {
    const { email } = await requireSession();
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const result = await fetchInbox(email, getRedirectUri(host, proto), 20);
    if (!result) return NextResponse.json({ connected: false }, { status: 200 });
    return NextResponse.json({ connected: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { email } = await requireSession();
    const { clearGmailTokens, getGmailTokens } = await import("@/lib/store");

    // 1) Revocar el grant en Google ANTES de borrar localmente. Esto fuerza
    //    que la siguiente conexión sea un consentimiento totalmente nuevo, y
    //    Google emita un refresh_token fresco con TODOS los scopes pedidos
    //    (incluido calendar.events). Sin revocar, Google reutiliza el grant
    //    viejo y a veces NO devuelve refresh_token nuevo → quedaría el token
    //    antiguo sin calendar.
    try {
      const tokens = await getGmailTokens(email);
      if (tokens?.refreshToken) {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.refreshToken)}`,
          { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        ).catch(() => null);
      }
    } catch (e) {
      console.warn("[lucia/disconnect] no se pudo revocar en Google:", e instanceof Error ? e.message : e);
    }

    // 2) Borrar del store por completo (no solo marcar desconectado).
    await clearGmailTokens(email);
    return NextResponse.json({ ok: true, revoked: true });
  } catch {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }
}
