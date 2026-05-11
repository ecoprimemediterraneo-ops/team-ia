import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFeedback, getLearnedPatterns, getUser } from "@/lib/store";
import { agentBySlug } from "@/lib/agents";

export default async function LeccionesPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");

  const allFeedback = await getFeedback(s.email, undefined, 100);
  const allLessons = await getLearnedPatterns(s.email, undefined, 100);

  const stats = {
    total: allFeedback.length,
    ups: allFeedback.filter((f) => f.rating === "up").length,
    downs: allFeedback.filter((f) => f.rating === "down").length,
    rate: allFeedback.length > 0
      ? Math.round((allFeedback.filter((f) => f.rating === "up").length / allFeedback.length) * 100)
      : 0,
  };

  return (
    <section>
      <div className="flex items-center gap-3 mb-3 text-xs font-mono flex-wrap">
        <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">MEMORIA INSTITUCIONAL</span>
        <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">APRENDIZAJE CONTINUO</span>
      </div>
      <h1 className="font-stencil text-4xl md:text-5xl mb-2 leading-none">Lecciones aprendidas</h1>
      <p className="text-sm text-black/60 mb-6">
        Cada vez que corriges una respuesta del agente, queda guardada como gold standard. Tus agentes aprenden tu tono.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Feedback total</div>
          <div className="font-stencil text-4xl mt-1">{stats.total}</div>
        </div>
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">% buenas</div>
          <div className="font-stencil text-4xl mt-1">{stats.rate}%</div>
        </div>
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">👍 Buenas</div>
          <div className="font-stencil text-4xl mt-1">{stats.ups}</div>
        </div>
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">📚 Lecciones</div>
          <div className="font-stencil text-4xl mt-1">{allLessons.length}</div>
        </div>
      </div>

      <div className="card-hard p-5 mb-6">
        <h2 className="font-stencil text-2xl mb-4">Tus correcciones (gold standards)</h2>
        {allLessons.length === 0 ? (
          <p className="text-sm text-black/60 italic py-6 text-center">
            Todavía no has corregido ninguna respuesta. Cuando un agente conteste algo que mejorarías, dale al ✏️ y escribe tu versión. La aprenderá para futuras conversaciones.
          </p>
        ) : (
          <ul className="space-y-3">
            {allLessons.map((l) => {
              const a = agentBySlug[l.agent];
              return (
                <li key={l.id} className="border-2 border-black p-4 bg-[color:var(--cream)]">
                  <div className="flex items-center gap-2 mb-2 text-xs font-mono">
                    <span className="px-2 py-0.5 font-bold tracking-widest border-2 border-black" style={{ background: a.color }}>
                      {a.name.toUpperCase()}
                    </span>
                    <span className="text-black/60">{new Date(l.ts).toLocaleString("es-ES")}</span>
                  </div>
                  <div className="text-xs text-black/60 mb-1">Contexto:</div>
                  <p className="text-sm italic mb-2">«{l.context}»</p>
                  <div className="text-xs text-black/60 mb-1">Tu versión correcta:</div>
                  <p className="text-sm font-bold whitespace-pre-wrap">{l.goldStandard}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card-hard p-5">
        <h2 className="font-stencil text-2xl mb-4">Últimos feedbacks</h2>
        {allFeedback.length === 0 ? (
          <p className="text-sm text-black/60 italic py-6 text-center">Sin feedback aún. Vota 👍/👎 las respuestas de tus agentes para empezar a entrenarlos.</p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {allFeedback.slice(0, 30).map((f) => {
              const a = agentBySlug[f.agent];
              return (
                <li key={f.id} className="border-b border-black/10 pb-2 text-sm flex items-start gap-3">
                  <span className="text-2xl shrink-0">{f.rating === "up" ? "👍" : "👎"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs font-mono mb-1">
                      <span style={{ color: a.color }} className="font-bold">{a.name}</span>
                      <span className="text-black/50">{new Date(f.ts).toLocaleString("es-ES")}</span>
                    </div>
                    <p className="text-xs text-black/60 truncate italic">«{f.userMessage}»</p>
                    <p className="text-xs truncate">→ {f.agentResponse}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
