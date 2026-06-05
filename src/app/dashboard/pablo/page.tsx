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
    <section className="space-y-4">
      {/* CABECERA — compacta, ancho completo */}
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
          <span
            className="border-2 border-black px-2 py-0.5 font-bold tracking-widest"
            style={{ background: a.color }}
          >
            {a.role.toUpperCase()}
          </span>
          <span className="bg-green-700 text-white px-2 py-0.5 font-bold tracking-widest">
            LIVE
          </span>
          <span className="ml-auto text-[11px] font-mono text-black/55 hidden md:inline">
            ✓ Conectado a WhatsApp Business Cloud · 24/7
          </span>
        </div>
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-stencil text-3xl md:text-4xl leading-none">{a.name}</h1>
            <p className="text-sm text-black/60 mt-0.5">{a.short}</p>
          </div>
          <p className="text-[11px] font-mono text-black/55 md:hidden">
            ✓ Conectado a WhatsApp Business Cloud · 24/7
          </p>
        </div>
      </header>

      {/* Generador a ancho completo — usa su grid interno a partir de lg */}
      <PabloTools />

      {/* Chat de prueba + lista de espera en 2-col equilibradas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
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
        <PabloWaitlist />
      </div>
    </section>
  );
}
