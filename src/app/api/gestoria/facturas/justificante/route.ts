// Justificante de un cargo que NO lleva factura de proveedor.
//
// El modelo 303 presentado, el TC de la Seguridad Social, la nómina firmada.
// Papeles que Jose tiene en el despacho y que no se le piden a nadie.
//
// LO QUE UN JUSTIFICANTE NO ES, y conviene que quede escrito:
//   · No es una factura. No entra en el cruce ni cuenta como justificación
//     contable, y no sale en lo que se exporta a Bilky.
//   · No se le reclama al cliente. Nunca sale un WhatsApp por esto.
//   · Es OPCIONAL de verdad. Un cargo del bloque 3 sin justificante no es un
//     pendiente, no cuenta en ningún número y no aparece en ningún aviso.
//
// Un mismo documento puede cubrir VARIOS cargos: un TC cubre todas las cuotas
// del mes. Por eso se puede adjuntar al grupo entero y queda enlazado a todos.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import {
  listarMovimientos, guardarMovimientos, listarFacturas, guardarFacturas, crearFactura,
} from "@/lib/gestoria-facturas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ctx = await contextoPanelODefecto();

  try {
    const form = await req.formData();
    const ids = String(form.get("movimientos") || "").split(",").map((x) => x.trim()).filter(Boolean);
    const fichero = form.get("fichero");
    if (!ids.length) return NextResponse.json({ error: "falta a qué cargos cubre" }, { status: 400 });
    if (!(fichero instanceof File)) return NextResponse.json({ error: "no ha llegado el documento" }, { status: 400 });

    const movs = await listarMovimientos(ctx.tenantId);
    const cubiertos = movs.filter((m) => ids.includes(m.id));
    if (!cubiertos.length) return NextResponse.json({ error: "no encontrados" }, { status: 404 });

    const doc = await crearFactura({
      tenantId: ctx.tenantId,
      clienteId: cubiertos[0].cliente_id,
      origen: "manual",
      nombre: fichero.name || "justificante",
      contenido: Buffer.from(await fichero.arrayBuffer()),
      mime: fichero.type || "",
      // Sin importe NI fecha a propósito: así jamás puede entrar en el cruce,
      // ni siquiera si alguien cambiase su estado por error.
      notas: `Justificante de ${cubiertos.length} cargo(s) que no llevan factura`,
    });

    const facturas = await listarFacturas(ctx.tenantId);
    await guardarFacturas(
      ctx.tenantId,
      facturas.map((f) =>
        f.id === doc.id
          ? {
              ...f,
              es_justificante: true,
              cubre_movimientos: cubiertos.map((m) => m.id),
              // "descartada" lo deja fuera del cruce y de la exportación por el
              // mismo camino que ya usaba todo lo que no debe cruzarse.
              estado: "descartada" as const,
            }
          : f,
      ),
    );

    await guardarMovimientos(
      ctx.tenantId,
      movs.map((m) => (ids.includes(m.id) ? { ...m, justificante_id: doc.id } : m)),
    );

    return NextResponse.json({ ok: true, justificanteId: doc.id, cubre: cubiertos.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
