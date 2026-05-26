import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { generateColaboraciones, saveColaboraciones, listColaboraciones, updateColabStatus } from "@/lib/marta-colaboraciones";
import { getMartaProfile } from "@/lib/marta-profile";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["contactada", "aceptada", "descartada"]),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listColaboraciones(s.email);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "marta-colab", ip: getClientIp(req), limit: 5, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const profile = await getMartaProfile(s.email);
  if (!profile.nombre_negocio) return NextResponse.json({ error: "Configura el editor de Marta primero" }, { status: 400 });

  const colabs = await generateColaboraciones(profile);
  if (colabs.length === 0) return NextResponse.json({ error: "No se generaron sugerencias" }, { status: 500 });

  const saved = await saveColaboraciones(s.email, colabs);
  return NextResponse.json({ items: saved });
}

export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const c = patchSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  await updateColabStatus(c.data.id, s.email, c.data.status);
  return NextResponse.json({ ok: true });
}
