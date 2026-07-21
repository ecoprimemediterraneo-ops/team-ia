// GET/POST /api/booking/[slug]/reactivar — Reactivación de clientas dormidas (auth-gated).
//   GET             → lista de clientas dormidas (última cita > 60 días, sin cita futura,
//                     con email) y su estado anti-spam.
//   POST { keys[] } → envía el email de reactivación a esas clientas (firmado por el
//                     negocio), respetando el anti-spam de 30 días, y marca la fecha.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { authorizeOwner } from "@/lib/booking-owner";
import { listClientesDormidas, marcarReactivacionEnviada } from "@/lib/booking";
import { enviarReactivacion } from "@/lib/booking-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  const dormidas = await listClientesDormidas(slug);
  return NextResponse.json({ ok: true, dormidas, total: dormidas.length });
}

const bodySchema = z.object({ keys: z.array(z.string().min(1).max(120)).min(1).max(500) });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 });

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const pedidas = new Set(parsed.data.keys);
  const dormidas = await listClientesDormidas(slug);
  const resultados: { key: string; enviado: boolean; modo: string }[] = [];
  let enviados = 0, saltados = 0;

  for (const c of dormidas) {
    if (!pedidas.has(c.key)) continue;
    if (!c.puedeEnviar) { resultados.push({ key: c.key, enviado: false, modo: "anti_spam" }); saltados++; continue; }
    try {
      const r = await enviarReactivacion(c.nombre, c.email, a.business, baseUrl);
      if (r.intentado) await marcarReactivacionEnviada(slug, c.key); // marca aunque en local sea log_local
      if (r.enviado || r.modo === "log_local") enviados++; else saltados++;
      resultados.push({ key: c.key, enviado: r.enviado, modo: r.modo });
    } catch (e) {
      saltados++;
      resultados.push({ key: c.key, enviado: false, modo: e instanceof Error ? e.message : "error" });
    }
  }

  return NextResponse.json({ ok: true, enviados, saltados, resultados });
}
