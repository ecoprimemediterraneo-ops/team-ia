import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listCalls, updateCallStatus } from "@/lib/carmen";

const updateSchema = z.object({ action: z.literal("update"), id: z.string().uuid(), status: z.enum(["nueva", "contactado", "resuelta", "descartada"]), notas: z.string().optional() });

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const items = await listCalls(s.email, status);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const c = updateSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  await updateCallStatus(c.data.id, s.email, c.data.status, c.data.notas);
  return NextResponse.json({ ok: true });
}
