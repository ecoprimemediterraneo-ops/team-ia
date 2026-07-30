// GET/POST /api/cron/informe-mensual — envía a cada negocio el informe UNIFICADO
// del MES ANTERIOR por email al dueño (Resend). Pensado para dispararse desde
// n8n (NO cron de Vercel).
//
// El informe es uno solo y trae las tres secciones: reservas + valor generado
// por los agentes + contenido publicado por Marta. Se renderiza en
// `informe-unificado.ts`, el MISMO módulo que usa la vista previa de
// /admin/informe → no pueden divergir.
//
// Auth: ?secret=<CRON_SECRET> o header x-cron-secret (o Authorization: Bearer) —
// MISMO patrón que /api/cron/booking-recordatorios (fail-closed en producción).
//
// Params de prueba:
//   ?mes=YYYY-MM        → fuerza ese mes (por defecto, el mes anterior a hoy).
//   ?force=1            → reenvía aunque ya se hubiera enviado ese mes (salta anti-duplicado).
//   ?preview=<slug>     → devuelve el HTML del informe de ese negocio (no envía, no marca).
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { listBusinesses, getBusinessBySlug } from "@/lib/booking";
import {
  periodoMes,
  construirInformeUnificado,
  enviarInformeUnificado,
} from "@/lib/informe-unificado";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: Request, h: Headers): boolean {
  const expected = process.env.CRON_SECRET || "";
  // Fail-CLOSED en producción: sin secreto configurado NO se abre el endpoint (evita
  // disparos públicos que enviarían emails reales). En dev sin secreto, permitido.
  if (!expected) return process.env.NODE_ENV !== "production";
  const url = new URL(req.url);
  const qp = url.searchParams.get("secret") || "";
  const hdr = h.get("x-cron-secret") || "";
  const bearer = (h.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return qp === expected || hdr === expected || bearer === expected;
}

async function run(req: Request) {
  const h = await headers();
  if (!authorized(req, h)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const per = periodoMes(url.searchParams.get("mes"));
  if (!per) return NextResponse.json({ ok: false, error: "mes inválido (usa YYYY-MM)" }, { status: 400 });

  // Vista previa del HTML de un negocio (no envía, no marca) — para verificar el diseño.
  const previewSlug = url.searchParams.get("preview");
  if (previewSlug) {
    const b = await getBusinessBySlug(previewSlug);
    if (!b) return NextResponse.json({ ok: false, error: "negocio no encontrado" }, { status: 404 });
    const { html } = await construirInformeUnificado({ business: b, periodo: per });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const force = url.searchParams.get("force") === "1";
  const negocios = await listBusinesses();
  const resultados: { slug: string; enviado: boolean; modo: string; to?: string; posts?: number }[] = [];
  let enviados = 0, saltados = 0;

  for (const b of negocios) {
    try {
      const r = await enviarInformeUnificado(b, per, { force });
      if (r.enviado || r.modo === "log_local") enviados++; else saltados++;
      resultados.push({ slug: b.slug, ...r });
    } catch (e) {
      saltados++;
      resultados.push({ slug: b.slug, enviado: false, modo: e instanceof Error ? e.message : "error" });
    }
  }

  return NextResponse.json({ ok: true, mes: per.label, periodo: { from: per.from, to: per.to }, negocios: negocios.length, enviados, saltados, resultados });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
