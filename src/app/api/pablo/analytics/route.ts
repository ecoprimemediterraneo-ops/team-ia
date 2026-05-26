import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAnalyticsSummary, markConverted } from "@/lib/pablo-analytics";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await getAnalyticsSummary(s.email);
  return NextResponse.json(summary);
}

export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (typeof body.id !== "string") return NextResponse.json({ error: "id requerido" }, { status: 400 });
  await markConverted(body.id, s.email, typeof body.value === "number" ? body.value : undefined);
  return NextResponse.json({ ok: true });
}
