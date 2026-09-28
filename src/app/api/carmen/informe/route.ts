// POST /api/carmen/informe — "Enviar informe ahora" del panel (y lo que usa el cron del lunes).
// GET  /api/carmen/informe — solo calcula, no manda.
import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { informeSemanal, avisarAlDueno } from "@/lib/carmen-llamadas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSessionLocal())) return NextResponse.json({ ok: false }, { status: 401 });
  const ctx = await contextoPanelODefecto();
  return NextResponse.json({ ok: true, informe: await informeSemanal(ctx.tenantId) });
}

export async function POST() {
  if (!(await getSessionLocal())) return NextResponse.json({ ok: false }, { status: 401 });
  const ctx = await contextoPanelODefecto();
  const inf = await informeSemanal(ctx.tenantId);
  const envio = await avisarAlDueno(ctx.tenantId, inf.texto, process.env.CARMEN_INFORME_TEMPLATE
    ? { nombre: process.env.CARMEN_INFORME_TEMPLATE, variables: [String(inf.llamadas), String(inf.citas), String(inf.rescatadas), String(inf.euros)] }
    : undefined);
  return NextResponse.json({ ok: true, informe: inf, envio });
}
