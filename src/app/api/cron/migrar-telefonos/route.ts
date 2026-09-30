// Migración única de teléfonos a E.164 (con CRON_SECRET).
//   sin parámetros → solo cuenta lo que cambiaría;  ?aplicar=1 → escribe.
import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { supabaseEnabled } from "@/lib/supabase";
import { migrarTelefonosE164 } from "@/lib/telefono";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(req: Request) {
  const err = cronAuthError(req);
  if (err) return err;
  if (!supabaseEnabled()) return NextResponse.json({ ok: false, error: "sin Supabase: usa scripts/migrar-telefonos-e164.mjs" }, { status: 400 });
  const aplicar = new URL(req.url).searchParams.get("aplicar") === "1";
  return NextResponse.json({ ok: true, aplicar, ...(await migrarTelefonosE164(aplicar)) });
}
export const GET = run;
export const POST = run;
