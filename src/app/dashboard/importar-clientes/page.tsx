// Traerse los clientes desde el programa de contabilidad. Solo gestoría.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import ImportarClientes from "@/components/gestoria/ImportarClientes";

export const dynamic = "force-dynamic";

export default async function ImportarClientesPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Importar clientes</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">
          Esta pantalla es para gestorías.{" "}
          <a href="/dashboard" className="underline font-bold">Volver al chat</a>.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-black/50">{ctx.tenant?.name}</div>
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Importar clientes</h1>
        <p className="text-sm text-black/60 mt-1">
          Súbelos de golpe desde tu programa en vez de meterlos uno a uno.
        </p>
      </div>
      <ImportarClientes />
    </div>
  );
}
