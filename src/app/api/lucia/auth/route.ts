import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { GMAIL_SCOPES, getRedirectUri, makeOAuthClient } from "@/lib/gmail";

export async function GET() {
  try {
    await requireSession();
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const oauth2 = makeOAuthClient(getRedirectUri(host, proto));
    const url = oauth2.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GMAIL_SCOPES,
    });
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/login", "http://localhost:3000"));
  }
}
