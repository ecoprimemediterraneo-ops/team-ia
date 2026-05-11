import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { getUser, getContacts, getOrCreateWidget } from "@/lib/store";
import AgentChat from "@/components/AgentChat";
import EvaTools from "@/components/EvaTools";
import EvaWidget from "@/components/EvaWidget";
import EvaAutomation from "@/components/EvaAutomation";
import { agentBySlug } from "@/lib/agents";

export default async function EvaPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");
  const a = agentBySlug.eva;
  const contacts = await getContacts(s.email);
  const widget = await getOrCreateWidget(s.email);

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "https";
  const baseUrl = `${proto}://${host}`;

  return (
    <section>
      <div className="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span className="px-2 py-1 font-bold tracking-widest border-2 border-black" style={{ background: a.color }}>
          {a.codename}
        </span>
        <span className="border-2 border-black px-2 py-1 font-bold tracking-widest">{a.role.toUpperCase()}</span>
        <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">★ ENVÍO REAL ACTIVADO</span>
      </div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-stencil text-4xl md:text-5xl leading-none">{a.name}</h1>
          <p className="text-sm text-black/60 mt-1">{a.short}</p>
        </div>
        <p className="text-xs font-mono text-black/50 max-w-xs text-right">
          ✓ Conectada a Resend. Manda correos de verdad.
        </p>
      </div>

      <AgentChat
        agent="eva"
        initialMessages={user.chats.eva}
        placeholder="Pídele a Eva que escriba campañas de email…"
        suggestions={[
          "Diseña una secuencia de bienvenida para nuevos clientes",
          "Newsletter de esta semana con un consejo y una promo",
          "Email de reactivación para clientes que llevan 3 meses sin venir",
        ]}
      />

      <EvaWidget initial={widget} baseUrl={baseUrl} />

      <EvaTools initialContacts={contacts} />

      <EvaAutomation />
    </section>
  );
}
