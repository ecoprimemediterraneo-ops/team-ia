import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { fetchMessageBody, getRedirectUri } from "@/lib/gmail";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { email } = await requireSession();
    const { id } = await params;
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const m = await fetchMessageBody(email, getRedirectUri(host, proto), id);
    if (!m) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(m);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
