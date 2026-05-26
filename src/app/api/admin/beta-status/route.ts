/**
 * PATCH /api/admin/beta-status — cambiar estado de una solicitud beta.
 * Solo founders.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isFounder } from "@/lib/auth";
import { kvGet, kvSet } from "@/lib/supabase";

const schema = z.object({
  email: z.string().email(),
  estado: z.enum(["pendiente", "activo", "cerrado", "contactado", "rechazado"]),
});

type Beta = {
  email: string;
  estado: string;
  [k: string]: unknown;
};

export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s || !isFounder(s.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const all = (await kvGet<Beta[]>("beta:all")) || [];
  const idx = all.findIndex((b) => b.email === parsed.data.email);
  if (idx === -1) {
    return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  }

  all[idx] = { ...all[idx], estado: parsed.data.estado };
  await kvSet("beta:all", all);

  return NextResponse.json({ ok: true });
}
