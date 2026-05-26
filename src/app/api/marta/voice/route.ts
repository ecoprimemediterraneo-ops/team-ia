import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { generateVoiceOver, listVoiceOvers, VOCES_ES } from "@/lib/marta-voice";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  script: z.string().min(5).max(1500),
  voice_id: z.string().optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listVoiceOvers(s.email);
  return NextResponse.json({ voces: VOCES_ES, items, enabled: !!process.env.ELEVENLABS_API_KEY });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "marta-voice", ip: getClientIp(req), limit: 10, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json();
  const c = schema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });

  const r = await generateVoiceOver({ owner_email: s.email, script: c.data.script, voiceId: c.data.voice_id });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json(r);
}
