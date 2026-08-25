// Facturas — el saco del cliente. Solo en gestoría.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { listarClientes } from "@/lib/gestoria-clientes";
import { extractoDeCliente, listarMovimientos, listarFacturas } from "@/lib/gestoria-facturas";
import FacturasCliente from "@/components/gestoria/FacturasCliente";
import PagadoSinFactura from "@/components/gestoria/PagadoSinFactura";
import { pagosSinFacturaPorCliente } from "@/lib/gestoria-conciliacion";
import BarraGestoria from "@/components/gestoria/BarraGestoria";

export const dynamic = "force-dynamic";

export default async function FacturasPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Facturas</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">
          Esta pantalla es para gestorías, que cruzan facturas contra el extracto del banco. En{" "}
          {ctx.vocabulario.negocio} no aplica.
        </div>
      </div>
    );
  }

  const clientes = await listarClientes(ctx.tenantId);

  // Qué extracto tiene ya cada cliente. Se lee con la misma función que usa la
  // pantalla del banco: el estado de la segunda fase se cuenta en un sitio solo.
  const yaSubido: Record<string, { total: number; desde: string; hasta: string; ultimaImportacion: string; lotes: number }> = {};
  for (const c of clientes) {
    const e = await extractoDeCliente(ctx.tenantId, c.id);
    if (e) yaSubido[c.id] = e;
  }

  // Pagos que cuadran con un albarán o un ticket en vez de con una factura.
  // Se calcula en el servidor porque hace falta cruzar TODO el extracto contra
  // TODAS las facturas, y eso no se le manda al navegador.
  const [movimientos, facturas] = await Promise.all([
    listarMovimientos(ctx.tenantId),
    listarFacturas(ctx.tenantId),
  ]);
  const nombrePorId = new Map(clientes.map((c) => [c.id, c.nombre]));
  const sinFactura = pagosSinFacturaPorCliente(movimientos, facturas).map((g) => ({
    clienteId: g.clienteId,
    clienteNombre: nombrePorId.get(g.clienteId) ?? g.clienteId,
    cuantos: g.cuantos,
    total: g.total,
    albaranes: g.albaranes,
    tickets: g.tickets,
    documentos: g.pagos.map((p) => ({
      movimientoId: p.movimiento.id,
      fecha: p.movimiento.fecha,
      concepto: p.movimiento.concepto,
      importe: p.movimiento.importe,
      tipo: p.tipo,
      documentoNombre: p.documento.nombre_original,
      proveedor: p.documento.proveedor,
      fechaDocumento: p.documento.fecha_factura,
    })),
  }));

  return (
    <div className="space-y-4">
      {/* Lo que aprieta y el cuadro de preguntar, en todas las pantallas. */}
      <BarraGestoria />

      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-black/50">{ctx.tenant?.name}</div>
        {/* Como en el lateral: el nombre de verdad grande y el apodo debajo.
            "El saco de facturas" a tamaño de titular se leía como una frase. */}
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Facturas</h1>
        <div className="text-sm text-black/40 leading-tight">(saco)</div>
        <p className="text-sm text-black/60 mt-1">
          Todo lo que llega por WhatsApp, por correo o a mano, en un solo sitio por cliente.
        </p>
      </div>
      {/* Lo que Jose no sabe la primera vez: esto NO es la pantalla de subir
          facturas, es la pantalla de vigilarlas. Casi todas entran solas. */}
      <div className="border-2 border-black bg-[color:var(--cream)] px-3 py-2 text-sm">
        📥 Las facturas entran solas por WhatsApp y email durante todo el mes. Aquí solo subes las que llegan en papel o sueltas.
      </div>

      {/* Pagado, pero sin factura buena. Va ARRIBA porque es trabajo concreto:
          se sabe de quién es, de cuánto y a quién hay que pedírsela. */}
      <PagadoSinFactura grupos={sinFactura} />

      {clientes.length === 0 ? (
        <div className="card-hard bg-white p-6 text-sm text-black/60">
          Todavía no hay clientes con expediente. Los clientes salen de{" "}
          <a href="/dashboard/expedientes" className="underline">Expedientes</a>.
        </div>
      ) : (
        <FacturasCliente clientes={clientes} yaSubido={yaSubido} />
      )}
    </div>
  );
}
