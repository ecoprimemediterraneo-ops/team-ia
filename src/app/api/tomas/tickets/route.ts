import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isFounder } from "@/lib/auth";
import { listTickets, updateTicket } from "@/lib/tomas-chat";

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["abierto", "en_proceso", "resuelto", "cerrado"]).optional(),
  resolucion: z.string().max(2000).optional(),
  asignado_a: z.string().email().optional(),
});

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFounder(s.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const items = await listTickets({ status });
  return NextResponse.json({ items });
}

export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFounder(s.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const c = updateSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  const { id, ...patch } = c.data;
  await updateTicket(id, patch);
  return NextResponse.json({ ok: true });
}
