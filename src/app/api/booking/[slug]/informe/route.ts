// GET /api/booking/[slug]/informe?from=YYYY-MM-DD&to=YYYY-MM-DD — informe del negocio (auth).
import { NextResponse } from "next/server";
import { authorizeOwner } from "@/lib/booking-owner";
import { informe } from "@/lib/booking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const url = new URL(req.url);
  const today = new Date().toISOString().slice(0, 10);
  const from = RE_DATE.test(url.searchParams.get("from") || "") ? url.searchParams.get("from")! : today;
  const to = RE_DATE.test(url.searchParams.get("to") || "") ? url.searchParams.get("to")! : today;
  const data = await informe(slug, from, to);
  return NextResponse.json({ ok: true, informe: data });
}
