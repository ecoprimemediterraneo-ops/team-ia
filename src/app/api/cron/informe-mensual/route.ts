// GET/POST /api/cron/informe-mensual — envía a cada negocio el informe del MES ANTERIOR
// por email al dueño. Pensado para dispararse desde n8n (NO cron de Vercel).
// Auth: ?secret=<CRON_SECRET> o header x-cron-secret (o Authorization: Bearer) —
// MISMO patrón que /api/cron/booking-recordatorios (fail-closed en producción).
//
// Params de prueba:
//   ?mes=YYYY-MM        → fuerza ese mes (por defecto, el mes anterior a hoy).
//   ?force=1           → reenvía aunque ya se hubiera enviado ese mes (salta anti-duplicado).
//   ?preview=<slug>    → devuelve el HTML del informe de ese negocio (no envía, no marca).
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { listBusinesses, getBusinessBySlug, informe } from "@/lib/booking";
import { enviarInformeMensual, construirInformeMensual } from "@/lib/booking-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

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

/** Periodo del mes anterior a `hoy` (o de un `YYYY-MM` explícito). */
function periodoMes(mesParam: string | null): { from: string; to: string; periodoKey: string; label: string } | null {
  let y: number, m0: number; // m0 = mes 0-11
  if (mesParam) {
    const mm = /^(\d{4})-(\d{2})$/.exec(mesParam);
    if (!mm) return null;
    y = Number(mm[1]); m0 = Number(mm[2]) - 1;
    if (m0 < 0 || m0 > 11) return null;
  } else {
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    y = prev.getUTCFullYear(); m0 = prev.getUTCMonth();
  }
  const ultimoDia = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  const mm2 = String(m0 + 1).padStart(2, "0");
  return { from: `${y}-${mm2}-01`, to: `${y}-${mm2}-${String(ultimoDia).padStart(2, "0")}`, periodoKey: `${y}-${mm2}`, label: `${MESES[m0]} ${y}` };
}

async function run(req: Request) {
  const h = await headers();
  if (!authorized(req, h)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const per = periodoMes(url.searchParams.get("mes"));
  if (!per) return NextResponse.json({ ok: false, error: "mes inválido (usa YYYY-MM)" }, { status: 400 });

  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  // Vista previa del HTML de un negocio (no envía, no marca) — para verificar el diseño.
  const previewSlug = url.searchParams.get("preview");
  if (previewSlug) {
    const b = await getBusinessBySlug(previewSlug);
    if (!b) return NextResponse.json({ ok: false, error: "negocio no encontrado" }, { status: 404 });
    const inf = await informe(previewSlug, per.from, per.to);
    const { html } = construirInformeMensual(inf, b, per.label, baseUrl);
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const force = url.searchParams.get("force") === "1";
  const negocios = await listBusinesses();
  const resultados: { slug: string; enviado: boolean; modo: string; to?: string }[] = [];
  let enviados = 0, saltados = 0;

  for (const b of negocios) {
    try {
      const inf = await informe(b.slug, per.from, per.to);
      const r = await enviarInformeMensual(b, inf, per.periodoKey, per.label, baseUrl, { force });
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
