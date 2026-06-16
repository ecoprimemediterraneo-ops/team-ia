import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { agentBySlug } from "@/lib/agents";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import { listProposalsByTenant } from "@/lib/marta-proposals";
import { isPublishEnabled } from "@/lib/marta-publish";
import { getSchedule, DIRECT_PUBLISH_ENABLED, CRON_GRANULARITY } from "@/lib/marta-schedule";
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
  const schedule = await getSchedule(tenantId);

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
          <span className="border-2 border-black px-2 py-0.5 font-bold tracking-widest" style={{ background: a.color }}>
            {a.role.toUpperCase()}
          </span>
          <span className="bg-green-700 text-white px-2 py-0.5 font-bold tracking-widest">LIVE</span>
          <span className="ml-auto text-[11px] font-mono text-black/55 hidden md:inline truncate max-w-[55%]">
            ✓ Conectada a Instagram · Posts, Reels y Stories con aprobación en la app
          </span>
        </div>
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <h1 className="font-stencil text-3xl md:text-4xl leading-none">{a.name}</h1>
            <p className="text-sm text-black/60 mt-0.5">{a.short}</p>
          </div>
          <p className="text-[11px] font-mono text-black/55 md:hidden">
            ✓ Conectada a Instagram · aprobación en la app
          </p>
        </div>
      </header>

      <MartaLivePanel
        initialProposals={proposals.slice(0, 10)}
        enabled={enabled}
        initialSchedule={schedule}
        directPublishEnabled={DIRECT_PUBLISH_ENABLED}
        cronDaily={CRON_GRANULARITY === "daily"}
      />
    </section>
  );
}
