/**
 * Cron job: una vez al día (plan Hobby de Vercel). Ejecuta las reglas de
 * programación de Marta cuyo día de la semana es HOY (Europe/Madrid). Por cada
 * regla vencida genera el post (imagen + caption desde la ficha) y crea una
 * PROPUESTA PENDIENTE que el cliente aprueba con un clic en la app (modo
 * "avisar"). El guard lastRunDate evita duplicados.
 *
 * Configurado en vercel.json:
 *   { "crons": [{ "path": "/api/cron/marta-publicar", "schedule": "0 8 * * *" }] }
 *   (08:00 UTC ≈ 10:00 España en verano / 09:00 en invierno.)
 *
 * Para hora exacta por cliente hace falta plan Pro (cron horario): poner
 * CRON_GRANULARITY="hourly" en marta-schedule.ts y schedule "0 * * * *".
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
