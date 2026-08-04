// GET/POST /api/cron/informe-mensual — envía el informe UNIFICADO del MES
// ANTERIOR por email al dueño (Resend). Lo dispara el cron de Vercel el día 1 a
// las 11:00 UTC (ver vercel.json); el plan Hobby admite una pasada al día, que
// para un informe mensual sobra.
//
// El informe es uno solo y trae las tres secciones: reservas + valor generado
// por los agentes + contenido publicado por Marta. Se renderiza en
// `informe-unificado.ts`, el MISMO módulo que usa la vista previa de
// /admin/informe → no pueden divergir.
//
// A QUIÉN: a cada negocio de reservas, MÁS a los tenants que no tienen ninguno
// (ver `destinosDelMes`). Antes solo se recorrían negocios, así que un cliente
// sin motor de reservas no recibía nada aunque sus agentes hubieran trabajado.
//
// DOS FRENOS, los dos fail-closed:
//   1. INFORME_MENSUAL_SEND_ENABLED — si no vale "true", se calcula todo y se
//      registra, pero NO sale ningún email.
//   2. Sin datos suficientes no se envía: un informe con todo a cero es un
//      correo que le dice al cliente que su mes ha estado muerto.
// Ninguno de los dos marca el ledger anti-duplicado, así que encender el
// interruptor después sigue permitiendo mandar el informe de ese mes.
//
// Auth: ?secret=<CRON_SECRET> o header x-cron-secret (o Authorization: Bearer) —
// MISMO patrón que /api/cron/booking-recordatorios (fail-closed en producción).
//
// Params de prueba:
//   ?mes=YYYY-MM        → fuerza ese mes (por defecto, el mes anterior a hoy).
//   ?force=1            → reenvía aunque ya se hubiera enviado ese mes (salta anti-duplicado).
//   ?dry=1              → pasada en seco: decide destino por destino y lo cuenta, sin enviar.
//   ?preview=<slug>     → devuelve el HTML del informe de ese negocio (no envía, no marca).
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getBusinessBySlug } from "@/lib/booking";
import {
  periodoMes,
  construirInformeUnificado,
  enviarInformeUnificado,
  prepararInforme,
  destinosDelMes,
  informeMensualSendEnabled,
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
  const dry = url.searchParams.get("dry") === "1";
  const destinos = await destinosDelMes();
  const resultados: Record<string, unknown>[] = [];
  let enviados = 0, saltados = 0;

  for (const d of destinos) {
    const ref = d.tipo === "negocio" ? `negocio:${d.business.slug}` : `tenant:${d.tenant.id}`;
    try {
      if (dry) {
        // Seco: la MISMA decisión que tomaría el envío, sin mandar nada. El HTML
        // no se devuelve aquí (pesa); para verlo, /admin/informe.
        const p = await prepararInforme(d, per, { force });
        saltados++;
        resultados.push({
          ref: p.ref, enviaria: p.enviaria, motivo: p.motivo, to: p.destinatario,
          posts: p.posts, datos: p.sustancia.senales,
        });
        continue;
      }
      const r = await enviarInformeUnificado(d, per, { force });
      if (r.enviado || r.modo === "log_local") enviados++; else saltados++;
      resultados.push(r);
    } catch (e) {
      saltados++;
      resultados.push({ ref, enviado: false, modo: e instanceof Error ? e.message : "error" });
    }
  }

  return NextResponse.json({
    ok: true,
    modo: dry ? "seco (no se ha enviado nada)" : "real",
    envioEncendido: informeMensualSendEnabled(),
    avisoFlag: informeMensualSendEnabled()
      ? undefined
      : "INFORME_MENSUAL_SEND_ENABLED no está en 'true': se ha calculado todo pero no ha salido ningún email.",
    mes: per.label,
    periodo: { from: per.from, to: per.to },
    destinos: destinos.length,
    enviados,
    saltados,
    resultados,
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
