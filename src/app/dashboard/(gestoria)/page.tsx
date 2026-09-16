// La portada de gestoría — ahora SOLO el saludo y el día en tres frases.
// Chat, selector de cliente, barra roja, atajos y cuadro de preguntar viven en
// `(gestoria)/layout.tsx`, fuera de esta página: lo único que cambia al
// cambiar de pestaña es esto.
//
// Para el resto de sectores esta ruta sigue siendo exactamente lo que era: el
// panel de tarjetas de siempre (`PanelClasico`). Se mueve de sitio en el
// disco —de `dashboard/page.tsx` a `dashboard/(gestoria)/page.tsx`— pero no de
// URL: un grupo de rutas entre paréntesis no aparece en la dirección. Sigue
// siendo `/dashboard`.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { PanelClasico } from "@/components/dashboard/PanelClasico";
import ResumenDelDia from "@/components/gestoria/ResumenDelDia";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await getSessionLocal();
  if (!session) redirect("/login");
  const user = await getUser(session.email);
  if (!user.business) redirect("/onboarding");

  const ctx = await contextoPanelODefecto();
  if (ctx.perfil.id !== "gestoria") return <PanelClasico />;

  const nombre = (ctx.tenant?.ownerName || "").trim();
  return <ResumenDelDia nombreGestor={nombre} />;
}
