// Inicia el flow OAuth de Rocío contra Google Business Profile.
// Mismo patrón que /api/lucia/auth.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { GBP_SCOPES, getRedirectUri, makeOAuthClient } from "@/lib/google-business";

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
      scope: GBP_SCOPES,
    });
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/login", "http://localhost:3000"));
  }
}
