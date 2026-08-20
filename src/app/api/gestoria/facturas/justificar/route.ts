// "La tengo yo": Jose sube ahí mismo la factura de un cargo concreto.
//
// Sube y enlaza en un solo paso. Es la diferencia entre subirla al saco —donde
// tendría que esperar a la siguiente pasada y a que el cruce la encuentre— y
// decir "esta factura es la de ESTE cargo". Lo segundo lo sabe él con la
// factura en la mano; el algoritmo no tiene por qué adivinarlo.
//
// El importe y la fecha se toman DEL CARGO, no de la factura: no hay OCR, y si
// el gestor dice que ese papel justifica ese cargo, el importe justificado es el
// que el banco cobró.

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
  if (!s) return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar en el panel." }, { status: 401 });
  const ctx = await contextoPanelODefecto();

  try {
    const form = await req.formData();
    const movimientoId = String(form.get("movimientoId") || "").trim();
    const fichero = form.get("fichero");
    if (!movimientoId) return NextResponse.json({ error: "falta movimientoId" }, { status: 400 });
    if (!(fichero instanceof File)) return NextResponse.json({ error: "no ha llegado la factura" }, { status: 400 });

    const movs = await listarMovimientos(ctx.tenantId);
    const mov = movs.find((m) => m.id === movimientoId);
    if (!mov) return NextResponse.json({ error: "no encontrado" }, { status: 404 });

    const factura = await crearFactura({
      tenantId: ctx.tenantId,
      clienteId: mov.cliente_id,
      origen: "manual",
      nombre: fichero.name || "factura",
      contenido: Buffer.from(await fichero.arrayBuffer()),
      mime: fichero.type || "",
      importe: mov.importe,
      fechaFactura: mov.fecha,
      notas: `Subida por el gestor para justificar el cargo de ${mov.fecha}`,
    });

    // Enlace en los dos sentidos, igual que hace el cruce automático.
    const facturas = await listarFacturas(ctx.tenantId);
    await guardarFacturas(
      ctx.tenantId,
      facturas.map((f) =>
        f.id === factura.id ? { ...f, estado: "conciliada" as const, movimiento_id: mov.id } : f,
      ),
    );
    await guardarMovimientos(
      ctx.tenantId,
      movs.map((m) =>
        m.id === mov.id
          ? {
              ...m,
              estado: "conciliado" as const,
              factura_id: factura.id,
              motivo: "la_tengo" as const,
              motivo_en: new Date().toISOString(),
              ...((m.veces_sin_justificar ?? 0) > 0 ? { resuelto_tras: m.veces_sin_justificar } : {}),
            }
          : m,
      ),
    );

    return NextResponse.json({ ok: true, facturaId: factura.id, movimientoId: mov.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
