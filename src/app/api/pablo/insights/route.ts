import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateInsights, listInsights, updateInsightStatus } from "@/lib/pablo-crm";
import { getPabloProfile } from "@/lib/pablo-profile";
import { getAnalyticsSummary } from "@/lib/pablo-analytics";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listInsights(s.email);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "pablo-ins", ip: getClientIp(req), limit: 5, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });
  const profile = await getPabloProfile(s.email);
  const analyticsData = await getAnalyticsSummary(s.email);
  const insights = await generateInsights({ owner_email: s.email, profile, analyticsData });
  return NextResponse.json({ insights });
}

export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (typeof body.id !== "string" || typeof body.status !== "string") return NextResponse.json({ error: "id+status requeridos" }, { status: 400 });
  await updateInsightStatus(body.id, s.email, body.status);
  return NextResponse.json({ ok: true });
}
