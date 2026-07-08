// POST /api/admin/salones/importar — founder-only.
// Body: { url } (ficha pública de Booksy) → { ok, draft, fuente }.
// El draft es un borrador editable; NO crea el salón (eso lo hace POST /api/admin/salones).
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFounder } from "@/lib/admin-auth";
import { importarDesdeBooksy } from "@/lib/booksy-importer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ url: z.string().url().max(500) });

export async function POST(req: Request) {
  const a = await requireFounder();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "URL no válida." }, { status: 400 });

  const res = await importarDesdeBooksy(parsed.data.url);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 422 });
  return NextResponse.json({ ok: true, draft: res.draft, fuente: res.fuente });
}
