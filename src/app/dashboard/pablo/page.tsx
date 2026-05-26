import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import AgentChat from "@/components/AgentChat";
import PabloTools from "@/components/PabloTools";
import PabloWaitlist from "@/components/PabloWaitlist";
import PabloDashboard from "@/components/PabloDashboard";
import PabloAnalytics from "@/components/PabloAnalytics";
import PabloAbTest from "@/components/PabloAbTest";
import PabloTemplates from "@/components/PabloTemplates";
import PabloReportes from "@/components/PabloReportes";
import PabloPipeline from "@/components/PabloPipeline";
import PabloCitas from "@/components/PabloCitas";
import PabloCatalogo from "@/components/PabloCatalogo";
import PabloKeywords from "@/components/PabloKeywords";
import PabloInsights from "@/components/PabloInsights";
import PabloVoice from "@/components/PabloVoice";
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
        <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">★ BETA OPERATIVO</span>
      </div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-stencil text-4xl md:text-5xl leading-none">{a.name}</h1>
          <p className="text-sm text-black/60 mt-1">{a.short}</p>
        </div>
        <p className="text-xs font-mono text-black/50 max-w-xs text-right">
          ✓ Módulo WhatsApp completo (clasificador intent + cola aprobación + leads + escalado). Auto-envío 24/7: pendiente alta WhatsApp Business Cloud API.
        </p>
      </div>

      <PabloDashboard />

      <div className="mt-10 mb-4">
        <h2 className="font-stencil text-3xl">💬 Pregunta a Pablo</h2>
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

      <div className="mt-10 mb-4">
        <h2 className="font-stencil text-3xl">📊 Inteligencia (Tanda 2)</h2>
        <p className="text-xs font-mono text-black/60 mt-1">Analytics, A/B test, templates rápidos y reportes mensuales.</p>
      </div>
      <PabloAnalytics />
      <div className="mt-6" />
      <PabloAbTest />
      <div className="mt-6" />
      <PabloTemplates />
      <div className="mt-6" />
      <PabloReportes />

      <div className="mt-10 mb-4">
        <h2 className="font-stencil text-3xl">🎯 CRM + Citas + Catálogo (Tanda 3)</h2>
        <p className="text-xs font-mono text-black/60 mt-1">Pipeline de leads · citas con recordatorios automáticos · catálogo de servicios con precio.</p>
      </div>
      <PabloPipeline />
      <div className="mt-6" />
      <PabloCitas />
      <div className="mt-6" />
      <PabloCatalogo />

      <div className="mt-10 mb-4">
        <h2 className="font-stencil text-3xl">🧠 Insights + 🎙️ Voz + 🚨 Seguridad (Tanda 4)</h2>
        <p className="text-xs font-mono text-black/60 mt-1">BI conversacional · audios WhatsApp con voz natural · keywords críticas para escalar/bloquear auto.</p>
      </div>
      <PabloInsights />
      <div className="mt-6" />
      <PabloVoice />
      <div className="mt-6" />
      <PabloKeywords />
    </section>
  );
}
