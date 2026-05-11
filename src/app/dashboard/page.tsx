import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { agents, agentBySlug, type AgentSlug } from "@/lib/agents";

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
  const leadsThisWeek = contacts.filter((c) => new Date(c.addedAt) >= weekStart).length;
  const emailsThisWeek = activity.filter(
    (a) => a.type === "email_sent" && new Date(a.ts) >= weekStart
  ).reduce((sum, a) => {
    // detail format: "N email[s] · ..."
    const match = a.detail.match(/^(\d+)\s/);
    return sum + (match ? parseInt(match[1]) : 1);
  }, 0);
  const chatsThisWeek = activity.filter(
    (a) => a.type === "chat" && new Date(a.ts) >= weekStart
  ).length;

  const recentActivity = activity.slice(0, 8);

  const agentIcon = (slug?: AgentSlug) => slug ? agentBySlug[slug].emoji : "📋";
  const agentName = (slug?: AgentSlug) => slug ? agentBySlug[slug].name : "—";

  const eventLabel = (e: typeof activity[number]) => {
    if (e.type === "chat") return `Chat con ${agentName(e.agent)}`;
    if (e.type === "email_sent") return `Email enviado · ${agentName(e.agent)}`;
    if (e.type === "lead_captured") return "Nuevo lead";
    if (e.type === "contact_added") return "Contacto añadido";
    return e.type;
  };

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
              <span className="bg-black text-[color:var(--mustard)] px-2 py-0.5 font-bold tracking-widest">CUARTEL GENERAL</span>
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-0.5 font-bold tracking-widest hidden sm:inline">UNIDAD OPERATIVA</span>
            </div>
            <h1 className="font-stencil text-3xl md:text-5xl leading-[1]">Hola, jefe.</h1>
            <p className="text-black/70 mt-1 text-sm">{user.business.nombre} · {user.business.sector}</p>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Leads esta semana</div>
          <div className="font-stencil text-4xl mt-1">{leadsThisWeek}</div>
          <div className="text-xs text-black/50 mt-1">Total: {contacts.length}</div>
        </div>
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Emails enviados</div>
          <div className="font-stencil text-4xl mt-1">{emailsThisWeek}</div>
          <div className="text-xs text-black/50 mt-1">Total: {stats.emailsSent}</div>
        </div>
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Chats con tu unidad</div>
          <div className="font-stencil text-4xl mt-1">{chatsThisWeek}</div>
          <div className="text-xs text-black/50 mt-1">Esta semana</div>
        </div>
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Lista contactos</div>
          <div className="font-stencil text-4xl mt-1">{contacts.length}</div>
          <div className="text-xs text-black/50 mt-1">Eva los nutre</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        {/* ACTIVIDAD RECIENTE */}
        <div className="card-hard p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-stencil text-xl">Actividad reciente</h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/50">últimos {recentActivity.length}</span>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-black/60 italic py-6 text-center">
              Aún no hay actividad. Habla con un agente o comparte tu URL de captura para empezar.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((e, i) => (
                <li key={i} className="flex items-center gap-3 text-sm border-b border-black/10 pb-2 last:border-0">
                  <span className="text-xl">{agentIcon(e.agent)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="font-bold">{eventLabel(e)}</span>
                    <span className="block text-xs text-black/60 truncate">{e.detail}</span>
                  </span>
                  <span className="text-[11px] font-mono text-black/50 whitespace-nowrap">{timeAgo(e.ts)}</span>
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
        <h2 className="font-stencil text-2xl mb-3">Tu unidad</h2>
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
                  <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">{a.codename}</div>
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
