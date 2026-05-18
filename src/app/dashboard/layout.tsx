import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import Logo from "@/components/Logo";
import { agents } from "@/lib/agents";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await getUser(session.email);

  return (
    <div className="min-h-screen bg-[color:var(--cream)]">
      <header className="border-b-[3px] border-black bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 py-3">
          <a href="/dashboard"><Logo size="sm" /></a>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden sm:inline font-mono text-black/60">{session.email}</span>
            <form action="/api/auth/logout" method="post">
              <button className="text-xs uppercase tracking-widest font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white">Salir</button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid md:grid-cols-[260px_1fr] gap-6 px-5 py-6">
        <aside className="space-y-2">
          <div className="text-xs font-mono uppercase tracking-widest text-black/50 px-1 mb-2">Tu unidad · 8 especialistas</div>
          {agents.map((a) => (
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
              {a.status === "ready" ? (
                <span className="absolute top-1 right-1 text-[8px] bg-green-700 text-white px-1 py-0.5 font-bold tracking-widest">★ LIVE</span>
              ) : (
                <span className="absolute top-1 right-1 text-[8px] bg-black text-[color:var(--mustard)] px-1 py-0.5 font-bold tracking-widest">DEMO</span>
              )}
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
