import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { generateMeetingBrief, listMeetingBriefs } from "@/lib/lucia-inteligencia";
import { getLuciaProfile } from "@/lib/lucia-profile";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  meeting_with: z.string().min(2).max(255),
  meeting_at: z.string().optional(),
  related_emails: z.array(z.object({ subject: z.string(), body: z.string() })).optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listMeetingBriefs(s.email);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "lucia-meet", ip: getClientIp(req), limit: 10, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });
  const body = await req.json();
  const c = schema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  const profile = await getLuciaProfile(s.email);
  const brief = await generateMeetingBrief({ owner_email: s.email, profile, ...c.data });
  if (!brief) return NextResponse.json({ error: "No se pudo generar" }, { status: 500 });
  return NextResponse.json({ brief });
}
