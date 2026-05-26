import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { generateReel, saveReel, listReels, setReelStatus, deleteReel } from "@/lib/marta-reels";
import { getMartaProfile } from "@/lib/marta-profile";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const createSchema = z.object({
  tema: z.string().min(3).max(300),
  duracion_seg: z.number().int().min(15).max(120).optional(),
});

const updateSchema = z.object({
  action: z.enum(["status", "delete"]),
  id: z.string().uuid(),
  status: z.enum(["borrador", "aprobado", "grabado", "publicado"]).optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reels = await listReels(s.email);
  return NextResponse.json({ reels });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit({ key: "marta-reels", ip: getClientIp(req), limit: 10, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json();

  // Update/delete branch
  if (body.action === "status" || body.action === "delete") {
    const u = updateSchema.safeParse(body);
    if (!u.success) return NextResponse.json({ error: u.error.issues[0].message }, { status: 400 });
    if (u.data.action === "delete") {
      await deleteReel(u.data.id, s.email);
      return NextResponse.json({ ok: true });
    }
    if (u.data.status) {
      await setReelStatus(u.data.id, s.email, u.data.status);
      return NextResponse.json({ ok: true });
    }
  }

  // Create branch
  const c = createSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });

  const profile = await getMartaProfile(s.email);
  if (!profile.nombre_negocio) {
    return NextResponse.json({ error: "Configura primero el nombre del negocio en el editor de Marta" }, { status: 400 });
  }

  try {
    const generated = await generateReel({ tema: c.data.tema, duracionSeg: c.data.duracion_seg, profile });
    const saved = await saveReel(s.email, generated);
    return NextResponse.json({ reel: saved });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
