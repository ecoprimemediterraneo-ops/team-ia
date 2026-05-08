import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { getUser } from "@/lib/store";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  await getUser(parsed.data.email);
  await createSession(parsed.data.email);
  return NextResponse.json({ ok: true });
}
