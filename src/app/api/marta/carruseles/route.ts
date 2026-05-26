import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { generateCarrusel, saveCarrusel, listCarruseles, deleteCarrusel } from "@/lib/marta-carruseles";
import { getMartaProfile } from "@/lib/marta-profile";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const createSchema = z.object({
  tema: z.string().min(3).max(300),
  num_slides: z.number().int().min(5).max(10).optional(),
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  id: z.string().uuid(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const carruseles = await listCarruseles(s.email);
  return NextResponse.json({ carruseles });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: "marta-carruseles", ip: getClientIp(req), limit: 10, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json();

  if (body.action === "delete") {
    const d = deleteSchema.safeParse(body);
    if (!d.success) return NextResponse.json({ error: d.error.issues[0].message }, { status: 400 });
    await deleteCarrusel(d.data.id, s.email);
    return NextResponse.json({ ok: true });
  }

  const c = createSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });

  const profile = await getMartaProfile(s.email);
  if (!profile.nombre_negocio) {
    return NextResponse.json({ error: "Configura primero el nombre del negocio en el editor de Marta" }, { status: 400 });
  }

  try {
    const generated = await generateCarrusel({ tema: c.data.tema, numSlides: c.data.num_slides, profile });
    const saved = await saveCarrusel(s.email, generated);
    return NextResponse.json({ carrusel: saved });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
