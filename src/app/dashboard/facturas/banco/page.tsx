import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { listarClientes } from "@/lib/gestoria-clientes";
import { extractoDeCliente } from "@/lib/gestoria-facturas";
import SubirExtracto from "@/components/gestoria/SubirExtracto";

export const dynamic = "force-dynamic";

export default async function BancoPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    // Con salida: era una tarjeta suelta sin ningún enlace, y desde ahí solo se
    // salía con el botón atrás del navegador.
    return (
      <div className="card-hard bg-white p-6 text-sm text-black/70">
        Esta pantalla es para gestorías.{" "}
        <a href="/dashboard" className="underline font-bold">Volver al panel</a>.
      </div>
    );
  }
  const clientes = await listarClientes(ctx.tenantId);

  // Lo ya subido, por cliente: sirve para avisar de que se va a repetir un
  // extracto antes de subirlo, no después.
  const yaSubido: Record<string, { total: number; desde: string; hasta: string; ultimaImportacion: string; lotes: number }> = {};
  for (const c of clientes) {
    const e = await extractoDeCliente(ctx.tenantId, c.id);
    if (e) yaSubido[c.id] = e;
  }

  return (
    <div className="space-y-4">
      <div>
        {/* Esta pantalla cuelga de Facturas y era la única del módulo sin vuelta
            escrita: se salía de ella con el botón atrás del navegador. */}
        <a
          href="/dashboard/facturas"
          className="inline-block text-xs font-mono uppercase tracking-widest text-black/60 hover:text-black hover:underline mb-1"
        >
          ← Volver a Facturas
        </a>
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Extracto bancario</h1>
        <p className="text-sm text-black/60 mt-1">Se compara con las facturas de ese cliente, y solo con las suyas.</p>
      </div>

      {/* El cuándo, que es lo que nadie sabe la primera vez. */}
      <div className="border-2 border-black bg-[color:var(--cream)] px-3 py-2 text-sm">
        📅 Sube el extracto del banco al cerrar el periodo, una vez por cliente y mes.
      </div>

      {clientes.length === 0
        ? <div className="card-hard bg-white p-6 text-sm text-black/60">No hay clientes con expediente todavía.</div>
        : <SubirExtracto clientes={clientes} yaSubido={yaSubido} />}
    </div>
  );
}
