// AGENDA — vista semanal y mensual, crear y mover citas a mano, bloquear
// horas. SOLO en estética: reutiliza `AgendaView`, el mismo componente que ya
// usan `ReservasPanel` y la pestaña Agenda de dental — no se construye un
// segundo motor de agenda.
//
// EL NOMBRE DE LA RUTA. `/dashboard/agenda` ya existe (redirige a
// `/dashboard/clientes` para el resto de sectores) y `/dashboard/citas` es la
// de dental, cuya página rechaza a cualquier perfil que no sea "dental". Para
// no tocar ninguna de las dos, estética estrena la suya.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { getBusinessesForTenant } from "@/lib/booking";
import AgendaView from "@/components/booking/AgendaView";

export const dynamic = "force-dynamic";

export default async function AgendaEsteticaPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (ctx.perfil.id !== "estetica") {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Agenda</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">Esta pantalla es para clínicas estéticas.</div>
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
          Todavía no hay ninguna agenda conectada para esta clínica.
        </div>
      ) : (
        <AgendaView
          slug={negocio.slug}
          nombre={negocio.nombre}
          timezone={negocio.timezone}
          servicios={negocio.servicios}
          empleados={negocio.empleados || []}
          target={null}
        />
      )}
    </div>
  );
}
