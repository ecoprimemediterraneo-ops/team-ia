/**
 * Cron diario — lanza el scraping de todas las fuentes activas de Sergio.
 * Registrar en cron-job.org: GET https://aiteam.marketing/api/cron/sergio-scraper
 * Schedule: cada día a las 03:00 UTC
 */
import { NextResponse } from "next/server";
import { scrapeAllActiveSources } from "@/lib/sergio-scraping";
import { cronAuthError } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;


/**
 * ¿Está Sergio listo para trabajar? Necesita el almacén de fuentes (Supabase) y
 * la clave de lectura de webs. Sin eso el cron no puede hacer nada.
 *
 * Se comprueba ANTES de tocar nada para que el cron salga con 200 y un motivo,
 * en vez de lanzar un 500 cada día. Un cron que falla a diario es ruido que
 * acaba tapando los fallos de verdad.
 */
function sergioNoDisponible(): string | null {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return "sin_almacen: faltan SUPABASE_URL / SUPABASE_SERVICE_KEY";
  }
  return null;
}

function faltaFirecrawl(): string | null {
  return process.env.FIRECRAWL_API_KEY ? null : "sin_clave_lectura: falta FIRECRAWL_API_KEY";
}

export async function GET(req: Request) {
  const authErr = cronAuthError(req);
  if (authErr) return authErr;

  const noDisp = sergioNoDisponible() || faltaFirecrawl();
  if (noDisp) {
    console.log(`[cron/sergio] saltado: ${noDisp}`);
    return NextResponse.json({ ok: true, skipped: noDisp });
  }

  try {
    const result = await scrapeAllActiveSources();
    return NextResponse.json({ ok: true, ...result, ts: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
