import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listCatalogo, createItem, deleteItem } from "@/lib/pablo-crm";

const createSchema = z.object({
  nombre: z.string().min(1).max(255),
  descripcion: z.string().max(1000).optional(),
  precio: z.number().optional(),
  precio_desde: z.boolean().optional(),
  duracion_min: z.number().optional(),
  categoria: z.string().max(64).optional(),
  keywords: z.string().max(500).optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listCatalogo(s.email);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.action === "delete") {
    if (typeof body.id !== "string") return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await deleteItem(body.id, s.email);
    return NextResponse.json({ ok: true });
  }
  const c = createSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  const created = await createItem({
    owner_email: s.email,
    nombre: c.data.nombre,
    descripcion: c.data.descripcion ?? null,
    precio: c.data.precio ?? null,
    precio_desde: c.data.precio_desde ?? false,
    duracion_min: c.data.duracion_min ?? null,
    categoria: c.data.categoria ?? null,
    keywords: c.data.keywords ?? null,
  });
  return NextResponse.json({ item: created });
}
