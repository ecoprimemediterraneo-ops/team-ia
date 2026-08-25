// El nombre de pila del gestor, por tenant. Founder-only.
//
//   GET            dice cómo se llama el gestor de cada tenant
//   POST {tenantId, nombre}   lo cambia
//
// Vive aquí y no en /dashboard/perfil porque esa pantalla edita la FICHA del
// negocio (a qué se dedica, qué ofrece), que es otra cosa: esto es quién usa el
// panel. Cuando haya una pantalla de ajustes de cuenta de verdad, se mueve.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { listTenants, setOwnerName } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const tenants = await listTenants();
  return NextResponse.json({
    ok: true,
    tenants: tenants.map((t) => ({ id: t.id, negocio: t.name, gestor: t.ownerName ?? null })),
  });
}

export async function POST(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as { tenantId?: string; nombre?: string };
  if (!body.tenantId) return NextResponse.json({ error: "Falta el tenant." }, { status: 400 });

  const t = await setOwnerName(body.tenantId, body.nombre ?? "");
  if (!t) return NextResponse.json({ error: "Ese tenant no existe." }, { status: 404 });
  return NextResponse.json({ ok: true, tenantId: t.id, gestor: t.ownerName ?? null });
}
