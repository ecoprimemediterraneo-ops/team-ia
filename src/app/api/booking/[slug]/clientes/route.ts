// GET/POST /api/booking/[slug]/clientes — CRM del negocio (auth-gated).
//   GET            → listado de clientes (agregado de reservas). ?q= busca.
//   GET ?key=XXX   → ficha completa (agregados + historial + notas/etiquetas).
//   POST {key, notas?, etiquetas?} → guarda notas/etiquetas del cliente.
//   POST {key, memoria: {nombre?, idioma?, franja?, preferencias?}} → edita la
//        memoria de Pablo y Carmen (los datos de salud se rechazan).
//   POST {key, olvidar: true} → borra la memoria de la clienta (RGPD).
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeOwner } from "@/lib/booking-owner";
import { listClientes, getClienteFicha, saveClienteMeta } from "@/lib/booking";
import { componerMemoria, editarMemoria, olvidarClienta } from "@/lib/memoria-clienta";

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
    return NextResponse.json({ ok: true, ...ficha, memoria: componerMemoria(ficha.meta.memoria, ficha.historial) });
  }
  const clientes = await listClientes(slug, url.searchParams.get("q") || undefined);
  return NextResponse.json({ ok: true, clientes });
}

const schema = z.object({
  key: z.string().min(1).max(120),
  notas: z.string().max(4000).optional(),
  etiquetas: z.array(z.string().min(1).max(40)).max(20).optional(),
  memoria: z.object({
    nombre: z.string().max(80).optional(),
    idioma: z.enum(["es", "en", ""]).optional(),
    franja: z.enum(["mañana", "tarde", ""]).optional(),
    preferencias: z.array(z.string().max(140)).max(12).optional(),
  }).optional(),
  olvidar: z.literal(true).optional(),
  /** "MM-DD" o "" para quitarlo. */
  cumpleanos: z.string().regex(/^(\d{2}-\d{2})?$/).optional(),
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
  if (p.data.olvidar) {
    const tel = p.data.key.startsWith("t:") ? p.data.key.slice(2) : "";
    await olvidarClienta({ slug, tenantId: a.business.tenantId, telefono: tel || p.data.key });
    return NextResponse.json({ ok: true, olvidada: true });
  }
  if (p.data.cumpleanos !== undefined) {
    await saveClienteMeta(slug, p.data.key, { cumpleanos: p.data.cumpleanos || undefined });
    return NextResponse.json({ ok: true });
  }
  if (p.data.memoria) {
    const { rechazadas } = await editarMemoria(slug, p.data.key, p.data.memoria);
    return NextResponse.json({ ok: true, rechazadas });
  }
  await saveClienteMeta(slug, p.data.key, { notas: p.data.notas, etiquetas: p.data.etiquetas });
  return NextResponse.json({ ok: true });
}
