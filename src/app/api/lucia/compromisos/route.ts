import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { detectCompromisos, listCompromisos, updateCompromiso } from "@/lib/lucia-inteligencia";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const detectSchema = z.object({ sentEmails: z.array(z.object({ id: z.string().optional(), to: z.string(), subject: z.string(), body: z.string() })).min(1) });
const updateSchema = z.object({ action: z.literal("update"), id: z.string().uuid(), status: z.enum(["cumplido", "descartado", "vencido"]) });

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const items = await listCompromisos(s.email, status);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "lucia-comp", ip: getClientIp(req), limit: 10, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });
  const body = await req.json();
  if (body.action === "update") {
    const c = updateSchema.safeParse(body);
    if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
    await updateCompromiso(c.data.id, s.email, c.data.status);
    return NextResponse.json({ ok: true });
  }
  const c = detectSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  const items = await detectCompromisos({ owner_email: s.email, sentEmails: c.data.sentEmails });
  return NextResponse.json({ items });
}
