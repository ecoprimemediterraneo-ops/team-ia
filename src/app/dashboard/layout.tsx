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
          <div className="text-xs font-mono uppercase tracking-widest text-black/50 px-1 mb-2">Tu unidad · 6 especialistas</div>
          {agents.map((a) => (
            <a
              key={a.slug}
              href={`/dashboard/${a.slug}`}
              className="card-hard flex items-center gap-3 p-3 hover:-translate-y-0.5 transition relative"
              style={{ background: a.color }}
            >
              <span className="text-2xl">{a.emoji}</span>
              <span className="flex-1">
                <span className="block font-stencil text-lg leading-none">{a.name}</span>
                <span className="block text-[10px] uppercase tracking-widest text-black/70">{a.role}</span>
              </span>
              {a.status === "soon" && (
                <span className="absolute top-1 right-1 text-[8px] bg-black text-[color:var(--mustard)] px-1 py-0.5 font-bold tracking-widest">DEMO</span>
              )}
            </a>
          ))}
          {!user.business && (
            <div className="mt-6 p-3 border-2 border-dashed border-black text-xs">
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
