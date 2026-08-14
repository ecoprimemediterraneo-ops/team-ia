// GET /api/admin/supabase-estado — founder-only. SOLO LEE.
//
// Contesta desde DENTRO de producción lo que desde fuera no se puede saber: a
// qué proyecto de Supabase está escribiendo la aplicación, si responde, si la
// clave sirve y si existe el bucket de facturas.
//
// Existe porque en agosto de 2026 nos quedamos sin saberlo: `SUPABASE_URL` y
// `SUPABASE_SERVICE_KEY` están marcadas como sensibles en Vercel, así que ni la
// CLI ni el panel las devuelven, y la cuenta de Supabase que teníamos a mano no
// tenía ningún proyecto. La aplicación sí sabe a dónde escribe: basta con
// preguntárselo.
//
// NUNCA devuelve la clave. Del proyecto devuelve el host —que es lo que hace
// falta para encontrarlo en Supabase— y de la clave solo si está y cuánto mide.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { supabaseEnabled, kvGet } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "facturas";

export async function GET() {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_KEY || "";

  if (!supabaseEnabled()) {
    return NextResponse.json({
      ok: false,
      modo: "SIN SUPABASE — se guarda en ficheros locales",
      aviso:
        "En Vercel el disco es de solo lectura salvo /tmp, así que escribir fallaría. " +
        "Si sale esto en producción, no se está guardando nada.",
      url: url || null,
      clave: key ? `${key.length} caracteres` : "no puesta",
    });
  }

  const host = (() => { try { return new URL(url).host; } catch { return url; } })();
  const paso: Record<string, unknown> = { proyecto: host, clave: `${key.length} caracteres` };

  // 1. ¿Responde el dominio del proyecto?
  try {
    const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key }, signal: AbortSignal.timeout(8000) });
    paso.dominioResponde = true;
    paso.estadoApi = r.status;
  } catch (e) {
    return NextResponse.json({
      ok: false,
      ...paso,
      dominioResponde: false,
      detalle: e instanceof Error ? e.message : String(e),
      queSeRompe:
        "El proyecto no existe o está pausado. Todo lo que se guarda —tenants, conversaciones, " +
        "citas, facturas, propuestas de Marta— deja de leerse y de escribirse sin dar error.",
    });
  }

  // 2. ¿Sirve la clave? Se pide una clave que sabemos que existe.
  const tenants = await kvGet<Record<string, unknown>>("tenants");
  paso.claveSirve = tenants !== null;
  paso.tenantsGuardados = tenants ? Object.keys(tenants).length : 0;

  // 3. ¿Está el bucket de las facturas, y es privado?
  try {
    const r = await fetch(`${url}/storage/v1/bucket`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    const buckets = r.ok ? ((await r.json()) as Array<{ name: string; public: boolean }>) : [];
    const f = Array.isArray(buckets) ? buckets.find((b) => b.name === BUCKET) : undefined;
    paso.buckets = Array.isArray(buckets) ? buckets.map((b) => `${b.name}${b.public ? " (PÚBLICO)" : ""}`) : [];
    paso.bucketFacturas = f ? (f.public ? "existe pero es PÚBLICO" : "existe y es privado") : "NO EXISTE";
    if (!f) {
      paso.queSeRompe = "Sin el bucket, subir una factura falla y el gestor solo ve 'no se pudieron subir'.";
    }
  } catch (e) {
    paso.buckets = `no se pudo consultar: ${e instanceof Error ? e.message : e}`;
  }

  return NextResponse.json({ ok: paso.claveSirve === true, ...paso });
}
