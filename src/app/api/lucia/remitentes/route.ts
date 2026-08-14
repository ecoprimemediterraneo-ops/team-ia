// La lista de remitentes importantes del tenant: ver, añadir, editar y borrar.
//
// Los cuatro verbos exigen sesión y trabajan SIEMPRE dentro del tenant del
// panel. El tenant NO se acepta por parámetro: si viniera de fuera, cualquiera
// con sesión podría leer —o reescribir— la lista de otra gestoría cambiando un
// id en la URL.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import {
  listarRemitentes, anadirRemitente, editarRemitente, borrarRemitente, restaurarOficiales,
  type NivelAviso,
} from "@/lib/lucia-remitentes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guardia() {
  const s = await getSessionLocal();
  if (!s) return { ok: false as const, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const ctx = await contextoPanelODefecto();
  return { ok: true as const, tenantId: ctx.tenantId };
}

const nivelValido = (n: unknown): NivelAviso => (n === "critico" ? "critico" : "importante");

export async function GET() {
  const g = await guardia();
  if (!g.ok) return g.res;
  const remitentes = await listarRemitentes(g.tenantId);
  return NextResponse.json({ ok: true, total: remitentes.length, remitentes });
}

export async function POST(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as {
    patron?: string; etiqueta?: string; nivel?: string; restaurar?: boolean;
  };

  try {
    // Volver a la precarga oficial. Va aquí y no en un DELETE porque no borra:
    // reemplaza la lista entera por la de fábrica.
    if (body.restaurar) {
      const remitentes = await restaurarOficiales(g.tenantId);
      return NextResponse.json({ ok: true, remitentes });
    }
    const remitentes = await anadirRemitente(g.tenantId, {
      patron: body.patron ?? "",
      etiqueta: body.etiqueta ?? "",
      nivel: nivelValido(body.nivel),
    });
    return NextResponse.json({ ok: true, remitentes });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as {
    id?: string; patron?: string; etiqueta?: string; nivel?: string;
  };
  if (!body.id) return NextResponse.json({ error: "falta id" }, { status: 400 });

  const remitentes = await editarRemitente(g.tenantId, body.id, {
    patron: body.patron,
    etiqueta: body.etiqueta,
    nivel: body.nivel === undefined ? undefined : nivelValido(body.nivel),
  });
  return NextResponse.json({ ok: true, remitentes });
}

export async function DELETE(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });

  const remitentes = await borrarRemitente(g.tenantId, id);
  return NextResponse.json({ ok: true, remitentes });
}
