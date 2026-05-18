/**
 * Cron job: cada hora, dispara publicaciones cuya fechaProgramada ya pasó.
 *
 * Configurar en vercel.json:
 *   { "crons": [{ "path": "/api/cron/publicar", "schedule": "0 * * * *" }] }
 *
 * Protección: header Authorization Bearer con CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { publicarPendientes } from "@/lib/redes";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET || "dev-secret"}`;
  if (process.env.VERCEL && auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const res = await publicarPendientes();
  return NextResponse.json({ success: true, resumen: res });
}
