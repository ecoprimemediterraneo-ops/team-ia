// AGENDA — semana y mes, crear, mover y cancelar citas, bloquear horas y filtrar
// por profesional. SOLO en el salón: reutiliza `AgendaView`, el mismo componente
// que ya usan `ReservasPanel` y las pestañas de agenda de dental y estética — no
// se construye un segundo motor de agenda. Se abre en la vista "Personal"
// (una columna por profesional), que es como se mira la agenda de un salón.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { getBusinessesForTenant } from "@/lib/booking";
import AgendaView from "@/components/booking/AgendaView";

export const dynamic = "force-dynamic";

export default async function AgendaSalonPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (ctx.perfil.id !== "salon") {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Agenda</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">Esta pantalla es para salones de belleza.</div>
      </div>
    );
  }

  const negocios = await getBusinessesForTenant(ctx.tenantId);
  const negocio = negocios[0];

  return (
    <div className="space-y-4">
      <h1 className="font-stencil text-3xl md:text-4xl leading-none">Agenda</h1>
      {!negocio ? (
        <div className="card-hard bg-white p-6 text-sm text-black/60">
          Todavía no hay ninguna agenda conectada para este salón.
        </div>
      ) : (
        <AgendaView
          slug={negocio.slug}
          nombre={negocio.nombre}
          timezone={negocio.timezone}
          servicios={negocio.servicios}
          empleados={negocio.empleados || []}
          target={null}
          vistaInicial="columnas"
          conMes
          conFiltroProfesional
        />
      )}
    </div>
  );
}
