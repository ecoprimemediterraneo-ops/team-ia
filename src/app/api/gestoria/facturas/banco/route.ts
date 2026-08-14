// Importación del extracto bancario (Norma 43) y cruce automático.
//
// El flujo entero en una petición: parsear → descartar duplicados → guardar con
// un lote_id → cruzar contra el saco de facturas de ese cliente. Se devuelve el
// CONTROL del fichero (movimientos, rango de fechas, cargos y suma) porque es lo
// único que permite decir "esto que he subido es lo que yo creía".

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { parseNorma43, huellaMovimiento, contarPorHuella } from "@/lib/norma43";
import {
  listarMovimientos, guardarMovimientos, listarFacturas, guardarFacturas,
  type MovimientoBanco,
} from "@/lib/gestoria-facturas";
import { cruzar } from "@/lib/gestoria-conciliacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ctx = await contextoPanelODefecto();
  const tenantId = ctx.tenantId;

  try {
    const form = await req.formData();
    const clienteId = String(form.get("clienteId") || "").trim();
    const fichero = form.get("fichero");
    if (!clienteId) return NextResponse.json({ error: "falta clienteId" }, { status: 400 });
    if (!(fichero instanceof File)) return NextResponse.json({ error: "falta el fichero" }, { status: 400 });

    const buf = Buffer.from(await fichero.arrayBuffer());
    const { movimientos, control } = parseNorma43(buf);

    if (!movimientos.length) {
      return NextResponse.json(
        { error: "No se ha leído ningún movimiento. ¿Seguro que es un fichero Norma 43?", control },
        { status: 400 },
      );
    }

    // --- Duplicados por fecha + importe + concepto, CONTANDO ocurrencias ---
    // Volver a subir un fichero con fechas solapadas es lo normal (el banco los
    // da por trimestres que se pisan). Lo que no puede pasar es duplicar apuntes.
    //
    // Pero tampoco puede pasar lo contrario, que es lo que pasaba: tres compras
    // iguales el mismo día en el mismo sitio comparten huella y son TRES cargos.
    // Por eso se compara cuántas hay guardadas contra cuántas trae el fichero, y
    // solo sobra a partir de la que ya estaba.
    const yaGuardados = await listarMovimientos(tenantId, clienteId);
    const guardadasPorHuella = contarPorHuella(yaGuardados);
    const vistasEnFichero = new Map<string, number>();

    const loteId = `lote_${Date.now().toString(36)}`;
    const ahora = new Date().toISOString();
    const nuevos: MovimientoBanco[] = [];
    let duplicados = 0;

    for (const m of movimientos) {
      const huella = huellaMovimiento(m);
      const n = (vistasEnFichero.get(huella) ?? 0) + 1;
      vistasEnFichero.set(huella, n);
      if (n <= (guardadasPorHuella.get(huella) ?? 0)) { duplicados++; continue; }
      nuevos.push({
        id: `mov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        tenant_id: tenantId,
        cliente_id: clienteId,
        fecha: m.fecha,
        signo: m.signo,
        importe: m.importe,
        concepto: m.concepto,
        referencia: m.referencia,
        estado: "sin_factura",
        factura_id: null,
        lote_id: loteId,
        fecha_importacion: ahora,
      });
    }

    // --- Guardar y cruzar ---
    const todosDelTenant = await listarMovimientos(tenantId);
    const trasGuardar = [...todosDelTenant, ...nuevos];

    const facturas = await listarFacturas(tenantId, clienteId);
    const delCliente = trasGuardar.filter((m) => m.cliente_id === clienteId);
    const cruce = cruzar(delCliente, facturas);

    // Enlace en los dos sentidos, solo para los automáticos. Las sugerencias no
    // se tocan: las confirma el gestor.
    const movConciliado = new Map(cruce.automaticos.map((a) => [a.movimiento.id, a.factura.id]));
    const facConciliada = new Map(cruce.automaticos.map((a) => [a.factura.id, a.movimiento.id]));

    await guardarMovimientos(
      tenantId,
      trasGuardar.map((m) =>
        movConciliado.has(m.id)
          ? { ...m, estado: "conciliado" as const, factura_id: movConciliado.get(m.id)! }
          : m,
      ),
    );

    const todasFacturas = await listarFacturas(tenantId);
    await guardarFacturas(
      tenantId,
      todasFacturas.map((f) =>
        facConciliada.has(f.id)
          ? { ...f, estado: "conciliada" as const, movimiento_id: facConciliada.get(f.id)! }
          : f,
      ),
    );

    return NextResponse.json({
      ok: true,
      loteId,
      // El control del fichero, para que el gestor compare con su extracto.
      control,
      importados: nuevos.length,
      duplicadosDescartados: duplicados,
      cruce: {
        conciliadosAutomaticamente: cruce.automaticos.length,
        sugerencias: cruce.sugerencias.length,
        cargosSinFactura: cruce.sinFactura.length,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
