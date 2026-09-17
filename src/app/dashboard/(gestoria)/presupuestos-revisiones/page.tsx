// PRESUPUESTOS Y REVISIONES — presupuestos sin cerrar y a quién le toca aviso
// de revisión, con fecha y nombre, no solo una cifra. Es la misma pantalla
// que "Seguimiento" (`/dashboard/seguimiento`), reutilizada tal cual vía
// `ContenidoSeguimiento` — no hay una segunda versión que mantener.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import ContenidoSeguimiento from "@/components/dental/ContenidoSeguimiento";

export const dynamic = "force-dynamic";

export default async function PresupuestosRevisionesPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (ctx.perfil.id !== "dental") {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Presupuestos y revisiones</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">Esta pantalla es para clínicas dentales.</div>
      </div>
    );
  }

  const haceRecall = tieneFuncion(ctx.sector, "recall");
  const haceSeguimiento = tieneFuncion(ctx.sector, "seguimientoPresupuestos");

  return (
    <div className="space-y-4">
      <h1 className="font-stencil text-3xl md:text-4xl leading-none">Presupuestos y revisiones</h1>
      <ContenidoSeguimiento
        tenantId={ctx.tenantId}
        vocabulario={ctx.vocabulario}
        haceRecall={haceRecall}
        haceSeguimiento={haceSeguimiento}
      />
    </div>
  );
}
