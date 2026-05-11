import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { google } from "googleapis";
import { requireSession } from "@/lib/auth";
import { getRedirectUri, makeOAuthClient } from "@/lib/gmail";
import { saveGmailTokens } from "@/lib/store";

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
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/dashboard/lucia?gmail_error=no_refresh_token", url.origin));
    }
    oauth2.setCredentials(tokens);
    const userinfo = await google.oauth2({ version: "v2", auth: oauth2 }).userinfo.get();
    await saveGmailTokens(email, {
      refreshToken: tokens.refresh_token,
      email: userinfo.data.email ?? "",
      connectedAt: new Date().toISOString(),
    });
    return NextResponse.redirect(new URL("/dashboard/lucia?gmail=connected", url.origin));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(new URL(`/dashboard/lucia?gmail_error=${encodeURIComponent(msg)}`, url.origin));
  }
}
