// Callback OAuth de Rocío — recibe el code, intercambia por tokens, guarda
// el refresh_token en el store. Mismo patrón que /api/lucia/callback.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { google } from "googleapis";
import { requireSession } from "@/lib/auth";
import { getRedirectUri, listLocations, makeOAuthClient } from "@/lib/google-business";
import { saveGbpTokens } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) return NextResponse.redirect(new URL(`/dashboard/rocio?gbp_error=${error}`, url.origin));
  if (!code) return NextResponse.redirect(new URL("/dashboard/rocio?gbp_error=no_code", url.origin));

  try {
    const { email } = await requireSession();
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const redirectUri = getRedirectUri(host, proto);
    const oauth2 = makeOAuthClient(redirectUri);
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/dashboard/rocio?gbp_error=no_refresh_token", url.origin));
    }
    oauth2.setCredentials(tokens);
    const userinfo = await google.oauth2({ version: "v2", auth: oauth2 }).userinfo.get();
    await saveGbpTokens(email, {
      refreshToken: tokens.refresh_token,
      email: userinfo.data.email ?? "",
      connectedAt: new Date().toISOString(),
    });

    // Auto-elegir la primera ubicación si solo hay una.
    try {
      const locs = await listLocations(email, redirectUri);
      if (locs.length > 0) {
        await saveGbpTokens(email, {
          refreshToken: tokens.refresh_token,
          email: userinfo.data.email ?? "",
          connectedAt: new Date().toISOString(),
          locationName: locs[0].name,
          locationTitle: locs[0].title,
        });
      }
    } catch (e) {
      console.warn("[rocio/callback] no se pudieron listar locations:", e instanceof Error ? e.message : e);
    }

    return NextResponse.redirect(new URL("/dashboard/rocio?gbp=connected", url.origin));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(new URL(`/dashboard/rocio?gbp_error=${encodeURIComponent(msg)}`, url.origin));
  }
}
