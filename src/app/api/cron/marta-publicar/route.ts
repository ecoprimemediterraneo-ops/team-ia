/**
 * Cron job: cada hora, ejecuta las reglas de programación de Marta cuya hora
 * local (Europe/Madrid) coincide con AHORA. Por cada regla vencida genera el
 * post (imagen + caption desde la ficha) y crea una PROPUESTA PENDIENTE que el
 * cliente aprueba con un clic en la app (modo "avisar").
 *
 * Configurado en vercel.json:
 *   { "crons": [{ "path": "/api/cron/marta-publicar", "schedule": "0 * * * *" }] }
 *
 * Protección: en Vercel, header Authorization Bearer con CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { runDueSchedules } from "@/lib/marta-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET || "dev-secret"}`;
  if (process.env.VERCEL && auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // baseUrl para que la generación de imágenes construya URLs absolutas.
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const results = await runDueSchedules(baseUrl);
  const createdTotal = results.reduce((acc, r) => acc + r.created, 0);
  return NextResponse.json({ ok: true, ranRules: results.length, createdTotal, results });
}
