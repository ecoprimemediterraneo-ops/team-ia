// Facturas — el saco del cliente. Solo en gestoría.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { listarClientes } from "@/lib/gestoria-clientes";
import { extractoDeCliente } from "@/lib/gestoria-facturas";
import FacturasCliente from "@/components/gestoria/FacturasCliente";

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

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-black/50">{ctx.tenant?.name}</div>
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Facturas</h1>
        <p className="text-sm text-black/60 mt-1">
          Todo lo que llega por WhatsApp, por correo o a mano, en un solo sitio por cliente.
        </p>
      </div>
      {/* Lo que Jose no sabe la primera vez: esto NO es la pantalla de subir
          facturas, es la pantalla de vigilarlas. Casi todas entran solas. */}
      <div className="border-2 border-black bg-[color:var(--cream)] px-3 py-2 text-sm">
        📥 Las facturas entran solas por WhatsApp y email durante todo el mes. Aquí solo subes las que llegan en papel o sueltas.
      </div>

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
