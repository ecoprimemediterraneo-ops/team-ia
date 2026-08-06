import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { getUser } from "@/lib/store";
import AgentChat from "@/components/AgentChat";
import PabloTools from "@/components/PabloTools";
import PabloWaitlist from "@/components/PabloWaitlist";
import { agentBySlug } from "@/lib/agents";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { leerConversaciones } from "@/lib/conversaciones";
import BandejaPablo from "@/components/pablo/BandejaPablo";

// Sin caché: la bandeja tiene que enseñar el último mensaje, no uno de hace un rato.
export const dynamic = "force-dynamic";

export default async function PabloPage() {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");
  const a = agentBySlug.pablo;

  // Las conversaciones salen del TENANT del panel, nunca del email de login ni
  // del tenant por defecto: un negocio no puede leer los mensajes de otro.
  const ctx = await contextoPanelODefecto();
  const conversaciones = await leerConversaciones(ctx.tenantId, { canal: "pablo" });
  const v = ctx.vocabulario;

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

      {/* BANDEJA — lo primero, porque es lo que el dueño viene a mirar:
          qué le está diciendo su IA a sus clientes. */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h2 className="font-stencil text-2xl leading-none">Conversaciones</h2>
          <span className="text-[11px] font-mono text-black/50">
            Lo que hablan tus {v.clientePlural} con Pablo
          </span>
        </div>
        <BandejaPablo
          conversaciones={conversaciones}
          vocab={{ cliente: v.cliente, clientePlural: v.clientePlural }}
        />
      </section>

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
