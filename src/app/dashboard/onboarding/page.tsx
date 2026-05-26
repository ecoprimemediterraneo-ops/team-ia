import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getOnboardingState } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = { ok: "#14B8A6", config: "#FBBF24", needs_oauth: "#A88BE8", needs_provision: "#FF7A59", needs_dns: "#60A5FA", ready: "#94A3B8" };
const STATUS_LABELS: Record<string, string> = { ok: "✅ Operativo", config: "⚙️ Configurar", needs_oauth: "🔗 Conectar cuenta", needs_provision: "📞 Asignar número", needs_dns: "🌐 Configurar DNS", ready: "▶ Listo" };

export default async function OnboardingPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const steps = await getOnboardingState(s.email);
  const ok = steps.filter((x) => x.status === "ok").length;
  const total = steps.length;
  const pct = Math.round((ok / total) * 100);

  return (
    <section>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-stencil text-4xl md:text-5xl leading-none">🚀 Configura tu equipo IA</h1>
          <p className="text-sm text-black/60 mt-1">Cada agente necesita conectarse a tus cuentas. 5-10 minutos.</p>
        </div>
        <div className="card-hard p-3 bg-[color:var(--mustard)] text-center">
          <div className="font-stencil text-3xl">{ok}/{total}</div>
          <div className="text-[10px] font-mono uppercase">Agentes listos</div>
        </div>
      </div>

      <div className="card-hard p-3 bg-white mb-6">
        <div className="h-3 bg-black/10 relative">
          <div className="h-full bg-[#14B8A6] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[10px] font-mono uppercase text-black/60 mt-1 text-center">{pct}% configurado</div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {steps.map((step) => (
          <a key={step.slug} href={step.cta.href} className="card-hard p-4 bg-white hover:-translate-y-1 transition-transform" style={{ borderLeftWidth: 6, borderLeftColor: STATUS_COLORS[step.status] }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{step.emoji}</span>
              <div className="font-bold text-sm">{step.name}</div>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2 px-2 py-0.5 inline-block text-white" style={{ background: STATUS_COLORS[step.status] }}>
              {STATUS_LABELS[step.status]}
            </div>
            <p className="text-xs text-black/70 mb-3">{step.description}</p>
            {step.blockers.length > 1 && (
              <ul className="text-[10px] text-[color:var(--red)] space-y-0.5 mb-2">
                {step.blockers.slice(1).map((b, i) => (<li key={i}>⚠ {b}</li>))}
              </ul>
            )}
            <div className="text-xs font-bold underline">{step.cta.label} →</div>
          </a>
        ))}
      </div>

      <div className="mt-8 card-hard p-4 bg-[#06B6D4]/10 border-[#06B6D4]">
        <div className="text-sm">
          <b>¿Te atascas?</b> Habla con Tomás (botón flotante abajo a la derecha). Tiene acceso al estado de tus agentes y te dará pasos concretos para cada caso.
        </div>
      </div>
    </section>
  );
}
