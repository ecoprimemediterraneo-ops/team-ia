import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { agents, agentBySlug, type AgentSlug } from "@/lib/agents";
import { getFeed } from "@/lib/feed";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function startOfWeek(): Date {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // monday=0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DashboardHome() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await getUser(session.email);

  if (!user.business) redirect("/onboarding");

  const contacts = user.contacts ?? [];
  const activity = user.activity ?? [];
  const stats = user.stats ?? { emailsSent: 0, lastChatAt: {} };
  const weekStart = startOfWeek();
  const emailsThisWeek = activity.filter(
    (a) => a.type === "email_sent" && new Date(a.ts) >= weekStart
  ).reduce((sum, a) => {
    const match = a.detail.match(/^(\d+)\s/);
    return sum + (match ? parseInt(match[1]) : 1);
  }, 0);

  // Feed real del event-log (este mes + anterior) — agenda + Pablo + Marta + Eva + Rocío
  const feed = await getFeed(DEFAULT_TENANT_ID, 12);
  const recentActivity = feed.entries;

  // Contadores: combinamos legacy (contacts/activity/stats) con event-log.
  const leadsThisWeek = contacts.filter((c) => new Date(c.addedAt) >= weekStart).length + feed.counters.leads;
  const chatsThisWeek = activity.filter(
    (a) => a.type === "chat" && new Date(a.ts) >= weekStart
  ).length;
  // Mensajes IN del event-log (entrantes de clientes vía Pablo/Marta) — refleja tráfico real
  const mensajesIn = feed.counters.mensajesIn;
  const citasMes = feed.counters.citas;

  // (helpers legacy quedan para el panel de Últimos leads más abajo si los necesitásemos)
  void agentBySlug;
  // Aviso a TS: AgentSlug se sigue usando indirectamente; mantenemos el import.
  type _Keep = AgentSlug;

  return (
    <div className="space-y-6">
      {/* Banner heroico con los 6 avatares */}
      <div className="relative card-hard overflow-hidden">
        <div className="brick absolute inset-0 opacity-30" />
        <div className="relative p-5 flex items-center gap-5 flex-wrap">
          <div className="flex -space-x-3">
            {agents.map((a) => (
              <div
                key={a.slug}
                className="relative w-14 h-14 border-[3px] border-black overflow-hidden shrink-0"
                style={{ background: a.color }}
                title={`${a.name} · ${a.role}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 text-xs font-mono">
              <span className="bg-black text-[color:var(--mustard)] px-2 py-0.5 font-bold tracking-widest">PANEL</span>
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-0.5 font-bold tracking-widest hidden sm:inline">TU CUENTA</span>
            </div>
            <h1 className="font-stencil text-3xl md:text-5xl leading-[1]">
              Hola{session.email ? `, ${session.email.split("@")[0]}` : ""}.
            </h1>
            <p className="text-black/70 mt-1 text-sm">{user.business.nombre} · {user.business.sector}</p>
          </div>
        </div>
      </div>

      {/* STATS — mezcla legacy + event-log */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Citas este mes</div>
          <div className="font-stencil text-4xl mt-1">{citasMes}</div>
          <div className="text-xs text-black/50 mt-1">Agenda central</div>
        </div>
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Mensajes de clientes</div>
          <div className="font-stencil text-4xl mt-1">{mensajesIn}</div>
          <div className="text-xs text-black/50 mt-1">Pablo + Marta · mes</div>
        </div>
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Leads esta semana</div>
          <div className="font-stencil text-4xl mt-1">{leadsThisWeek}</div>
          <div className="text-xs text-black/50 mt-1">Total contactos: {contacts.length}</div>
        </div>
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Emails enviados</div>
          <div className="font-stencil text-4xl mt-1">{emailsThisWeek}</div>
          <div className="text-xs text-black/50 mt-1">Total: {stats.emailsSent}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        {/* ACTIVIDAD RECIENTE — feed del event-log */}
        <div className="card-hard p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-stencil text-xl">Actividad reciente</h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/50">últimos {recentActivity.length}</span>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-black/60 italic py-6 text-center">
              Aún no hay actividad. Cuando tu equipo IA empiece a recibir mensajes, agendar citas o publicar
              respuestas, aparecerán aquí.
            </p>
          ) : (
            <ul className="space-y-1">
              {recentActivity.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start gap-3 text-sm border-b border-black/10 pb-2 last:border-0"
                >
                  {/* Avatar/emoji del agente con su color */}
                  <span
                    className="shrink-0 w-9 h-9 border-2 border-black flex items-center justify-center text-lg"
                    style={{ background: e.agentColor }}
                    title={e.agentName}
                  >
                    {e.agentEmoji}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold leading-tight">{e.label}</span>
                    {e.detail && (
                      <span className="block text-xs text-black/60 truncate">{e.detail}</span>
                    )}
                    {e.htmlLink && (
                      <a
                        href={e.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-[11px] font-bold underline mt-0.5"
                      >
                        Ver en Google Calendar →
                      </a>
                    )}
                  </span>
                  <span className="text-[11px] font-mono text-black/50 whitespace-nowrap pt-1">
                    {timeAgo(e.ts)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ÚLTIMOS LEADS */}
        <div className="card-hard p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-stencil text-xl">Últimos leads</h2>
            <a href="/dashboard/eva" className="text-[10px] font-mono uppercase tracking-widest text-black/50 underline">ver todos</a>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-black/60 italic py-6 text-center">
              Aún no has captado ningún lead. Activa el formulario en Eva.
            </p>
          ) : (
            <ul className="space-y-2">
              {[...contacts].reverse().slice(0, 5).map((c) => (
                <li key={c.email} className="text-sm border-b border-black/10 pb-2 last:border-0">
                  <div className="font-bold truncate">{c.name || c.email}</div>
                  <div className="flex items-center justify-between text-xs text-black/60">
                    <span className="truncate">{c.email}</span>
                    <span className="font-mono whitespace-nowrap pl-2">{timeAgo(c.addedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* AGENTES (compacto) */}
      <div>
        <h2 className="font-stencil text-2xl mb-3">Tu equipo</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((a) => {
            const last = stats.lastChatAt[a.slug];
            return (
              <a
                key={a.slug}
                href={`/dashboard/${a.slug}`}
                className="card-hard p-4 hover:-translate-y-0.5 transition flex items-center gap-3"
              >
                <span
                  className="w-12 h-12 border-[3px] border-black flex items-center justify-center text-2xl shrink-0"
                  style={{ background: a.color }}
                >
                  {a.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">{a.role}</div>
                  <div className="font-stencil text-lg leading-none">{a.name}</div>
                  <div className="text-[11px] text-black/60">
                    {last ? `Último uso: ${timeAgo(last)}` : "Sin estrenar"}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
