// Seguimiento — recall de revisiones + presupuestos.
//
// Es la pantalla de las dos cosas que una clínica pierde por no tener a nadie
// detrás: el paciente que no volvió y el presupuesto que se quedó parado.
//
// Solo aparece en los sectores que tienen esas funciones encendidas
// (`recall` / `seguimientoPresupuestos` en sectores.ts → hoy, la clínica dental).
//
// El cuerpo vive en `ContenidoSeguimiento.tsx`: es la MISMA pantalla que
// enseña la pestaña "Presupuestos y revisiones" del panel fijo de dental
// (`/dashboard/presupuestos-revisiones`). Esta ruta suelta no se borra —sigue
// funcionando tecleada a mano o desde un enlace viejo— pero ya no hace falta
// para llegar aquí: el panel de dental lleva a la pestaña.
//
// Todo se lee por `ctx.tenantId`, nunca por el email de la sesión.

import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import ContenidoSeguimiento from "@/components/dental/ContenidoSeguimiento";

export const dynamic = "force-dynamic";

export default async function SeguimientoPage() {
  const ctx = await contextoPanelODefecto();
  const haceRecall = tieneFuncion(ctx.sector, "recall");
  const haceSeguimiento = tieneFuncion(ctx.sector, "seguimientoPresupuestos");
  const v = ctx.vocabulario;

  if (!haceRecall && !haceSeguimiento) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Seguimiento</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">
          Esta pantalla es para negocios con visitas que se repiten en el tiempo (revisiones) o con
          presupuestos que se dan y tardan en cerrarse. En {v.negocio} no aplica, así que no se
          enseña con datos vacíos.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-black/40">Seguimiento</div>
        <h1 className="font-stencil text-3xl sm:text-4xl leading-none mt-1">
          Quién tiene que volver
        </h1>
        <p className="text-sm text-black/60 mt-2">
          Los {v.clientePlural} a los que les toca revisión y los presupuestos que siguen parados.
          Lo que aquí se ve es lo que Pablo va a recordar.
        </p>
      </div>

      <ContenidoSeguimiento tenantId={ctx.tenantId} vocabulario={v} haceRecall={haceRecall} haceSeguimiento={haceSeguimiento} />
    </div>
  );
}
