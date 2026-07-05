// Lista de espera.
//   POST   (público) → apuntarse: {serviceId, variantId?, empleadoId?, fecha, nombre, telefono, email?}
//   GET    (dueño)   → entradas activas (esperando/avisado).
//   DELETE (dueño)   → quitar una entrada. ?id=
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeOwner } from "@/lib/booking-owner";
import { crearEspera, listEspera, cancelarEspera } from "@/lib/booking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

const joinSchema = z.object({
  serviceId: z.string().min(1).max(40),
  variantId: z.string().max(40).optional(),
  empleadoId: z.string().max(40).optional(),
  fecha: z.string().regex(RE_DATE),
  nombre: z.string().min(1).max(120),
  telefono: z.string().min(6).max(30),
  email: z.string().email().max(200).optional().or(z.literal("")).transform((v) => v || undefined),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 }); }
  const p = joinSchema.safeParse(body);
  if (!p.success) return NextResponse.json({ ok: false, error: p.error.issues[0].message }, { status: 400 });
  const d = p.data;
  const res = await crearEspera({
    slug, serviceId: d.serviceId, variantId: d.variantId, empleadoId: d.empleadoId, fecha: d.fecha,
    cliente: { nombre: d.nombre.trim(), telefono: d.telefono.trim(), email: d.email },
  });
  if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason }, { status: res.reason === "not_found" ? 404 : 400 });
  return NextResponse.json({ ok: true });
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  const entries = (await listEspera(slug)).filter((e) => e.estado !== "cancelada");
  return NextResponse.json({ ok: true, entries });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "no_id" }, { status: 400 });
  const ok = await cancelarEspera(slug, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
