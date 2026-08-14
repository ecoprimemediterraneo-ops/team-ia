// La bandeja que lee Lucía.
//
// En gestoría, además, cada correo sale MARCADO si su remitente está en la
// lista de importantes del tenant, y la lista sale ordenada: críticos arriba,
// importantes después, el resto detrás.
//
// Lo que NO hace, y no debe hacer nunca: quitar correos. Se devuelven los
// mismos que devuelve Gmail, ni uno menos. Un correo sin marca aparece normal,
// no escondido.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { fetchInbox, getRedirectUri } from "@/lib/gmail";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { listarRemitentes, clasificarRemitente, ordenarPorAviso } from "@/lib/lucia-remitentes";

export async function GET() {
  try {
    const { email } = await requireSession();
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const result = await fetchInbox(email, getRedirectUri(host, proto), 20);
    if (!result) return NextResponse.json({ connected: false }, { status: 200 });

    // El marcado es solo del sector que lo tiene encendido. En una peluquería
    // la bandeja se queda exactamente como estaba.
    const ctx = await contextoPanelODefecto();
    if (!tieneFuncion(ctx.sector, "clasificacionCorreo")) {
      return NextResponse.json({ connected: true, marcado: false, ...result });
    }

    const lista = await listarRemitentes(ctx.tenantId);
    const marcados = result.messages.map((m) => ({
      ...m,
      marca: clasificarRemitente(m.from, lista),
    }));

    return NextResponse.json({
      connected: true,
      marcado: true,
      connectedEmail: result.connectedEmail,
      messages: ordenarPorAviso(marcados),
    });
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
