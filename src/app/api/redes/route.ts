import { NextResponse } from "next/server";
import { z } from "zod";
import { listar, crear, actualizar, eliminar, type Red } from "@/lib/redes";

const crearSchema = z.object({
  red: z.enum(["instagram", "facebook", "linkedin", "tiktok"]),
  contenido: z.string().min(1),
  imagenUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  fechaProgramada: z.string(),
  metadata: z.object({
    autor: z.string().optional(),
    campaña: z.string().optional(),
  }).optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const red = searchParams.get("red") as Red | null;
  const estado = searchParams.get("estado") as "borrador" | "aprobada" | "programada" | "publicada" | "fallida" | "asistida" | null;
  const items = await listar({
    red: red ?? undefined,
    estado: estado ?? undefined,
  });
  return NextResponse.json({ items, total: items.length });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = crearSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const pub = await crear(parsed.data);
    return NextResponse.json({ ok: true, publicacion: pub });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...resto } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const pub = await actualizar(id, resto);
    if (!pub) return NextResponse.json({ error: "no encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true, publicacion: pub });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const ok = await eliminar(id);
  return NextResponse.json({ ok });
}
