// El número que lleva la pestaña "Presupuestos y revisiones": revisiones sin
// avisar + presupuestos pendientes. Ruta aparte para no retrasar el resto del
// panel por un dato que solo alimenta un contador.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { candidatosRecall } from "@/lib/recall";
import { presupuestosPendientes } from "@/lib/presupuestos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const ctx = await contextoPanelODefecto();
  if (ctx.perfil.id !== "dental") return NextResponse.json({ ok: false }, { status: 403 });

  const [candidatos, pendientes] = await Promise.all([
    candidatosRecall(ctx.tenantId, { incluirAvisados: false }).catch(() => []),
    presupuestosPendientes(ctx.tenantId).catch(() => []),
  ]);

  return NextResponse.json({
    ok: true,
    revisionesSinAvisar: candidatos.length,
    presupuestosPendientes: pendientes.length,
  });
}
