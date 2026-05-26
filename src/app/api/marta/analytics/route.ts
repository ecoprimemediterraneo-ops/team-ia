/**
 * GET   /api/marta/analytics                — lista posts + summary + recomendaciones
 * POST  /api/marta/analytics                — upsert métricas manuales de un post
 *   body: { ig_media_id?, tipo_post, titulo?, hashtags?, publicado_at?,
 *           impressions?, reach?, likes?, comments?, saves?, shares? }
 * PATCH /api/marta/analytics                — cambia status de recomendación
 *   body: { recId, action: "aceptar"|"descartar" }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  listAnalytics,
  upsertAnalytic,
  getAnalyticsSummary,
  listRecomendaciones,
  setRecomendacionStatus,
  generateRecomendaciones,
} from "@/lib/marta-analytics";
import { getMartaProfile } from "@/lib/marta-profile";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [posts, summary, recomendaciones] = await Promise.all([
    listAnalytics(s.email, 50),
    getAnalyticsSummary(s.email),
    listRecomendaciones(s.email, "nueva"),
  ]);
  return NextResponse.json({ posts, summary, recomendaciones });
}

const createSchema = z.object({
  ig_media_id: z.string().max(128).optional(),
  tipo_post: z.enum(["post", "reel", "carrusel", "story"]),
  titulo: z.string().max(300).optional(),
  hashtags: z.string().max(500).optional(),
  publicado_at: z.string().optional(),
  impressions: z.number().int().min(0).optional(),
  reach: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  saves: z.number().int().min(0).optional(),
  shares: z.number().int().min(0).optional(),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Acción especial: re-generar recomendaciones manualmente
  if (body.action === "regenerar_recomendaciones") {
    const profile = await getMartaProfile(s.email);
    const n = await generateRecomendaciones(s.email, profile);
    return NextResponse.json({ ok: true, generadas: n });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const post = await upsertAnalytic({ owner_email: s.email, ...parsed.data });
    return NextResponse.json({ post });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

const patchSchema = z.object({
  recId: z.string().uuid(),
  action: z.enum(["aceptar", "descartar"]),
});

export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const status = parsed.data.action === "aceptar" ? "aceptada" : "descartada";
  await setRecomendacionStatus(parsed.data.recId, s.email, status);
  return NextResponse.json({ ok: true });
}
