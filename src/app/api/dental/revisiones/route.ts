// Marcar o programar un aviso de revisión desde el panel — mismo motor que
// usa el chat (`dental-acciones.ts`), para que "márcalo desde la pestaña" y
// "márcalo hablando con el chat" hagan exactamente lo mismo.
//
// PATCH { clave, modo: "enviado" }              → marcado a mano, sin WhatsApp real.
// PATCH { clave, modo: "programado", fecha }     → programado para esa fecha.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { candidatosRecall, marcarRevisionAvisadaManual } from "@/lib/recall";
import { programarAviso, quitarProgramacion, listarProgramaciones } from "@/lib/recall-programado";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const ctx = await contextoPanelODefecto();
  if (ctx.perfil.id !== "dental") return NextResponse.json({ ok: false }, { status: 403 });
  const programaciones = await listarProgramaciones(ctx.tenantId);
  return NextResponse.json({ ok: true, programaciones });
}

export async function PATCH(req: Request) {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ ok: false, error: "sin_sesion" }, { status: 401 });
  const ctx = await contextoPanelODefecto();
  if (ctx.perfil.id !== "dental") return NextResponse.json({ ok: false, error: "solo_dental" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { clave?: string; modo?: string; fecha?: string };
  const clave = (body.clave || "").trim();
  if (!clave) return NextResponse.json({ ok: false, error: "falta_clave" }, { status: 400 });

  if (body.modo === "programado") {
    const fecha = (body.fecha || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ ok: false, error: "fecha_invalida" }, { status: 400 });
    }
    await programarAviso(ctx.tenantId, clave, fecha);
    return NextResponse.json({ ok: true });
  }

  if (body.modo === "quitar_programacion") {
    await quitarProgramacion(ctx.tenantId, clave);
    return NextResponse.json({ ok: true });
  }

  // modo "enviado" (por defecto): marcado a mano, el candidato tiene que
  // existir de verdad y ser de ESTE tenant — no se marca a ciegas por clave.
  const candidatos = await candidatosRecall(ctx.tenantId, { incluirAvisados: true });
  const c = candidatos.find((x) => x.clave === clave);
  if (!c) return NextResponse.json({ ok: false, error: "no_existe" }, { status: 404 });
  await marcarRevisionAvisadaManual(ctx.tenantId, c);
  return NextResponse.json({ ok: true });
}
