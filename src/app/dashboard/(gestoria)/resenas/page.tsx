// RESEÑAS — lo de Rocío, visible y no escondido en el lateral. Reutiliza los
// mismos componentes que `/dashboard/rocio` (`RocioLivePanel`, `RocioTools`,
// `RocioTracker`) y las mismas funciones de `rocio-flow.ts`/`rocio-proposals.ts`
// — no se construye un segundo módulo de reseñas.
//
// Se deja fuera el chat genérico "pídele a Rocío" (`AgentChat`) que sí lleva
// `/dashboard/rocio`: el panel de dental ya tiene SU chat fijo arriba, y un
// segundo cuadro de conversación distinto en medio de la pantalla compite con
// él en vez de sumar.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import RocioTools from "@/components/RocioTools";
import RocioTracker from "@/components/RocioTracker";
import { isMockMode } from "@/lib/google-business";
import { isRocioLive, resolveTenantForRocio } from "@/lib/rocio-flow";
import { listRocioByTenant } from "@/lib/rocio-proposals";
import RocioLivePanel from "@/app/dashboard/rocio/RocioLivePanel";

export const dynamic = "force-dynamic";

export default async function ResenasDentalPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (ctx.perfil.id !== "dental") {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Reseñas</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">Esta pantalla es para clínicas dentales.</div>
      </div>
    );
  }

  const live = await isRocioLive(s.email);
  const mock = isMockMode();
  const autoReply = (process.env.ROCIO_AUTO_REPLY || "").toLowerCase() === "true";
  const tenantId = await resolveTenantForRocio(s.email);
  const proposals = live ? await listRocioByTenant(tenantId) : [];

  return (
    <div className="space-y-4">
      <h1 className="font-stencil text-3xl md:text-4xl leading-none">Reseñas</h1>
      <p className="text-sm text-black/60 -mt-2">
        {live
          ? "Conectada a Google Business · aprobación por WhatsApp."
          : "Conecta Google Business para que Rocío lea y publique sola."}
      </p>

      {!live ? (
        <div className="card-hard bg-white p-4 flex flex-col items-start gap-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">Paso 1 de 1</div>
          <h3 className="font-stencil text-xl sm:text-2xl leading-tight">Conecta tu ficha de Google Business</h3>
          <p className="text-sm text-black/70 max-w-xl leading-snug">
            Rocío necesita acceso a la API de Google Business Profile para leer tus reseñas y publicar respuestas. Se autoriza en un click con tu cuenta de Google.
          </p>
          <a href="/api/rocio/auth" className="btn-mustard inline-block text-sm px-4 py-2">
            Conectar mi Google Business →
          </a>
          <p className="text-[11px] text-black/45 font-mono leading-snug">
            Permisos: business.manage + email. Nada se publica sin tu aprobación por WhatsApp.
          </p>
        </div>
      ) : (
        <RocioLivePanel proposals={proposals} mockMode={mock} autoReplyEnabled={autoReply} />
      )}

      <div className="border-t-2 border-black/10 pt-4 space-y-3">
        <h2 className="font-stencil text-xl sm:text-2xl">Generador manual</h2>
        <RocioTools />
        <RocioTracker />
      </div>
    </div>
  );
}
