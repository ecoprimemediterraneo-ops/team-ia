import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { getUser } from "@/lib/store";
import Logo from "@/components/Logo";
import { agents, agentBySlug } from "@/lib/agents";
import { contextoPanelODefecto, puedeCambiarDeCuenta } from "@/lib/panel-contexto";
import SelectorCuenta from "@/components/SelectorCuenta";
import { tieneFuncion } from "@/lib/sectores";

// Las tarjetas de agente NO llevan insignia de estado. Había un "LIVE" verde en los
// conectados y un "PRÓXIMAMENTE" en Carmen y Rocío: al cliente no le dice nada útil y
// enseñar media plantilla marcada como pendiente resta más de lo que informa. Los
// agentes siguen todos en la lista; lo que se ha quitado es el cartelito.

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // En producción exige sesión real; en desarrollo local entra con dueño por defecto.
  const session = await getSessionLocal();
  if (!session) redirect("/login");
  const user = await getUser(session.email);

  // Perfil de sector del cliente: decide QUÉ agentes ve y EN QUÉ ORDEN.
  // Un salón no necesita a Sergio; un despacho de abogados abre por Lucía.
  // Si el tenant es la cuenta comercial de AI-Team (sector null), se enseñan
  // todos, como hasta ahora.
  const ctx = await contextoPanelODefecto();
  const visibles: typeof agents = ctx.sector
    ? ctx.perfil.agentes.map((slug) => agentBySlug[slug]).filter(Boolean)
    : agents;
  const v = ctx.vocabulario;

  return (
    <div className="min-h-screen bg-[color:var(--cream)]">
      <header className="border-b-[3px] border-black bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 py-3">
          <a href="/dashboard"><Logo size="sm" /></a>
          <div className="flex items-center gap-4 text-sm">
            {session.dev && (
              <span className="text-[9px] uppercase tracking-widest font-bold bg-[color:var(--mustard)] border-2 border-black px-1.5 py-0.5" title="Sesión de desarrollo local (sin login). En producción exige magic link.">DEV</span>
            )}
            {/* Selector de cuenta: SOLO para el fundador. Un cliente no puede ni ver la
                lista de los demás tenants, así que se decide en el servidor. */}
            {puedeCambiarDeCuenta(session.email) && (
              <SelectorCuenta tenantIdActual={ctx.tenantId} mirandoOtro={ctx.mirandoOtro} />
            )}
            <span className="hidden sm:inline font-mono text-black/60">{session.email}</span>
            <form action="/api/auth/logout" method="post">
              <button className="text-xs uppercase tracking-widest font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white">Salir</button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid md:grid-cols-[260px_1fr] gap-6 px-5 py-6">
        <aside className="space-y-2">
          <a
            href="/dashboard/reservas"
            className="card-hard flex items-center gap-3 p-3 mb-3 hover:-translate-y-0.5 transition"
            style={{ background: "var(--mustard)" }}
          >
            <span className="text-2xl">📅</span>
            <span className="flex-1 min-w-0">
              {/* Se llamaba "AGENDA": no se identificaba como el módulo de reservas online
                  y no había forma de llegar a /dashboard/reservas salvo tecleando la URL. */}
              <span className="block font-stencil text-xl leading-none">{ctx.perfil.id === "legal" ? "CONSULTAS" : "RESERVAS"}</span>
              {/* Mismo orden que las pestañas de ReservasPanel: informes al final. */}
              <span className="block text-[10px] uppercase tracking-widest text-black/70">Agenda · {v.clientePlural} · compartir · informes mensuales</span>
            </span>
          </a>
          {/* Seguimiento (recall + presupuestos): solo donde el sector lo enciende.
              En un salón no existe la revisión a seis meses y enseñarlo vacío
              solo confunde. */}
          {(tieneFuncion(ctx.sector, "recall") || tieneFuncion(ctx.sector, "seguimientoPresupuestos")) && (
            <a
              href="/dashboard/seguimiento"
              className="card-hard flex items-center gap-3 p-3 mb-3 hover:-translate-y-0.5 transition bg-white"
            >
              <span className="text-2xl">🔁</span>
              <span className="flex-1 min-w-0">
                <span className="block font-stencil text-xl leading-none">SEGUIMIENTO</span>
                <span className="block text-[10px] uppercase tracking-widest text-black/70">
                  Revisiones · presupuestos
                </span>
              </span>
            </a>
          )}
          <div className="text-xs font-mono uppercase tracking-widest text-black/50 px-1 mb-2">
            Tu equipo · {visibles.length} {visibles.length === 1 ? "agente" : "agentes"}
          </div>
          {visibles.map((a) => (
            <a
              key={a.slug}
              href={`/dashboard/${a.slug}`}
              className="card-hard flex items-center gap-3 p-2.5 hover:-translate-y-0.5 transition relative overflow-hidden"
              style={{ background: a.color }}
            >
              <div className="relative w-12 h-12 border-[2px] border-black overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                <span className="absolute -bottom-0.5 -right-0.5 bg-white border-2 border-black w-5 h-5 flex items-center justify-center text-[10px]">
                  {a.emoji}
                </span>
              </div>
              <span className="flex-1 min-w-0">
                <span className="block font-stencil text-lg leading-none truncate">{a.name}</span>
                <span className="block text-[10px] uppercase tracking-widest text-black/70 truncate">{a.role}</span>
              </span>
            </a>
          ))}
          <a
            href="/dashboard/perfil"
            className="block mt-4 p-3 border-2 border-dashed border-black text-xs hover:bg-[color:var(--mustard)]/30"
          >
            <div className="font-bold mb-0.5">⚙️ Perfil del negocio</div>
            <div className="text-black/60">Edita tono, servicios, público</div>
          </a>
          <a
            href="/dashboard/valor"
            className="block mt-2 p-3 border-2 border-dashed border-black text-xs hover:bg-[color:var(--mustard)]/30"
          >
            <div className="font-bold mb-0.5">💰 Valor generado</div>
            <div className="text-black/60">Tiempo y € que te ahorra</div>
          </a>
          <a
            href="/dashboard/lecciones"
            className="block mt-2 p-3 border-2 border-dashed border-black text-xs hover:bg-[color:var(--mustard)]/30"
          >
            <div className="font-bold mb-0.5">📚 Lecciones aprendidas</div>
            <div className="text-black/60">Cómo evolucionan tus agentes</div>
          </a>
          <a
            href="/dashboard/redes"
            className="block mt-2 p-3 border-2 border-dashed border-black text-xs hover:bg-[color:var(--mustard)]/30"
          >
            <div className="font-bold mb-0.5">📱 Redes Sociales</div>
            <div className="text-black/60">IG + LinkedIn + TikTok · 80 piezas</div>
          </a>
          {!user.business && (
            <div className="mt-4 p-3 border-2 border-dashed border-black text-xs">
              <div className="font-bold mb-1">Sin configurar</div>
              <a href="/onboarding" className="underline">Completa el briefing →</a>
            </div>
          )}
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}
