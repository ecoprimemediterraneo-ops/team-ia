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
    const { clearGmailTokens } = await import("@/lib/store");
    await clearGmailTokens(email);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }
}
