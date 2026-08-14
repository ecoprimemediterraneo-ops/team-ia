// Exportación de las facturas conciliadas de un cliente y un periodo.
//
// PENSADA PARA ENCHUFARLE EL FORMATO DE BILKY CUANDO SE CONOZCA. La función
// `construirExportacion` recibe la lista y el periodo y devuelve un fichero;
// cambiar de CSV al formato de Bilky es cambiar ESA función y nada más.
//
// NO hay ninguna integración con Bilky ni se llama a ninguna API suya: no
// conocemos su formato y inventárselo sería peor que no tenerlo.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { listarFacturas, listarMovimientos, urlFirmada } from "@/lib/gestoria-facturas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Escapa un campo CSV: comillas dobles y separador. */
const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ctx = await contextoPanelODefecto();

  const p = new URL(req.url).searchParams;
  const clienteId = p.get("clienteId") || "";
  const desde = p.get("desde") || "0000-01-01";
  const hasta = p.get("hasta") || "9999-12-31";
  if (!clienteId) return NextResponse.json({ error: "falta clienteId" }, { status: 400 });

  const facturas = (await listarFacturas(ctx.tenantId, clienteId)).filter(
    // Los justificantes (un modelo presentado, un TC) NO son facturas y no
    // salen aquí: no son justificación contable de un gasto de proveedor.
    (f) => !f.es_justificante && f.estado === "conciliada" &&
      (f.fecha_factura ?? "") >= desde && (f.fecha_factura ?? "") <= hasta,
  );
  const movimientos = await listarMovimientos(ctx.tenantId, clienteId);
  const porId = new Map(movimientos.map((m) => [m.id, m]));

  const filas = [["fecha", "concepto", "importe", "enlace"].map(csv).join(",")];
  for (const f of facturas) {
    const mov = f.movimiento_id ? porId.get(f.movimiento_id) : undefined;
    const enlace = (await urlFirmada(f.fichero_url)) ?? "";
    filas.push([
      csv(f.fecha_factura ?? mov?.fecha ?? ""),
      csv(mov?.concepto || f.proveedor || f.nombre_original),
      csv((f.importe ?? mov?.importe ?? 0).toFixed(2)),
      csv(enlace),
    ].join(","));
  }

  // BOM para que Excel en español abra el CSV con los acentos bien.
  const cuerpo = "﻿" + filas.join("\r\n");
  return new NextResponse(cuerpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="facturas-${clienteId}-${desde}_${hasta}.csv"`,
    },
  });
}
