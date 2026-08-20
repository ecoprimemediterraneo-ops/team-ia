// Las ventas del cliente: subir el listado y ver el cruce con los abonos.
//
//   GET  ?clienteId=…   el cruce ya hecho
//   POST multipart      sube el listado (Excel, CSV o PDF) y lo importa
//   PATCH               enlaza un abono con una factura emitida, o lo descarta

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { listarMovimientos, guardarMovimientos } from "@/lib/gestoria-facturas";
import {
  leerListadoVentas, importarVentas, listarVentas, guardarVentas,
} from "@/lib/gestoria-ventas";
import { cruzarVentas, resumenVentas } from "@/lib/gestoria-conciliacion-ventas";
import { ETIQUETA_INGRESO } from "@/lib/gestoria-ingresos";
import { anotarLectura } from "@/lib/gestoria-coste";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function guardia() {
  const s = await getSessionLocal();
  if (!s) return { ok: false as const, res: NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar en el panel." }, { status: 401 }) };
  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return { ok: false as const, res: NextResponse.json({ error: "no es una gestoría" }, { status: 403 }) };
  }
  return { ok: true as const, tenantId: ctx.tenantId };
}

export async function GET(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;
  const clienteId = new URL(req.url).searchParams.get("clienteId") || "";
  if (!clienteId) return NextResponse.json({ error: "falta clienteId" }, { status: 400 });

  const movimientos = await listarMovimientos(g.tenantId, clienteId);
  const ventas = await listarVentas(g.tenantId, clienteId);
  const r = cruzarVentas(movimientos, ventas);

  return NextResponse.json({
    resumen: resumenVentas(r),
    ventas: ventas.length,
    sinFactura: r.sinFactura.map((x) => ({
      id: x.movimiento.id, fecha: x.movimiento.fecha, importe: x.movimiento.importe,
      concepto: x.movimiento.concepto,
      grupo: x.grupo, etiqueta: x.grupo ? ETIQUETA_INGRESO[x.grupo] : null,
      fueraDelPeriodo: x.fueraDelPeriodo,
    })),
    sugerencias: r.sugerencias.map((s) => ({
      id: s.movimiento.id, fecha: s.movimiento.fecha, importe: s.movimiento.importe,
      concepto: s.movimiento.concepto, motivo: s.motivo,
      candidatas: s.candidatas.map((v) => ({ id: v.id, numero: v.numero, fecha: v.fecha, total: v.total, destinatario: v.destinatario })),
    })),
    cuadrados: r.automaticos.map((a) => ({
      id: a.movimiento.id, fecha: a.movimiento.fecha, importe: a.movimiento.importe,
      concepto: a.movimiento.concepto, numero: a.venta.numero, fechaFactura: a.venta.fecha,
    })),
    sinCobrar: r.sinCobrar.map((v) => ({
      id: v.id, numero: v.numero, fecha: v.fecha, total: v.total, destinatario: v.destinatario,
    })),
  });
}

export async function POST(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;
  try {
    const form = await req.formData();
    const clienteId = String(form.get("clienteId") || "").trim();
    const f = form.get("listado");
    if (!clienteId) return NextResponse.json({ error: "falta clienteId" }, { status: 400 });
    if (!(f instanceof File)) return NextResponse.json({ error: "no llegó ningún listado" }, { status: 400 });

    const contenido = Buffer.from(await f.arrayBuffer());
    const r = await leerListadoVentas({ contenido, mime: f.type || "", nombre: f.name });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });

    if (r.lectura.tokens) {
      await anotarLectura({
        tenantId: g.tenantId, modelo: r.lectura.modelo,
        entrada: r.lectura.tokens.entrada, salida: r.lectura.tokens.salida,
      });
    }

    const imp = await importarVentas({ tenantId: g.tenantId, clienteId, lineas: r.lectura.lineas });

    return NextResponse.json({
      ok: true,
      leidas: r.lectura.lineas.length,
      creadas: imp.creadas,
      repetidas: imp.repetidas,
      formato: r.lectura.formato,
      columnas: r.lectura.columnas,
      descartadas: r.lectura.descartadas,
      // Las primeras líneas, para que el gestor vea qué ha entendido antes de
      // fiarse del cruce.
      muestra: r.lectura.lineas.slice(0, 10),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as {
    movimientoId?: string; ventaId?: string; accion?: "enlazar" | "no_es_venta";
  };
  if (!body.movimientoId) return NextResponse.json({ error: "falta movimientoId" }, { status: 400 });

  const movimientos = await listarMovimientos(g.tenantId);
  const im = movimientos.findIndex((m) => m.id === body.movimientoId);
  if (im < 0) return NextResponse.json({ error: "movimiento no encontrado" }, { status: 404 });

  if (body.accion === "no_es_venta") {
    // "Ignorado" es el mismo estado que ya usan los cargos que no corresponden:
    // no se inventa un estado nuevo para decir lo mismo.
    movimientos[im] = { ...movimientos[im], estado: "ignorado" };
    await guardarMovimientos(g.tenantId, movimientos);
    return NextResponse.json({ ok: true });
  }

  if (!body.ventaId) return NextResponse.json({ error: "falta ventaId" }, { status: 400 });
  const ventas = await listarVentas(g.tenantId);
  const iv = ventas.findIndex((v) => v.id === body.ventaId);
  if (iv < 0) return NextResponse.json({ error: "factura emitida no encontrada" }, { status: 404 });

  ventas[iv] = { ...ventas[iv], estado: "conciliada", movimiento_id: body.movimientoId };
  movimientos[im] = { ...movimientos[im], estado: "conciliado" };
  await guardarVentas(g.tenantId, ventas);
  await guardarMovimientos(g.tenantId, movimientos);
  return NextResponse.json({ ok: true });
}
