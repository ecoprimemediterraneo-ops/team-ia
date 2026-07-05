// GET/POST /api/booking/[slug]/clientes — CRM del negocio (auth-gated).
//   GET            → listado de clientes (agregado de reservas). ?q= busca.
//   GET ?key=XXX   → ficha completa (agregados + historial + notas/etiquetas).
//   POST {key, notas?, etiquetas?} → guarda notas/etiquetas del cliente.
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeOwner } from "@/lib/booking-owner";
import { listClientes, getClienteFicha, saveClienteMeta } from "@/lib/booking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (key) {
    const ficha = await getClienteFicha(slug, key);
    if (!ficha) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, ...ficha });
  }
  const clientes = await listClientes(slug, url.searchParams.get("q") || undefined);
  return NextResponse.json({ ok: true, clientes });
}

const schema = z.object({
  key: z.string().min(1).max(120),
  notas: z.string().max(4000).optional(),
  etiquetas: z.array(z.string().min(1).max(40)).max(20).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const p = schema.safeParse(body);
  if (!p.success) return NextResponse.json({ ok: false, error: p.error.issues[0].message }, { status: 400 });
  await saveClienteMeta(slug, p.data.key, { notas: p.data.notas, etiquetas: p.data.etiquetas });
  return NextResponse.json({ ok: true });
}
