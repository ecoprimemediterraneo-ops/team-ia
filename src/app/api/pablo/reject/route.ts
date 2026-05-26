import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getPabloPendingById, updatePabloPendingStatus } from "@/lib/pablo-pending";
import { incrementPabloCounter } from "@/lib/pablo-profile";

const schema = z.object({ id: z.string().uuid() });

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const pending = await getPabloPendingById(parsed.data.id, s.email);
  if (!pending) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (pending.status !== "pending") return NextResponse.json({ error: "Ya procesado" }, { status: 409 });

  await updatePabloPendingStatus(pending.id, {
    status: "rejected",
    approved_at: new Date().toISOString(),
    approved_by: s.email,
  });
  await incrementPabloCounter(s.email, "rechazo");
  return NextResponse.json({ ok: true });
}
