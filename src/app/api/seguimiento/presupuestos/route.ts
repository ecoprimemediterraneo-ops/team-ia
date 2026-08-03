// API del seguimiento de presupuestos del panel.
//
// GET    → los presupuestos del tenant que mira quien ha entrado.
// POST   → apunta uno nuevo.
// PATCH  → cambia el estado (aceptado / ejecutado / descartado).
// DELETE → lo borra.
//
// AISLAMIENTO: el tenant SIEMPRE sale de `resolverContextoPanel()`, nunca del
// body ni del email de login. Si alguien manda un `tenantId` en la petición, se
// ignora: no hay forma de escribir en el panel de otro cliente.

import { NextResponse } from "next/server";
import { resolverContextoPanel } from "@/lib/panel-contexto";
import {
  listarPresupuestos,
  crearPresupuesto,
  cambiarEstado,
  borrarPresupuesto,
  presupuestosPendientes,
  type EstadoPresupuesto,
} from "@/lib/presupuestos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ESTADOS: EstadoPresupuesto[] = ["dado", "aceptado", "ejecutado", "descartado"];

async function tenant(): Promise<string | null> {
  const ctx = await resolverContextoPanel();
  return ctx?.tenantId ?? null;
}

export async function GET() {
  const tenantId = await tenant();
  if (!tenantId) return NextResponse.json({ ok: false, error: "sin_sesion" }, { status: 401 });
  const [lista, pendientes] = await Promise.all([
    listarPresupuestos(tenantId),
    presupuestosPendientes(tenantId),
  ]);
  return NextResponse.json({ ok: true, presupuestos: lista, pendientes: pendientes.map((p) => p.id) });
}

export async function POST(req: Request) {
  const tenantId = await tenant();
  if (!tenantId) return NextResponse.json({ ok: false, error: "sin_sesion" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    nombre?: string;
    telefono?: string;
    concepto?: string;
    importeEUR?: number | string;
    nota?: string;
  };
  const nombre = (body.nombre || "").trim();
  const telefono = (body.telefono || "").trim();
  const concepto = (body.concepto || "").trim();
  if (!nombre || !concepto) {
    return NextResponse.json({ ok: false, error: "faltan_datos" }, { status: 400 });
  }

  const importe = Number(body.importeEUR);
  const p = await crearPresupuesto({
    tenantId,
    paciente: { nombre, telefono },
    concepto,
    importeEUR: Number.isFinite(importe) && importe > 0 ? importe : undefined,
    nota: (body.nota || "").trim() || undefined,
  });
  return NextResponse.json({ ok: true, presupuesto: p });
}

export async function PATCH(req: Request) {
  const tenantId = await tenant();
  if (!tenantId) return NextResponse.json({ ok: false, error: "sin_sesion" }, { status: 401 });

  const { id, estado } = (await req.json().catch(() => ({}))) as { id?: string; estado?: string };
  if (!id || !estado || !ESTADOS.includes(estado as EstadoPresupuesto)) {
    return NextResponse.json({ ok: false, error: "datos_invalidos" }, { status: 400 });
  }
  const p = await cambiarEstado(tenantId, id, estado as EstadoPresupuesto);
  if (!p) return NextResponse.json({ ok: false, error: "no_existe" }, { status: 404 });
  return NextResponse.json({ ok: true, presupuesto: p });
}

export async function DELETE(req: Request) {
  const tenantId = await tenant();
  if (!tenantId) return NextResponse.json({ ok: false, error: "sin_sesion" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ ok: false, error: "falta_id" }, { status: 400 });
  const ok = await borrarPresupuesto(tenantId, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
