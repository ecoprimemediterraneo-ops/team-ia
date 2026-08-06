import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { getUser } from "@/lib/store";
import PerfilEditor from "@/components/PerfilEditor";
import PerfilSectorFicha from "@/components/PerfilSectorFicha";
import CambiarSector from "@/components/CambiarSector";
import { contextoPanelODefecto } from "@/lib/panel-contexto";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");

  // Del tenant del panel, no de una constante: antes enseñaba siempre el sector
  // de AI-Team aunque estuvieras mirando el panel de otro cliente.
  const ctx = await contextoPanelODefecto();

  // El perfil que se enseña es el del TENANT (su ficha), no el del store por
  // login. Antes salía `user.business`, que es del usuario que ha iniciado
  // sesión: en el panel del despacho de abogados aparecía la ficha de una
  // clínica dental. Mismo fallo que el de los servicios, un nivel más abajo.
  const f = ctx.tenant?.ficha;
  const perfilNegocio = f
    ? {
        nombre: f.nombreNegocio,
        sector: f.sector,
        ofrece: (f.serviciosClave || []).join(", "),
        tono: f.tono,
        publico: f.publicoObjetivo || "",
      }
    : user.business!;

  // Al mirar el panel de otro tenant, el formulario guardaría en la cuenta con
  // la que se ha iniciado sesión. Se enseña, pero no se deja guardar.
  const soloLectura = ctx.mirandoOtro;

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-3 text-xs font-mono">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">PERFIL DEL NEGOCIO</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">EDITABLE</span>
        </div>
        <h1 className="font-stencil text-4xl md:text-5xl mb-2 leading-none">Perfil del negocio</h1>
        <p className="text-sm text-black/60">
          Esta información la usan TODOS tus agentes. Cuanto más concreta, mejor responderán.
        </p>
      </div>

      <div className="space-y-2">
        <PerfilSectorFicha sector={ctx.sector} />
        {/* Solo en tu propio panel: en vista de prueba cambiaría el sector del
            tenant que estás mirando desde tu sesión, y eso confunde. */}
        {!soloLectura && <CambiarSector actual={ctx.sector} />}
      </div>

      {soloLectura ? (
        <div className="card-hard bg-white p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-2">Ficha del negocio</div>
          <dl className="text-sm space-y-1.5">
            <div><dt className="inline font-bold">Nombre: </dt><dd className="inline">{perfilNegocio.nombre || "—"}</dd></div>
            <div><dt className="inline font-bold">Sector: </dt><dd className="inline">{perfilNegocio.sector || "—"}</dd></div>
            <div><dt className="inline font-bold">Qué ofrece: </dt><dd className="inline">{perfilNegocio.ofrece || "—"}</dd></div>
            <div><dt className="inline font-bold">Tono: </dt><dd className="inline">{perfilNegocio.tono || "—"}</dd></div>
            <div><dt className="inline font-bold">Público: </dt><dd className="inline">{perfilNegocio.publico || "—"}</dd></div>
          </dl>
          <p className="text-xs text-black/50 mt-3">
            Vista de prueba de otro cliente: se muestra su ficha pero no se puede editar desde aquí,
            porque el formulario guardaría en tu cuenta.
          </p>
        </div>
      ) : (
        <PerfilEditor initial={perfilNegocio} />
      )}
    </section>
  );
}
