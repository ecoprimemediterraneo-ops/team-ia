// La agenda del gestor: obligaciones y reclamaciones por fecha límite.
//
//   GET                          la lista, ordenada
//   POST {id, hecho}             marcar/desmarcar hecho (mismo almacén que HOY)
//   POST {asignar:{id,clienteId}} decir de quién es una que entró sin dueño
//   DELETE ?id=                  quitar una obligación apuntada

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { construirAgenda, agruparAgenda, asignarObligacion, borrarObligacion } from "@/lib/gestoria-obligaciones";
import { marcarHecho } from "@/lib/gestoria-hoy";
import { listarClientes } from "@/lib/gestoria-clientes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guardia() {
  const s = await getSessionLocal();
  if (!s) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar en el panel." }, { status: 401 }),
    };
  }
  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return { ok: false as const, res: NextResponse.json({ error: "Esto es para gestorías." }, { status: 403 }) };
  }
  return { ok: true as const, tenantId: ctx.tenantId };
}

export async function GET(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;

  const incluirHechas = new URL(req.url).searchParams.get("hechas") === "1";
  const [lineas, clientes] = await Promise.all([
    construirAgenda(g.tenantId, { incluirHechas }),
    listarClientes(g.tenantId).catch(() => []),
  ]);

  const vivas = lineas.filter((l) => !l.hecho);
  return NextResponse.json({
    ok: true,
    lineas,
    // Las mismas líneas, con lo repetido agrupado. La pantalla pinta esto; se
    // mandan las dos porque `lineas` sigue siendo lo que usan los contadores.
    filas: agruparAgenda(lineas),
    clientes: clientes.map((c) => ({ id: c.id, nombre: c.nombre })),
    resumen: {
      total: vivas.length,
      vencidas: vivas.filter((l) => l.apremio === "vencido").length,
      rojas: vivas.filter((l) => l.apremio === "rojo").length,
      ambar: vivas.filter((l) => l.apremio === "ambar").length,
      sinFecha: vivas.filter((l) => l.apremio === "sin_fecha").length,
      criticas: vivas.filter((l) => l.critico).length,
      sinCliente: vivas.filter((l) => l.sinCliente).length,
    },
  });
}

export async function POST(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    hecho?: boolean;
    asignar?: { id: string; clienteId: string };
  };

  if (body.asignar?.id && body.asignar.clienteId) {
    const clientes = await listarClientes(g.tenantId);
    const c = clientes.find((x) => x.id === body.asignar!.clienteId);
    if (!c) return NextResponse.json({ error: "Ese cliente no está en esta gestoría." }, { status: 404 });
    await asignarObligacion(g.tenantId, body.asignar.id, c.id, c.nombre);
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    // Va al MISMO almacén que HOY: marcarlo aquí lo marca allí.
    await marcarHecho(g.tenantId, body.id, body.hecho !== false);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Dime qué hay que hacer." }, { status: 400 });
}

export async function DELETE(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  await borrarObligacion(g.tenantId, id);
  return NextResponse.json({ ok: true });
}
