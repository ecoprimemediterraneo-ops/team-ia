/**
 * GET   /api/sergio/changes        — lista los cambios detectados en las fuentes del cliente.
 * PATCH /api/sergio/changes?id=... — marca un cambio como visto (acknowledge).
 *
 * Multi-tenant: cada cliente solo ve cambios de SUS fuentes.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listChanges, acknowledgeChange } from "@/lib/sergio-db";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const relevance = searchParams.get("relevance") as "critical" | "high" | "medium" | "low" | null;

  const changes = await listChanges({
    relevance: relevance ?? undefined,
    limit: 50,
    ownerEmail: s.email,
  });
  return NextResponse.json({ changes });
}

export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Verificar ownership: el change debe pertenecer a una source del owner.
  const ownChanges = await listChanges({ ownerEmail: s.email, limit: 500 });
  if (!ownChanges.find((c) => c.id === id)) {
    return NextResponse.json({ error: "No es tuyo" }, { status: 403 });
  }

  await acknowledgeChange(id);
  return NextResponse.json({ ok: true });
}
