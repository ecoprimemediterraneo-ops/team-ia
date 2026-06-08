import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { google } from "googleapis";
import { requireSession } from "@/lib/auth";
import { getRedirectUri, makeOAuthClient } from "@/lib/gmail";
import { getGmailTokens, saveGmailTokens } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) return NextResponse.redirect(new URL(`/dashboard/lucia?gmail_error=${error}`, url.origin));
  if (!code) return NextResponse.redirect(new URL("/dashboard/lucia?gmail_error=no_code", url.origin));

  try {
    const { email } = await requireSession();
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const oauth2 = makeOAuthClient(getRedirectUri(host, proto));
    const { tokens } = await oauth2.getToken(code);

    // El scope concedido viene en tokens.scope (space-separated). Lo guardamos
    // siempre para poder diagnosticar qué permisos tiene realmente el token.
    const grantedScope = tokens.scope ?? "";
    console.log(
      `[lucia/callback] email=${email} hasRefresh=${!!tokens.refresh_token} scope="${grantedScope}"`,
    );

    // CASO PROBLEMÁTICO: Google a veces NO devuelve refresh_token al reautorizar
    // si el grant anterior no fue revocado (aunque pidamos prompt=consent). Si
    // pasa eso y existe un refresh token previo, lo conservamos pero refrescamos
    // el scope observado; si el nuevo grant ya trae calendar.events, el token
    // existente lo hereda. Si no, pedimos desconectar (revoca) y reconectar.
    if (!tokens.refresh_token) {
      const existing = await getGmailTokens(email);
      if (existing?.refreshToken) {
        await saveGmailTokens(email, {
          ...existing,
          email: existing.email || email,
          scope: grantedScope || existing.scope,
          connectedAt: new Date().toISOString(),
        });
        if (grantedScope.includes("calendar.events")) {
          return NextResponse.redirect(new URL("/dashboard/lucia?gmail=connected", url.origin));
        }
        return NextResponse.redirect(
          new URL("/dashboard/lucia?gmail_error=reconecta_desconectando_primero", url.origin),
        );
      }
      return NextResponse.redirect(new URL("/dashboard/lucia?gmail_error=no_refresh_token", url.origin));
    }

    // Camino normal: Google devolvió refresh_token NUEVO → SIEMPRE sobreescribe
    // (incluso si ya existía uno). Así el token con calendar.events reemplaza al
    // viejo de solo Gmail.
    oauth2.setCredentials(tokens);
    let userEmail = "";
    try {
      const userinfo = await google.oauth2({ version: "v2", auth: oauth2 }).userinfo.get();
      userEmail = userinfo.data.email ?? "";
    } catch {
      userEmail = email;
    }

    await saveGmailTokens(email, {
      refreshToken: tokens.refresh_token,
      email: userEmail || email,
      connectedAt: new Date().toISOString(),
      scope: grantedScope,
    });

    return NextResponse.redirect(new URL("/dashboard/lucia?gmail=connected", url.origin));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(new URL(`/dashboard/lucia?gmail_error=${encodeURIComponent(msg)}`, url.origin));
  }
}
