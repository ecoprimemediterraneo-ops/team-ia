// Mover un cargo de bloque, a mano.
//
// Del 3 al 2: "esto sí lleva factura". Del 2 al 3: "esto no lleva factura".
//
// Y se APRENDE. Mover el mismo concepto cada mes es trabajo que el sistema le
// está pasando al gestor: la primera vez que dice dónde va un concepto, ese
// concepto queda colocado para ese cliente. Por cliente y no global, porque el
// mismo literal puede significar cosas distintas en dos negocios.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { listarMovimientos, guardarMovimientos, aprenderConcepto } from "@/lib/gestoria-facturas";
import { normalizar } from "@/lib/gestoria-clasificacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ctx = await contextoPanelODefecto();

  const body = (await req.json().catch(() => ({}))) as {
    movimientoId?: string;
    destino?: "lleva" | "no_lleva";
    /** false para mover solo ese cargo y no aprender el concepto. */
    aprender?: boolean;
  };
  if (!body.movimientoId) return NextResponse.json({ error: "falta movimientoId" }, { status: 400 });
  if (body.destino !== "lleva" && body.destino !== "no_lleva") {
    return NextResponse.json({ error: "destino no válido" }, { status: 400 });
  }

  const movs = await listarMovimientos(ctx.tenantId);
  const mov = movs.find((m) => m.id === body.movimientoId);
  if (!mov) return NextResponse.json({ error: "no encontrado" }, { status: 404 });

  const destino = body.destino;

  await guardarMovimientos(
    ctx.tenantId,
    movs.map((m) =>
      m.id !== mov.id
        ? m
        : {
            ...m,
            bloque_manual: destino,
            // Al bajarlo al 3 deja de ser un pendiente: ni se reclama ni cuenta.
            // Al subirlo al 2 vuelve al circuito y el próximo cruce lo mirará.
            ...(destino === "no_lleva"
              ? { estado: "sin_factura" as const, motivo: "no_corresponde" as const, motivo_en: new Date().toISOString() }
              : { motivo: undefined, motivo_en: undefined }),
          },
    ),
  );

  if (body.aprender !== false) {
    await aprenderConcepto(ctx.tenantId, mov.cliente_id, normalizar(mov.concepto), destino);
  }

  return NextResponse.json({ ok: true, movimientoId: mov.id, destino, aprendido: body.aprender !== false });
}
