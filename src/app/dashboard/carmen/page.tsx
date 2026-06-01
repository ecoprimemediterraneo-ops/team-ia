import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import AgentChat from "@/components/AgentChat";
import CarmenTools from "@/components/CarmenTools";
import { agentBySlug } from "@/lib/agents";

export default async function CarmenPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");
  const a = agentBySlug.carmen;

  return (
    <section>
      <div className="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span className="border-2 border-black px-2 py-1 font-bold tracking-widest" style={{ background: a.color }}>
          {a.role.toUpperCase()}
        </span>
        <span className="bg-black/70 text-white px-2 py-1 font-bold tracking-widest">PRÓXIMAMENTE</span>
      </div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-stencil text-4xl md:text-5xl leading-none">{a.name}</h1>
          <p className="text-sm text-black/60 mt-1">{a.short}</p>
        </div>
        <p className="text-xs font-mono text-black/50 max-w-xs text-right">
          Carmen genera guiones de llamada con IA. Atención automática por voz: próximamente.
        </p>
      </div>

      <AgentChat
        agent="carmen"
        initialMessages={user.chats.carmen}
        placeholder="Habla como un cliente al teléfono…"
        suggestions={[
          "Hola, ¿podría pedir una cita para mañana?",
          "Llamo para preguntar precios",
          "Quería información sobre vuestros servicios",
        ]}
      />

      <CarmenTools />
    </section>
  );
}
