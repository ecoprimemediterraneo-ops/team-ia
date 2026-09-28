// POST /api/carmen/llamar-prueba { telefono } — botón "Probar: que Carmen me llame".
// Demo de venta. Pasa por las mismas reglas que cualquier llamada saliente
// (9–21 h, límite diario, nunca en frío: solo el TEST_PHONE o un contacto real).
import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { lanzarLlamada, estadoProveedor } from "@/lib/carmen-llamadas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSessionLocal())) return NextResponse.json({ ok: false }, { status: 401 });
  const ctx = await contextoPanelODefecto();
  return NextResponse.json({ ok: true, proveedor: estadoProveedor(ctx.tenant), testPhone: !!process.env.TEST_PHONE });
}

export async function POST(req: Request) {
  if (!(await getSessionLocal())) return NextResponse.json({ ok: false }, { status: 401 });
  const ctx = await contextoPanelODefecto();
  const b = (await req.json().catch(() => ({}))) as { telefono?: string };
  const tel = (b.telefono || process.env.TEST_PHONE || "").trim();
  const r = await lanzarLlamada({ tenantId: ctx.tenantId, telefono: tel, motivo: "demo" });
  return NextResponse.json(r);
}
