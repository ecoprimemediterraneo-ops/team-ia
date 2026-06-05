import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import AgentChat from "@/components/AgentChat";
import SergioTools from "@/components/SergioTools";
import { agentBySlug } from "@/lib/agents";

export default async function SergioPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");
  const a = agentBySlug.sergio;

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
          <span className="border-2 border-black px-2 py-0.5 font-bold tracking-widest" style={{ background: a.color, color: "white" }}>
            {a.role.toUpperCase()}
          </span>
          <span className="bg-black/70 text-white px-2 py-0.5 font-bold tracking-widest">PRÓXIMAMENTE</span>
          <span className="ml-auto text-[11px] font-mono text-black/55 hidden md:inline truncate max-w-[55%]">
            ✓ Scraping web con IA · alertas críticas en tiempo real
          </span>
        </div>
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <h1 className="font-stencil text-3xl md:text-4xl leading-none">{a.name}</h1>
            <p className="text-sm text-black/60 mt-0.5">{a.short}</p>
          </div>
          <p className="text-[11px] font-mono text-black/55 md:hidden">
            ✓ Scraping web con IA
          </p>
        </div>
      </header>

      {/* Generador a ancho completo (input | output side-by-side a partir de lg) */}
      <SergioTools />

      {/* Chat de prueba debajo, ancho completo y compacto */}
      <AgentChat
        agent="sergio"
        initialMessages={user.chats.sergio}
        placeholder="Pregunta a Sergio sobre tus competidores…"
        suggestions={[
          "¿Qué cambios han detectado esta semana?",
          "¿Cuál es el precio de mi competidor principal?",
          "Dame un resumen de inteligencia de mercado",
        ]}
      />
    </section>
  );
}
