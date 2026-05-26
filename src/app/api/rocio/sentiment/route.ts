import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { analyzeSentiment, listSentiments } from "@/lib/rocio-inteligencia";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ review_text: z.string().min(5).max(3000), rating: z.number().min(1).max(5).optional(), review_id: z.string().optional() });

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listSentiments(s.email);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "rocio-sent", ip: getClientIp(req), limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });
  const body = await req.json();
  const c = schema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  const analysis = await analyzeSentiment({ owner_email: s.email, ...c.data });
  if (!analysis) return NextResponse.json({ error: "Análisis falló" }, { status: 500 });
  return NextResponse.json({ analysis });
}
