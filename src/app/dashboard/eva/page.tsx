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
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
          <span className="border-2 border-black px-2 py-0.5 font-bold tracking-widest" style={{ background: a.color }}>
            {a.role.toUpperCase()}
          </span>
          <span className="bg-green-700 text-white px-2 py-0.5 font-bold tracking-widest">LIVE</span>
          <span className="ml-auto text-[11px] font-mono text-black/55 hidden md:inline">
            ✓ Conectada a Resend · Manda correos de verdad
          </span>
        </div>
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-stencil text-3xl md:text-4xl leading-none">{a.name}</h1>
            <p className="text-sm text-black/60 mt-0.5">{a.short}</p>
          </div>
          <p className="text-[11px] font-mono text-black/55 md:hidden">
            ✓ Conectada a Resend · Manda correos de verdad
          </p>
        </div>
      </header>

      {/* Lista + composer a ancho completo — su grid interno (lg:260px+1fr) se activa aquí */}
      <EvaTools initialContacts={contacts} />

      {/* Chat de prueba + widget de captación: pareja equilibrada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
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
      </div>

      {/* Secuencias automáticas — ancho completo (suele tener mucho contenido) */}
      <EvaAutomation />
    </section>
  );
}
