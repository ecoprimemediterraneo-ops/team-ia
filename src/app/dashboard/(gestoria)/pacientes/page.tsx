// PACIENTES — la ficha de cada paciente: historial de citas, próxima cita,
// gasto, no-shows. Reutiliza `ClientesView`, la misma ficha de cliente que ya
// usa el motor de reservas para el resto de sectores — no se construye una
// nueva. `Notas`/`Etiquetas` (si el paciente tiene un presupuesto parado o le
// toca revisión) siguen viviendo en "Presupuestos y revisiones", que es su
// pantalla propia y no un campo suelto en la ficha.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { getBusinessesForTenant } from "@/lib/booking";
import ClientesView from "@/components/booking/ClientesView";

export const dynamic = "force-dynamic";

export default async function PacientesPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (ctx.perfil.id !== "dental") {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Pacientes</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">Esta pantalla es para clínicas dentales.</div>
      </div>
    );
  }

  const negocios = await getBusinessesForTenant(ctx.tenantId);
  const negocio = negocios[0];

  return (
    <div className="space-y-4">
      <h1 className="font-stencil text-3xl md:text-4xl leading-none">Pacientes</h1>
      {!negocio ? (
        <div className="card-hard bg-white p-6 text-sm text-black/60">
          Todavía no hay ninguna agenda conectada para esta clínica.
        </div>
      ) : (
        <ClientesView slug={negocio.slug} />
      )}
    </div>
  );
}
