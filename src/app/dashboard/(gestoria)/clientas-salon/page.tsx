// CLIENTAS — la ficha de cada una (historial de citas, próxima cita, gasto,
// no-shows y su profesional habitual) y, arriba, las DORMIDAS: las que venían con
// regularidad y llevan tiempo sin volver. En un salón la clienta que deja de venir
// es dinero que se va sin hacer ruido.
//
// Reutiliza `ClientesView`, la misma ficha que usan el resto de sectores — no se
// construye una nueva — y el dato de las dormidas que ya calcula el motor de
// reservas (`listClientasDormidasCompleto`). El rótulo sale del vocabulario del
// perfil ("clientas"), no está a fuego.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { getBusinessesForTenant, listClientasDormidasCompleto } from "@/lib/booking";
import ClientesView from "@/components/booking/ClientesView";
import ClientasDormidas from "@/components/salon/ClientasDormidas";

export const dynamic = "force-dynamic";

const conMayuscula = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default async function ClientasSalonPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (ctx.perfil.id !== "salon") {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Clientas</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">Esta pantalla es para salones de belleza.</div>
      </div>
    );
  }

  const titulo = conMayuscula(ctx.vocabulario.clientePlural);
  const negocio = (await getBusinessesForTenant(ctx.tenantId))[0];
  const dormidas = negocio ? await listClientasDormidasCompleto(negocio.slug) : [];

  return (
    <div className="space-y-6">
      <h1 className="font-stencil text-3xl md:text-4xl leading-none">{titulo}</h1>
      {!negocio ? (
        <div className="card-hard bg-white p-6 text-sm text-black/60">Todavía no hay ninguna agenda conectada para este salón.</div>
      ) : (
        <>
          <section>
            <div className="flex items-baseline gap-3 mb-2">
              <h2 className="font-stencil text-2xl leading-none">{titulo} dormidas</h2>
              <span className="text-xs font-mono bg-[color:var(--mustard)] border-2 border-black px-1.5 py-0.5">{dormidas.length}</span>
            </div>
            <p className="text-sm text-black/60 mb-3">Venían y llevan más de 60 días sin volver ni tener cita. Las que más veces vinieron, primero.</p>
            <ClientasDormidas
              slug={negocio.slug}
              negocioNombre={negocio.nombre}
              dormidas={dormidas.map((d) => ({
                key: d.key, nombre: d.nombre, email: d.email, telefono: d.telefono, diasSinVenir: d.diasSinVenir, visitas: d.visitas,
                ultimaCitaIso: d.ultimaCitaIso, servicioHabitual: d.servicioHabitual, profesionalHabitual: d.profesionalHabitual,
                puedeEnviar: d.puedeEnviar, diasDesdeAviso: d.diasDesdeAviso,
              }))}
            />
          </section>
          <section>
            <h2 className="font-stencil text-2xl leading-none mb-3">Todas las {ctx.vocabulario.clientePlural}</h2>
            <ClientesView slug={negocio.slug} sinDormidas palabra={ctx.vocabulario.clientePlural} />
          </section>
        </>
      )}
    </div>
  );
}
