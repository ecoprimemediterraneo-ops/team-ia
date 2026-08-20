// Hoy — lo que el gestor tiene que hacer, ordenado por fecha límite legal.
//
// Es la pantalla por la que se entra: la secretaria no te enseña el archivo, te
// dice qué te queda por hacer.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { listarTareas, diasHasta, esRojo, hoyMadrid } from "@/lib/gestoria-hoy";
import ListaDeHoy from "@/components/gestoria/ListaDeHoy";

export const dynamic = "force-dynamic";

export default async function HoyPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Hoy</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">
          Esta pantalla es para gestorías, que trabajan contra fechas límite legales. En{" "}
          {ctx.vocabulario.negocio} no aplica.
        </div>
      </div>
    );
  }

  const tareas = await listarTareas(ctx.tenantId);

  return (
    <ListaDeHoy
      hoy={hoyMadrid()}
      tareas={tareas.map((t) => ({
        id: t.id,
        titulo: t.titulo,
        detalle: t.detalle,
        clienteNombre: t.clienteNombre,
        vence: t.vence,
        origen: t.origen,
        urgente: t.urgente,
        hecho: t.hecho,
        dias: diasHasta(t.vence),
        rojo: esRojo(t),
      }))}
    />
  );
}
