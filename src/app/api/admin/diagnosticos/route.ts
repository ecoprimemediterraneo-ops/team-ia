// Gestión de los diagnósticos captados. FOUNDER-ONLY, las tres verbos.
//
// Existe porque el listado que había (`GET /api/diagnostico`) era público y
// devolvía nombre, email, web e Instagram de todo el mundo. Aquel se ha cerrado;
// éste nace ya cerrado y además permite limpiar.
//
// NADA SE BORRA SOLO. `?spam=1` solo SUGIERE, con el motivo de cada sospecha, y
// el borrado es de uno en uno y explícito. Un criterio heurístico equivocado
// aquí significa tirar a un cliente real a la papelera.
//
//   GET    /api/admin/diagnosticos            → todos, con su veredicto
//   GET    /api/admin/diagnosticos?spam=1     → solo los sospechosos
//   POST   /api/admin/diagnosticos            {id, spam:true|false} → marcar
//   DELETE /api/admin/diagnosticos?id=<id>    → borrar UNO

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { listarDiagnosticos, marcarSpam, borrarDiagnostico, motivosDeSpam } from "@/lib/diagnostico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await requireFounder();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const soloSpam = new URL(req.url).searchParams.get("spam") === "1";
  const todos = await listarDiagnosticos();

  const items = todos.map((d) => {
    const motivos = motivosDeSpam(d);
    return {
      id: d.id,
      fecha: d.createdAt,
      negocio: d.nombre,
      email: d.email,
      web: d.web,
      instagram: d.instagram,
      sector: d.sector,
      // Marca manual del fundador, si la hay.
      spam: d.spam,
      // Sospecha automática, que es OTRA cosa: sugerencia, no veredicto.
      sospechoso: motivos.length > 0,
      motivos,
    };
  });

  const filtrados = soloSpam ? items.filter((i) => i.sospechoso || i.spam) : items;
  return NextResponse.json({
    ok: true,
    total: todos.length,
    sospechosos: items.filter((i) => i.sospechoso).length,
    marcadosSpam: items.filter((i) => i.spam).length,
    items: filtrados,
  });
}

export async function POST(req: Request) {
  const a = await requireFounder();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const body = (await req.json().catch(() => ({}))) as { id?: string; spam?: boolean };
  if (!body.id) return NextResponse.json({ ok: false, error: "falta id" }, { status: 400 });

  const ok = await marcarSpam(body.id, body.spam !== false);
  return ok
    ? NextResponse.json({ ok: true, id: body.id, spam: body.spam !== false })
    : NextResponse.json({ ok: false, error: "no encontrado" }, { status: 404 });
}

export async function DELETE(req: Request) {
  const a = await requireFounder();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Falta ?id=. El borrado es de uno en uno a propósito: no hay barrido masivo." },
      { status: 400 },
    );
  }
  const ok = await borrarDiagnostico(id);
  return ok
    ? NextResponse.json({ ok: true, borrado: id })
    : NextResponse.json({ ok: false, error: "no encontrado" }, { status: 404 });
}
