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
    <section>
      <div className="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span className="border-2 border-black px-2 py-1 font-bold tracking-widest" style={{ background: a.color }}>
          {a.role.toUpperCase()}
        </span>
        {live ? (
          <span className="bg-green-700 text-white px-2 py-1 font-bold tracking-widest">LIVE</span>
        ) : (
          <span className="bg-black/70 text-white px-2 py-1 font-bold tracking-widest">PRÓXIMAMENTE</span>
        )}
      </div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-stencil text-4xl md:text-5xl leading-none">{a.name}</h1>
          <p className="text-sm text-black/60 mt-1">{a.short}</p>
        </div>
        <p className="text-xs font-mono text-black/50 max-w-xs text-right">
          {live
            ? "✓ Conectada a Google Business. Lectura y respuesta a reseñas con aprobación por WhatsApp."
            : "Rocío genera respuestas a reseñas con IA. Conecta Google Business para que lea y publique sola."}
        </p>
      </div>

      {sp.gbp === "connected" && (
        <div className="card-hard bg-[#14B8A6] text-white p-3 mb-4 text-sm">
          ✓ Google Business conectado. Ya podemos leer y proponer respuestas a tus reseñas.
        </div>
      )}
      {sp.gbp_error && (
        <div className="card-hard bg-[color:var(--red)] text-white p-3 mb-4 text-sm">
          Error conectando Google Business: {sp.gbp_error}
        </div>
      )}

      {!live ? (
        <div className="card-hard bg-white p-6 mb-6 flex flex-col items-start gap-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">
            Paso 1 de 1
          </div>
          <h3 className="font-stencil text-2xl">Conecta tu ficha de Google Business</h3>
          <p className="text-sm text-black/70 max-w-xl">
            Rocío necesita acceso a la API de Google Business Profile para leer
            tus reseñas y publicar respuestas. Se autoriza en un click con tu
            cuenta de Google.
          </p>
          <a
            href="/api/rocio/auth"
            className="btn-mustard inline-block text-sm px-5 py-2.5"
          >
            🔗 Conectar mi Google Business →
          </a>
          <p className="text-[11px] text-black/45 font-mono">
            Permisos necesarios: gestión del negocio (business.manage) +
            email. No publicamos nada sin tu aprobación previa por WhatsApp.
          </p>
        </div>
      ) : (
        <RocioLivePanel
          proposals={proposals}
          mockMode={mock}
          autoReplyEnabled={autoReply}
        />
      )}

      {/* Generador manual + tracker — siguen ahí para quien los use a mano */}
      <div className="mt-8 border-t-2 border-black/10 pt-6">
        <h2 className="font-stencil text-2xl mb-3">Generador manual</h2>
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
        <RocioTools />
        <RocioTracker />
      </div>
    </section>
  );
}
