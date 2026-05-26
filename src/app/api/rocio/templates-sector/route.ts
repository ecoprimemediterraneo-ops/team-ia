import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listTemplatesSector, createTemplateSector, deleteTemplateSector, getSeedTemplates, SECTORES } from "@/lib/rocio-inteligencia";
import type { Sector } from "@/lib/rocio-inteligencia";

const createSchema = z.object({ sector: z.string(), sentiment: z.string(), titulo: z.string().min(1).max(255), body: z.string().min(1).max(2000) });

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const sector = (url.searchParams.get("sector") || "otro") as Sector;
  const items = await listTemplatesSector(s.email);
  const seeds = SECTORES.includes(sector) ? getSeedTemplates(sector) : null;
  return NextResponse.json({ items, sectores: SECTORES, seeds });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.action === "delete") {
    if (typeof body.id !== "string") return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await deleteTemplateSector(body.id, s.email);
    return NextResponse.json({ ok: true });
  }
  const c = createSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  const created = await createTemplateSector({ owner_email: s.email, ...c.data });
  return NextResponse.json({ template: created });
}
