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
import { checkCronAuth } from "@/lib/cron-auth";

export async function GET(req: Request) {
  const auth = checkCronAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const res = await publicarPendientes();
  return NextResponse.json({ success: true, resumen: res });
}
