import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { fetchTodayCalendar, getRedirectUri } from "@/lib/gmail";

export async function GET() {
  try {
    const { email } = await requireSession();
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const events = await fetchTodayCalendar(email, getRedirectUri(host, proto));
    if (!events) return NextResponse.json({ connected: false }, { status: 200 });
    return NextResponse.json({ connected: true, events });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
