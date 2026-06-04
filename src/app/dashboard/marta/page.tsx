import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { agentBySlug } from "@/lib/agents";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import { listProposalsByTenant } from "@/lib/marta-proposals";
import { isPublishEnabled } from "@/lib/marta-publish";
import MartaLivePanel from "./MartaLivePanel";

export const dynamic = "force-dynamic";

export default async function MartaPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");
  const a = agentBySlug.marta;

  // Tenant del cliente — single-tenant durante la beta.
  const tenantId = DEFAULT_TENANT_ID;
  const proposals = await listProposalsByTenant(tenantId);
  const enabled = isPublishEnabled();

  return (
    <section>
      <div className="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span className="border-2 border-black px-2 py-1 font-bold tracking-widest" style={{ background: a.color }}>
          {a.role.toUpperCase()}
        </span>
        <span className="bg-green-700 text-white px-2 py-1 font-bold tracking-widest">LIVE</span>
      </div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-stencil text-4xl md:text-5xl leading-none">{a.name}</h1>
          <p className="text-sm text-black/60 mt-1">{a.short}</p>
        </div>
        <p className="text-xs font-mono text-black/50 max-w-xs text-right">
          ✓ Conectada a Instagram. Posts, Reels y Stories con flujo de aprobación por WhatsApp.
        </p>
      </div>

      <MartaLivePanel
        initialProposals={proposals.slice(0, 10)}
        enabled={enabled}
      />
    </section>
  );
}
