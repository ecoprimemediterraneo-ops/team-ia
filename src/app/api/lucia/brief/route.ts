import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateDailyBrief, listDailyBriefs } from "@/lib/lucia-inteligencia";
import { getLuciaProfile } from "@/lib/lucia-profile";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listDailyBriefs(s.email);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "lucia-brief", ip: getClientIp(req), limit: 6, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const profile = await getLuciaProfile(s.email);
  const brief = await generateDailyBrief({ owner_email: s.email, profile, emails_recientes: Array.isArray(body?.emails) ? body.emails : [] });
  return NextResponse.json({ brief });
}
