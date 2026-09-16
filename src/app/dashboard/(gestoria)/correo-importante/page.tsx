// Correo importante — la lista de remitentes que hace saltar un correo.
// Solo en gestoría.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import RemitentesImportantes from "@/components/gestoria/RemitentesImportantes";

export const dynamic = "force-dynamic";

export default async function CorreoImportantePage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (!tieneFuncion(ctx.sector, "clasificacionCorreo")) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Correo importante</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">
          Esta pantalla es para gestorías, que reciben notificaciones de organismos oficiales. En{" "}
          {ctx.vocabulario.negocio} no aplica.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-black/50">{ctx.tenant?.name}</div>
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Correo importante</h1>
        <p className="text-sm text-black/60 mt-1">
          Los correos de estos remitentes salen destacados arriba de tu bandeja.
        </p>
      </div>

      {/* La promesa, escrita donde se configura: es la parte que hay que poder
          creerse sin auditar el código. */}
      <div className="card-hard bg-[color:var(--cream)] p-4 text-sm space-y-1">
        <p><strong>Lucía solo marca y ordena.</strong> No borra, no archiva y no esconde ningún correo.</p>
        <p>Todo lo que llega se sigue viendo. Si el remitente no está en esta lista, su correo aparece normal.</p>
        <p>Lo que decide si un correo salta es <strong>quién lo manda</strong>, no lo que dice. Lucía no lee el
          contenido para decidir importancia, ni te dice qué hacer ni cuándo: de eso te encargas tú.</p>
      </div>

      <RemitentesImportantes />
    </div>
  );
}
