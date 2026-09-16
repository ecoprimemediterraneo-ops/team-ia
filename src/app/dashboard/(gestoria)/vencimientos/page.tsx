// Vencimientos — la agenda de fechas límite legales. Solo en gestoría.
//
// Antes era una de las tres secciones que se desplegaban DEBAJO del chat en
// `/dashboard?seccion=vencimientos` (nunca cambiaba de ruta, así que nunca
// perdía el chat). Ahora tiene ruta propia porque el chat ya no vive en una
// página sino en el layout del grupo — así que cualquier ruta de aquí dentro
// lo conserva igual de bien, y esta puede tener su propia URL con la que
// enlazar directamente ("¿qué vence esta semana?" → aquí).

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import AgendaObligaciones from "@/components/gestoria/AgendaObligaciones";

export const dynamic = "force-dynamic";

export default async function VencimientosPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Vencimientos</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">
          Esta pantalla es para gestorías, que trabajan contra fechas límite legales. En{" "}
          {ctx.vocabulario.negocio} no aplica.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Vencimientos</h1>
        <p className="text-sm text-black/60 mt-1">Lo que toca, ordenado por fecha límite.</p>
      </div>
      <AgendaObligaciones />
    </div>
  );
}
