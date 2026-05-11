import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser, getFeedback } from "@/lib/store";
import { agentBySlug } from "@/lib/agents";

export default async function ValorPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");

  const activity = user.activity ?? [];
  const stats = user.stats ?? { emailsSent: 0, lastChatAt: {} };
  const contacts = user.contacts ?? [];
  const feedback = await getFeedback(s.email);

  // Estimaciones de valor por agente (basadas en métricas internas conservadoras)
  const chatsByAgent: Record<string, number> = {};
  for (const a of activity.filter((x) => x.type === "chat")) {
    if (a.agent) chatsByAgent[a.agent] = (chatsByAgent[a.agent] || 0) + 1;
  }

  const valorPorAgente = [
    {
      slug: "pablo",
      titulo: "Pablo te ahorró tiempo en WhatsApp",
      estimado: `${(chatsByAgent.pablo || 0) * 3} min`,
      detalle: `${chatsByAgent.pablo || 0} respuestas generadas · ~3 min/respuesta vs hacerlas a mano`,
    },
    {
      slug: "lucia",
      titulo: "Lucía organizó tu correo",
      estimado: `${(chatsByAgent.lucia || 0) * 5} min`,
      detalle: `${chatsByAgent.lucia || 0} acciones · ~5 min/correo en clasificar y redactar`,
    },
    {
      slug: "eva",
      titulo: "Eva mantuvo tu lista activa",
      estimado: `${stats.emailsSent} envíos · ${contacts.length} contactos`,
      detalle: `Cada email mantiene relación, evita ghosting de pacientes inactivos`,
    },
    {
      slug: "rocio",
      titulo: "Rocío respondió reseñas",
      estimado: `${chatsByAgent.rocio || 0} respuestas`,
      detalle: `Cada reseña respondida sube 0.05-0.1★ tu Google a medio plazo`,
    },
    {
      slug: "marta",
      titulo: "Marta publicó contenido",
      estimado: `${chatsByAgent.marta || 0} posts`,
      detalle: `~30 min/post ahorrados vs crearlos a mano`,
    },
    {
      slug: "carmen",
      titulo: "Carmen preparó guiones",
      estimado: `${chatsByAgent.carmen || 0} guiones`,
      detalle: `Recepción deja de quedarse en blanco al teléfono`,
    },
  ];

  const totalMin =
    (chatsByAgent.pablo || 0) * 3 +
    (chatsByAgent.lucia || 0) * 5 +
    (chatsByAgent.marta || 0) * 30 +
    (chatsByAgent.carmen || 0) * 5 +
    (chatsByAgent.rocio || 0) * 3;
  const totalH = Math.round(totalMin / 60 * 10) / 10;
  const valorEur = Math.round(totalH * 25); // 25€/h salario neto recepcionista

  const calidad = feedback.length > 0
    ? Math.round((feedback.filter((f) => f.rating === "up").length / feedback.length) * 100)
    : null;

  return (
    <section>
      <div className="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">VALOR OPERATIVO</span>
        <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">INFORME EJECUTIVO</span>
      </div>
      <h1 className="font-stencil text-4xl md:text-5xl mb-2 leading-none">¿Cuánto te aporta tu unidad?</h1>
      <p className="text-sm text-black/60 mb-6">
        Estimaciones conservadoras basadas en tu actividad real.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card-hard p-5 bg-[color:var(--mustard)]">
          <div className="text-xs font-mono uppercase tracking-widest">Tiempo ahorrado</div>
          <div className="font-stencil text-5xl mt-1">{totalH}h</div>
          <div className="text-xs mt-1">acumulado</div>
        </div>
        <div className="card-hard p-5">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Valor en € (a 25€/h)</div>
          <div className="font-stencil text-5xl mt-1">{valorEur}€</div>
          <div className="text-xs text-black/60 mt-1">salario equivalente</div>
        </div>
        <div className="card-hard p-5">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Calidad respuestas</div>
          <div className="font-stencil text-5xl mt-1">{calidad === null ? "—" : `${calidad}%`}</div>
          <div className="text-xs text-black/60 mt-1">{feedback.length} feedback</div>
        </div>
        <div className="card-hard p-5">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Contactos en lista</div>
          <div className="font-stencil text-5xl mt-1">{contacts.length}</div>
          <div className="text-xs text-black/60 mt-1">{stats.emailsSent} emails enviados</div>
        </div>
      </div>

      <div className="space-y-3">
        {valorPorAgente.map((v) => {
          const a = agentBySlug[v.slug as keyof typeof agentBySlug];
          return (
            <article key={v.slug} className="card-hard p-4 flex items-center gap-4 bg-white">
              <div
                className="relative w-14 h-14 border-[3px] border-black overflow-hidden shrink-0"
                style={{ background: a.color }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{v.titulo}</div>
                <div className="text-xs text-black/60 mt-0.5">{v.detalle}</div>
              </div>
              <div className="font-stencil text-2xl text-[color:var(--red)] shrink-0">
                {v.estimado}
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-xs text-black/50 mt-6 italic">
        Estimaciones conservadoras. El valor real depende de tu sector y volumen. Los datos no salen de tu cuenta.
      </p>
    </section>
  );
}
