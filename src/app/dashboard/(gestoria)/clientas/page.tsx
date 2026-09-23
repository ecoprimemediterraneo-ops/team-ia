// CLIENTAS — la ficha de cada una: historial de citas, próxima cita, gasto y
// no-shows. Reutiliza `ClientesView`, la misma ficha de cliente que ya usan el
// motor de reservas y la pestaña "Pacientes" de dental — no se construye una
// nueva.
//
// EL RÓTULO NO ESTÁ A FUEGO. Sale del vocabulario del perfil de sector
// (`sectores.ts` → `vocabulario.clientePlural`), que hoy para estética dice
// "pacientes". Si un tenant o el perfil cambian esa palabra, esta pantalla la
// sigue: llamarle "clientas" a la clienta de una clínica que dice "pacientes"
// delata al sistema igual que llamarle "paciente" a la de un salón.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { getBusinessesForTenant } from "@/lib/booking";
import ClientesView from "@/components/booking/ClientesView";

export const dynamic = "force-dynamic";

/** "pacientes" → "Pacientes". Solo la primera letra: nada de Title Case. */
function conMayuscula(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default async function ClientasPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (ctx.perfil.id !== "estetica") {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Clientas</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">Esta pantalla es para clínicas estéticas.</div>
      </div>
    );
  }

  const titulo = conMayuscula(ctx.vocabulario.clientePlural);
  const negocios = await getBusinessesForTenant(ctx.tenantId);
  const negocio = negocios[0];

  return (
    <div className="space-y-4">
      <h1 className="font-stencil text-3xl md:text-4xl leading-none">{titulo}</h1>
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
