import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { generateRepurpose, saveRepurpose, listRepurpose, deleteRepurpose } from "@/lib/marta-repurpose";
import { getMartaProfile } from "@/lib/marta-profile";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const createSchema = z.object({
  source_tipo: z.enum(["reel", "post", "carrusel", "video_largo"]),
  source_descripcion: z.string().min(10).max(3000),
});
const deleteSchema = z.object({
  action: z.literal("delete"),
  id: z.string().uuid(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listRepurpose(s.email);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: "marta-repurpose", ip: getClientIp(req), limit: 10, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json();
  try {
    if (body.action === "delete") {
      const p = deleteSchema.safeParse(body);
      if (!p.success) return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 });
      await deleteRepurpose(p.data.id, s.email);
      return NextResponse.json({ ok: true });
    }

    const c = createSchema.safeParse(body);
    if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });

    const profile = await getMartaProfile(s.email);
    if (!profile.nombre_negocio) {
      return NextResponse.json({ error: "Configura primero el editor de Marta" }, { status: 400 });
    }

    const piezas = await generateRepurpose({ sourceTipo: c.data.source_tipo, sourceDescripcion: c.data.source_descripcion, profile });
    if (!piezas) return NextResponse.json({ error: "No se pudieron generar las piezas" }, { status: 500 });

    const saved = await saveRepurpose({ owner_email: s.email, ...c.data, piezas });
    return NextResponse.json({ repurpose: saved });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
