import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listTemplates, createTemplate, deleteTemplate, INTENTS_PABLO } from "@/lib/pablo-analytics";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const createSchema = z.object({ intent: z.string().min(1), titulo: z.string().min(1).max(255), body: z.string().min(1).max(2000) });

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listTemplates(s.email);
  return NextResponse.json({ items, intents: INTENTS_PABLO });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "pablo-tmpl", ip: getClientIp(req), limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });
  const body = await req.json();
  if (body.action === "delete") {
    if (typeof body.id !== "string") return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await deleteTemplate(body.id, s.email);
    return NextResponse.json({ ok: true });
  }
  const c = createSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  const created = await createTemplate({ owner_email: s.email, ...c.data });
  return NextResponse.json({ template: created });
}
