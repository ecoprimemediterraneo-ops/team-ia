import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { listProductos, createProducto, deleteProducto, suggestTags } from "@/lib/marta-shopping";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const createSchema = z.object({
  nombre: z.string().min(1).max(255),
  descripcion: z.string().max(1000).optional(),
  precio: z.number().optional(),
  categoria: z.string().max(64).optional(),
  keywords: z.string().max(500).optional(),
  url_producto: z.string().url().optional().or(z.literal("")),
  imagen_url: z.string().url().optional().or(z.literal("")),
});

const suggestSchema = z.object({
  action: z.literal("suggest"),
  captionOrTema: z.string().min(3).max(2000),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listProductos(s.email);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "marta-prod", ip: getClientIp(req), limit: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json();
  try {
    if (body.action === "delete") {
      if (typeof body.id !== "string") return NextResponse.json({ error: "id requerido" }, { status: 400 });
      await deleteProducto(body.id, s.email);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "suggest") {
      const c = suggestSchema.safeParse(body);
      if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
      const sugerencias = await suggestTags({ owner_email: s.email, captionOrTema: c.data.captionOrTema });
      return NextResponse.json({ sugerencias });
    }
    const c = createSchema.safeParse(body);
    if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
    const created = await createProducto({
      owner_email: s.email,
      nombre: c.data.nombre,
      descripcion: c.data.descripcion ?? null,
      precio: c.data.precio ?? null,
      categoria: c.data.categoria ?? null,
      keywords: c.data.keywords ?? null,
      url_producto: c.data.url_producto || null,
      imagen_url: c.data.imagen_url || null,
    });
    return NextResponse.json({ producto: created });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
