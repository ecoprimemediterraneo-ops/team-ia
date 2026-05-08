import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { agents } from "@/lib/agents";

export default async function DashboardHome() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await getUser(session.email);

  if (!user.business) redirect("/onboarding");

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 text-xs font-mono">
        <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">CUARTEL GENERAL</span>
        <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">UNIDAD OPERATIVA</span>
      </div>
      <h1 className="font-stencil text-4xl md:text-6xl mb-2 leading-[1]">Hola, jefe.</h1>
      <p className="text-black/70 mb-8">Tu agencia de marketing está al completo. 6 especialistas listos para trabajar.</p>

      <div className="card-hard p-6 mb-6">
        <h2 className="font-stencil text-xl mb-3">Briefing del negocio</h2>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><dt className="text-black/50 text-xs uppercase tracking-widest">Negocio</dt><dd className="font-bold">{user.business.nombre}</dd></div>
          <div><dt className="text-black/50 text-xs uppercase tracking-widest">Sector</dt><dd className="font-bold">{user.business.sector}</dd></div>
          <div className="sm:col-span-2"><dt className="text-black/50 text-xs uppercase tracking-widest">Qué ofrece</dt><dd>{user.business.ofrece}</dd></div>
          <div><dt className="text-black/50 text-xs uppercase tracking-widest">Tono</dt><dd>{user.business.tono}</dd></div>
          <div><dt className="text-black/50 text-xs uppercase tracking-widest">Público</dt><dd>{user.business.publico}</dd></div>
        </dl>
        <a href="/onboarding" className="mt-4 inline-block text-xs underline">Editar briefing →</a>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((a) => (
          <a
            key={a.slug}
            href={`/dashboard/${a.slug}`}
            className="card-hard p-5 hover:-translate-y-1 transition block"
          >
            <div className="flex items-start gap-3 mb-2">
              <span
                className="w-12 h-12 border-[3px] border-black flex items-center justify-center text-2xl shrink-0"
                style={{ background: a.color }}
              >
                {a.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">{a.codename}</div>
                <h3 className="font-stencil text-xl leading-none">{a.name}</h3>
                <div className="text-[11px] uppercase tracking-widest text-black/60">{a.role}</div>
              </div>
            </div>
            <p className="text-sm text-black/70 leading-snug">{a.short}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
