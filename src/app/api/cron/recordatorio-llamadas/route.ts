// Cada hora (desde n8n, con CRON_SECRET): Carmen llama a quien recibió el
// recordatorio por WhatsApp hace más de 3 h y no ha confirmado. Ver
// `pasadaLlamadasRecordatorio`. Sin Retell configurado, todo queda en modo prueba.
import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { pasadaLlamadasRecordatorio } from "@/lib/carmen-llamadas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(req: Request) {
  const err = cronAuthError(req);
  if (err) return err;
  return NextResponse.json({ ok: true, ...(await pasadaLlamadasRecordatorio()) });
}
export const GET = run;
export const POST = run;
