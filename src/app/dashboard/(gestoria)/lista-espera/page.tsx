// LISTA DE ESPERA — quién espera un hueco y para qué día. El motor de reservas ya
// la guardaba y avisa sola cuando se libera un hueco (`notificarEsperaSiLibre`);
// aquí tiene pantalla propia, con un dato que la agenda no da: si YA hay hueco
// libre ese día para lo que la clienta pide, que es dinero que se está perdiendo.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { getBusinessesForTenant, listEspera, computeFreeSlots, resolverServicio } from "@/lib/booking";
import ListaEsperaSalon, { type FilaEspera } from "@/components/salon/ListaEsperaSalon";

export const dynamic = "force-dynamic";

export default async function ListaEsperaPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (ctx.perfil.id !== "salon") {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Lista de espera</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">Esta pantalla es para salones de belleza.</div>
      </div>
    );
  }

  const negocio = (await getBusinessesForTenant(ctx.tenantId))[0];
  let filas: FilaEspera[] = [];
  if (negocio) {
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: negocio.timezone || "Europe/Madrid" });
    const entradas = (await listEspera(negocio.slug)).filter((e) => e.estado !== "cancelada" && e.fecha >= hoy);
    filas = await Promise.all(
      entradas.map(async (e) => {
        let hayHueco = false;
        const sv = negocio.servicios.find((x) => x.id === e.serviceId);
        if (sv && e.estado === "esperando") {
          const r = await computeFreeSlots(negocio, resolverServicio(sv, { variantId: e.variantId }), e.fecha, "https://aiteam.marketing/api/lucia/callback", undefined, e.empleadoId);
          hayHueco = r.ok && r.slots.length > 0;
        }
        return {
          id: e.id, nombre: e.cliente.nombre, telefono: e.cliente.telefono,
          servicio: [e.servicioNombre, e.varianteNombre].filter(Boolean).join(" · "),
          profesional: e.empleadoNombre, fecha: e.fecha, horaPedida: e.horaPedida,
          estado: e.estado === "avisado" ? "avisado" : "esperando", hayHueco,
        } satisfies FilaEspera;
      }),
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Lista de espera</h1>
        <p className="text-sm text-black/60 mt-1">
          Quién espera un hueco y para qué día. Cuando alguien cancela, se avisa sola a quien espera ese día.
        </p>
      </div>
      {!negocio ? (
        <div className="card-hard bg-white p-6 text-sm text-black/60">Todavía no hay ninguna agenda conectada para este salón.</div>
      ) : (
        <ListaEsperaSalon slug={negocio.slug} filas={filas} />
      )}
    </div>
  );
}
