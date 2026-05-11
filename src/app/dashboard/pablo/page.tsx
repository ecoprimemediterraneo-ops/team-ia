import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import AgentChat from "@/components/AgentChat";
import PabloTools from "@/components/PabloTools";
import PabloWaitlist from "@/components/PabloWaitlist";
import { agentBySlug } from "@/lib/agents";

export default async function PabloPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");
  const a = agentBySlug.pablo;

  return (
    <section>
      <div className="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span className="px-2 py-1 font-bold tracking-widest border-2 border-black" style={{ background: a.color }}>
          {a.codename}
        </span>
        <span className="border-2 border-black px-2 py-1 font-bold tracking-widest">{a.role.toUpperCase()}</span>
        <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">★ MODO MANUAL OPERATIVO</span>
      </div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-stencil text-4xl md:text-5xl leading-none">{a.name}</h1>
          <p className="text-sm text-black/60 mt-1">{a.short}</p>
        </div>
        <p className="text-xs font-mono text-black/50 max-w-xs text-right">
          ✓ Respuestas WhatsApp con IA. Auto-respuesta 24/7: en alta de Meta Business.
        </p>
      </div>

      <AgentChat
        agent="pablo"
        initialMessages={user.chats.pablo}
        placeholder="Escribe como un cliente por WhatsApp…"
        suggestions={[
          "Hola, ¿qué precio tiene una limpieza?",
          "¿Puedo pedir cita para esta semana?",
          "¿Qué horarios tenéis los sábados?",
        ]}
      />

      <PabloTools />
      <PabloWaitlist />
    </section>
  );
}
