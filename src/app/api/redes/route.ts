// Publicaciones de redes del panel.
//
// LOS CUATRO VERBOS ESTABAN ABIERTOS. El GET servía el contenido interno a
// cualquiera, y —peor— POST, PATCH y DELETE permitían crear, editar y BORRAR
// publicaciones a quien supiera la URL, sin sesión de ningún tipo.
//
// El portero es "sesión válida", NO `requireFounder`: las pantallas que comen de
// aquí (`/dashboard/redes` y `/dashboard/redes/aprobar`) son de CLIENTE y solo
// exigen estar dentro. Pedir fundador aquí cerraría la puerta a los propios
// clientes, que es a quien está hecha la pantalla.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionLocal } from "@/lib/auth";
import { listar, crear, actualizar, eliminar, type Red } from "@/lib/redes";

/** Puerta común de los cuatro verbos. Sin sesión, 401 y no se toca nada. */
async function exigeSesion(): Promise<NextResponse | null> {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

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
  const cerrado = await exigeSesion();
  if (cerrado) return cerrado;

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
  const cerrado = await exigeSesion();
  if (cerrado) return cerrado;

  try {
    const body = await req.json();
    const parsed = crearSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const pub = await crear(parsed.data);
    return NextResponse.json({ ok: true, publicacion: pub });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const cerrado = await exigeSesion();
  if (cerrado) return cerrado;

  try {
    const body = await req.json();
    const { id, ...resto } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const pub = await actualizar(id, resto);
    if (!pub) return NextResponse.json({ error: "no encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true, publicacion: pub });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const cerrado = await exigeSesion();
  if (cerrado) return cerrado;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const ok = await eliminar(id);
  return NextResponse.json({ ok });
}
