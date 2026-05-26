/**
 * GET  /api/sergio/sources       — lista las fuentes del cliente autenticado.
 * POST /api/sergio/sources       — crea / actualiza / borra una fuente (siempre propia).
 *
 * Multi-tenant: cada cliente solo ve y gestiona sus fuentes.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  listSourcesByOwner,
  createSource,
  updateSource,
  deleteSource,
  getSourceForOwner,
} from "@/lib/sergio-db";

async function requireUser() {
  const s = await getSession();
  if (!s) return null;
  return s;
}

const sourceSchema = z.object({
  type: z.enum(["web", "linkedin", "crunchbase", "reviews", "reddit", "ads", "seo"]).default("web"),
  url: z.string().url(),
  competitor_name: z.string().min(2).max(120),
  category: z.enum(["direct_competitor", "adjacent", "inspiration"]).default("direct_competitor"),
  frequency: z.enum(["daily", "weekly", "biweekly"]).default("weekly"),
});

const MAX_SOURCES_PER_OWNER = 10;

export async function GET() {
  const s = await requireUser();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sources = await listSourcesByOwner(s.email);
  return NextResponse.json({ sources });
}

export async function POST(req: Request) {
  const s = await requireUser();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, id } = body;

  // Delete
  if (action === "delete") {
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const owned = await getSourceForOwner(id, s.email);
    if (!owned) return NextResponse.json({ error: "No es tuyo" }, { status: 403 });
    await deleteSource(id);
    return NextResponse.json({ ok: true });
  }

  // Toggle active
  if (action === "toggle") {
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const owned = await getSourceForOwner(id, s.email);
    if (!owned) return NextResponse.json({ error: "No es tuyo" }, { status: 403 });
    await updateSource(id, { active: !owned.active });
    return NextResponse.json({ ok: true, active: !owned.active });
  }

  // Create
  const parsed = sourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await listSourcesByOwner(s.email);
  if (existing.length >= MAX_SOURCES_PER_OWNER) {
    return NextResponse.json(
      { error: `Has alcanzado el límite de ${MAX_SOURCES_PER_OWNER} competidores. Borra uno para añadir otro.` },
      { status: 400 },
    );
  }

  const source = await createSource({
    ...parsed.data,
    active: true,
    config: {},
    owner_email: s.email,
  });
  return NextResponse.json({ source });
}
