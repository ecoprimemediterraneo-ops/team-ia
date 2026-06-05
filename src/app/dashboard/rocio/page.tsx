import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import AgentChat from "@/components/AgentChat";
import RocioTools from "@/components/RocioTools";
import RocioTracker from "@/components/RocioTracker";
import { agentBySlug } from "@/lib/agents";
import { isMockMode } from "@/lib/google-business";
import { isRocioLive, resolveTenantForRocio } from "@/lib/rocio-flow";
import { listRocioByTenant } from "@/lib/rocio-proposals";
import RocioLivePanel from "./RocioLivePanel";

export const dynamic = "force-dynamic";

export default async function RocioPage({
  searchParams,
}: {
  searchParams: Promise<{ gbp?: string; gbp_error?: string }>;
}) {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");
  const a = agentBySlug.rocio;

  const live = await isRocioLive(s.email);
  const mock = isMockMode();
  const autoReply = (process.env.ROCIO_AUTO_REPLY || "").toLowerCase() === "true";
  const tenantId = await resolveTenantForRocio();
  const proposals = live ? await listRocioByTenant(tenantId) : [];
  const sp = await searchParams;

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
          <span className="border-2 border-black px-2 py-0.5 font-bold tracking-widest" style={{ background: a.color }}>
            {a.role.toUpperCase()}
          </span>
          {live ? (
            <span className="bg-green-700 text-white px-2 py-0.5 font-bold tracking-widest">LIVE</span>
          ) : (
            <span className="bg-black/70 text-white px-2 py-0.5 font-bold tracking-widest">PRÓXIMAMENTE</span>
          )}
          <span className="ml-auto text-[11px] font-mono text-black/55 hidden md:inline truncate max-w-[60%]">
            {live
              ? "✓ Conectada a Google Business · aprobación por WhatsApp"
              : "Conecta Google Business para que Rocío lea y publique sola"}
          </span>
        </div>
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <h1 className="font-stencil text-3xl md:text-4xl leading-none">{a.name}</h1>
            <p className="text-sm text-black/60 mt-0.5">{a.short}</p>
          </div>
          <p className="text-[11px] font-mono text-black/55 md:hidden">
            {live ? "✓ Conectada a Google Business" : "Conecta Google Business"}
          </p>
        </div>
      </header>

      {sp.gbp === "connected" && (
        <div className="card-hard bg-[#14B8A6] text-white p-3 text-sm">
          ✓ Google Business conectado. Ya podemos leer y proponer respuestas a tus reseñas.
        </div>
      )}
      {sp.gbp_error && (
        <div className="card-hard bg-[color:var(--red)] text-white p-3 text-sm">
          Error conectando Google Business: {sp.gbp_error}
        </div>
      )}

      {!live ? (
        <div className="card-hard bg-white p-4 flex flex-col items-start gap-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">
            Paso 1 de 1
          </div>
          <h3 className="font-stencil text-xl sm:text-2xl leading-tight">Conecta tu ficha de Google Business</h3>
          <p className="text-sm text-black/70 max-w-xl leading-snug">
            Rocío necesita acceso a la API de Google Business Profile para leer tus reseñas y publicar respuestas. Se autoriza en un click con tu cuenta de Google.
          </p>
          <a href="/api/rocio/auth" className="btn-mustard inline-block text-sm px-4 py-2">
            🔗 Conectar mi Google Business →
          </a>
          <p className="text-[11px] text-black/45 font-mono leading-snug">
            Permisos: business.manage + email. Nada se publica sin tu aprobación por WhatsApp.
          </p>
        </div>
      ) : (
        <RocioLivePanel
          proposals={proposals}
          mockMode={mock}
          autoReplyEnabled={autoReply}
        />
      )}

      {/* Generador manual + tracker — Tools ancho completo, Chat+Tracker en 2-col */}
      <div className="border-t-2 border-black/10 pt-4 space-y-3">
        <h2 className="font-stencil text-xl sm:text-2xl">Generador manual</h2>
        <RocioTools />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <AgentChat
            agent="rocio"
            initialMessages={user.chats.rocio}
            placeholder="Pídele a Rocío que pida o responda reseñas…"
            suggestions={[
              "Redacta un mensaje WhatsApp pidiendo reseña tras una cita",
              "Responde a esta reseña 5★: «Trato excelente, repetiré»",
              "Responde a esta reseña 1★: «Llegué a la hora y me hicieron esperar 30 min»",
            ]}
          />
          <RocioTracker />
        </div>
      </div>
    </section>
  );
}
