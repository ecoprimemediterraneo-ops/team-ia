// La portada — el contenido cambia según el sector, pero la URL es siempre
// `/dashboard`. Gestoría: saludo y el día en tres frases. Dental: la pestaña
// "Hoy", la agenda del día. El resto de sectores: el panel de tarjetas de
// siempre (`PanelClasico`), sin cambios. Chat, cabecera y pestañas viven en
// `(gestoria)/layout.tsx`, fuera de esta página: lo único que cambia al
// cambiar de pestaña es esto.
//
// Se mueve de sitio en el disco —de `dashboard/page.tsx` a
// `dashboard/(gestoria)/page.tsx`— pero no de URL: un grupo de rutas entre
// paréntesis no aparece en la dirección.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { PanelClasico } from "@/components/dashboard/PanelClasico";
import ResumenDelDia from "@/components/gestoria/ResumenDelDia";
import ContenidoHoyDental from "@/components/dental/ContenidoHoyDental";
import ContenidoHoyEstetica from "@/components/estetica/ContenidoHoyEstetica";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await getSessionLocal();
  if (!session) redirect("/login");
  const user = await getUser(session.email);
  if (!user.business) redirect("/onboarding");

  const ctx = await contextoPanelODefecto();
  if (ctx.perfil.id === "gestoria") {
    const nombre = (ctx.tenant?.ownerName || "").trim();
    return <ResumenDelDia nombreGestor={nombre} />;
  }
  if (ctx.perfil.id === "dental") {
    return <ContenidoHoyDental tenantId={ctx.tenantId} />;
  }
  // Estética: misma idea que dental —la agenda del día— pero sin urgencias y
  // con los leads calientes sin contestar arriba, que es lo que aquí aprieta.
  if (ctx.perfil.id === "estetica") {
    return (
      <ContenidoHoyEstetica
        tenantId={ctx.tenantId}
        vocCita={ctx.vocabulario.cita}
        vocCitaPlural={ctx.vocabulario.citaPlural}
      />
    );
  }
  return <PanelClasico />;
}
