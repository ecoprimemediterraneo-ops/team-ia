// CONCILIAR — el botón.
//
// Antes el cruce era un efecto secundario de importar el extracto: se ejecutaba
// una vez, al subir el fichero, y el resultado se quedaba congelado. Como las
// facturas del cliente van llegando durante semanas, la foto quedaba vieja el
// mismo día: con las facturas cargadas antes daba 10 conciliados y en el orden
// natural —extracto primero, facturas después— daba 0, para siempre.
//
// Ahora el cruce es una acción que Jose lanza cuando quiere, tantas veces como
// quiera. Cada pasada recalcula con lo que haya en ese momento y se anota, para
// que se vea el número bajar: "24 feb: 5 · 26 feb: 2 · 2 mar: 1".
//
// QUÉ SE RESPETA ENTRE PASADAS, y no es negociable:
//   · Lo que el gestor ya decidió. Una sugerencia aceptada sigue aceptada; un
//     "no corresponde" no vuelve a aparecer; una factura que él rechazó para un
//     cargo no se le vuelve a proponer.
//   · Los bloqueos. Sin extracto no hay nada que cruzar, y con facturas sin
//     asignar el resultado mentiría: sus cargos saldrían como no justificados.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import {
  listarMovimientos, guardarMovimientos, listarFacturas, guardarFacturas,
  listarSinAsignar, anotarPasada, listarPasadas, listarConceptos,
  type MovimientoBanco, type FacturaRecibida,
} from "@/lib/gestoria-facturas";
import { cruzar } from "@/lib/gestoria-conciliacion";
import { esSinFactura } from "@/lib/gestoria-bloques";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function guardia() {
  const s = await getSessionLocal();
  if (!s) return { ok: false as const, res: NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar en el panel." }, { status: 401 }) };
  const ctx = await contextoPanelODefecto();
  return { ok: true as const, tenantId: ctx.tenantId };
}

/** ¿Este cargo ya está enlazado a una factura que sigue viva? */
const enlaceFirme = (m: MovimientoBanco, porId: Map<string, FacturaRecibida>) =>
  m.estado === "conciliado" &&
  !!m.factura_id &&
  porId.get(m.factura_id)?.estado === "conciliada";

export async function POST(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as { clienteId?: string };
  const clienteId = (body.clienteId || "").trim();
  if (!clienteId) return NextResponse.json({ error: "falta clienteId" }, { status: 400 });

  const todosMovs = await listarMovimientos(g.tenantId);
  const delCliente = todosMovs.filter((m) => m.cliente_id === clienteId);
  if (!delCliente.length) {
    return NextResponse.json(
      { error: "sin_extracto", mensaje: "De este cliente no hay ningún movimiento. Sube antes el extracto del banco." },
      { status: 409 },
    );
  }

  const sinAsignar = await listarSinAsignar(g.tenantId);
  if (sinAsignar.length) {
    return NextResponse.json(
      {
        error: "facturas_sin_asignar",
        sinAsignar: sinAsignar.length,
        mensaje: `Hay ${sinAsignar.length} factura(s) sin asignar a cliente. Asígnalas antes: si no, sus cargos saldrían como no justificados.`,
      },
      { status: 409 },
    );
  }

  const todasFacturas = await listarFacturas(g.tenantId);
  const facturasCliente = todasFacturas.filter((f) => f.cliente_id === clienteId);
  const porId = new Map(todasFacturas.map((f) => [f.id, f]));

  // Desde cero: todo lo que no esté decidido vuelve a la casilla de salida. Lo
  // decidido —enlaces firmes e ignorados— se queda como está.
  const firmes = delCliente.filter((m) => enlaceFirme(m, porId));
  const idsFirmes = new Set(firmes.map((m) => m.id));

  // Los cargos que no llevan factura de proveedor —nóminas, impuestos, multas,
  // comisiones— NO entran en el cruce. No se les puede pedir una factura que no
  // existe, así que no son un pendiente y no cuentan en el número.
  const aprendidos = await listarConceptos(g.tenantId, clienteId);
  const sinFacturaPosible = new Set(
    delCliente.filter((m) => m.signo === "cargo" && esSinFactura(m, aprendidos)).map((m) => m.id),
  );

  const paraCruzar = delCliente
    .filter((m) => !idsFirmes.has(m.id) && !sinFacturaPosible.has(m.id))
    .map((m) => (m.estado === "ignorado" ? m : { ...m, estado: "sin_factura" as const, factura_id: null }));

  const cruce = cruzar(paraCruzar, facturasCliente);

  const autoPorMov = new Map(cruce.automaticos.map((a) => [a.movimiento.id, a.factura.id]));
  const autoPorFac = new Map(cruce.automaticos.map((a) => [a.factura.id, a.movimiento.id]));
  const sugeridos = new Set(cruce.sugerencias.map((s) => s.movimiento.id));
  const sinFactura = new Set(cruce.sinFactura.map((m) => m.id));

  const ahora = new Date().toISOString();

  const actualizados = todosMovs.map((m) => {
    if (m.cliente_id !== clienteId || idsFirmes.has(m.id) || m.estado === "ignorado") return m;
    if (m.signo !== "cargo" || sinFacturaPosible.has(m.id)) return m;

    if (autoPorMov.has(m.id)) {
      const esperaba = m.veces_sin_justificar ?? 0;
      return {
        ...m,
        estado: "conciliado" as const,
        factura_id: autoPorMov.get(m.id)!,
        // Si venía arrastrándose de pasadas anteriores, queda dicho: esto se
        // resolvió, y cuánto tardó.
        ...(esperaba > 0 ? { resuelto_tras: esperaba } : {}),
      };
    }
    if (sugeridos.has(m.id)) return { ...m, estado: "sugerido" as const, factura_id: null };
    if (sinFactura.has(m.id)) {
      return {
        ...m,
        estado: "sin_factura" as const,
        factura_id: null,
        veces_sin_justificar: (m.veces_sin_justificar ?? 0) + 1,
      };
    }
    return m;
  });
  await guardarMovimientos(g.tenantId, actualizados);

  await guardarFacturas(
    g.tenantId,
    todasFacturas.map((f) => {
      if (autoPorFac.has(f.id)) {
        return { ...f, estado: "conciliada" as const, movimiento_id: autoPorFac.get(f.id)! };
      }
      // Una factura que estaba enlazada a un cargo que ya no la reclama vuelve
      // al saco. Sin esto, una factura editada se quedaría atrapada.
      if (f.cliente_id === clienteId && f.estado === "conciliada" && f.movimiento_id && !idsFirmes.has(f.movimiento_id)) {
        return { ...f, estado: "pendiente" as const, movimiento_id: null };
      }
      return f;
    }),
  );

  const cargosCliente = actualizados.filter((m) => m.cliente_id === clienteId && m.signo === "cargo");
  const motivos = {
    la_tengo: cargosCliente.filter((m) => m.motivo === "la_tengo").length,
    no_corresponde: cargosCliente.filter((m) => m.motivo === "no_corresponde").length,
    ahora_no: cargosCliente.filter((m) => m.motivo === "ahora_no").length,
  };
  const importe = Math.round(cruce.sinFactura.reduce((s, m) => s + m.importe, 0) * 100) / 100;
  const noLlevanFactura = delCliente.filter((m) => sinFacturaPosible.has(m.id));
  const importeNoLlevan = Math.round(noLlevanFactura.reduce((s, m) => s + m.importe, 0) * 100) / 100;

  await anotarPasada(g.tenantId, {
    cliente_id: clienteId,
    fecha: ahora,
    sinJustificar: cruce.sinFactura.length,
    importeSinJustificar: importe,
    conciliados: cruce.automaticos.length + firmes.length,
    sugerencias: cruce.sugerencias.length,
    motivos,
  });

  const resueltos = actualizados.filter(
    (m) => m.cliente_id === clienteId && m.estado === "conciliado" && (m.resuelto_tras ?? 0) > 0,
  ).length;

  return NextResponse.json({
    ok: true,
    fecha: ahora,
    sinJustificar: cruce.sinFactura.length,
    importeSinJustificar: importe,
    noLlevanFactura: noLlevanFactura.length,
    importeNoLlevanFactura: importeNoLlevan,
    conciliados: cruce.automaticos.length + firmes.length,
    sugerencias: cruce.sugerencias.length,
    resueltos,
    motivos,
    pasadas: await listarPasadas(g.tenantId, clienteId),
  });
}

/** El histórico, para pintarlo sin lanzar una pasada nueva. */
export async function GET(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;
  const clienteId = new URL(req.url).searchParams.get("clienteId") || undefined;
  return NextResponse.json({ ok: true, pasadas: await listarPasadas(g.tenantId, clienteId) });
}
