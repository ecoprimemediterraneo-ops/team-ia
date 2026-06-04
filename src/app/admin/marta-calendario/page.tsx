import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID, getTenant } from "@/lib/tenants";
import { listCalendar } from "@/lib/marta-calendar";
import CalendarForm from "./CalendarForm";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
export const dynamic = "force-dynamic";

function statusChip(status: string): { color: string; label: string } {
  switch (status) {
    case "scheduled": return { color: "bg-[color:var(--mustard)] text-black", label: "PROGRAMADO" };
    case "proposed":  return { color: "bg-[#14B8A6] text-white", label: "ENVIADO AL CLIENTE" };
    case "published": return { color: "bg-black text-[color:var(--mustard)]", label: "PUBLICADO" };
    case "rejected":  return { color: "bg-black/40 text-white", label: "RECHAZADO" };
    case "failed":    return { color: "bg-[color:var(--red)] text-white", label: "ERROR" };
    case "skipped":   return { color: "bg-black/20 text-black", label: "SALTADO" };
    default:          return { color: "bg-black/15 text-black", label: status.toUpperCase() };
  }
}

export default async function MartaCalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") redirect("/admin");
  const sp = await searchParams;
  const tenantId = sp.tenant || DEFAULT_TENANT_ID;
  const tenant = await getTenant(tenantId);
  const entries = await listCalendar(tenantId);

  return (
    <main className="min-h-screen bg-[color:var(--cream)] py-10 px-5">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3 text-xs">
          <a href="/admin" className="font-mono uppercase tracking-widest text-black/60 hover:text-black underline">← Admin</a>
          <span className="text-black/30">·</span>
          <span className="font-mono uppercase tracking-widest text-black/40">Marta · calendario</span>
        </div>

        <header>
          <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-2">MARTA · BLOQUE 6 · CALENDARIO</div>
          <h1 className="font-stencil text-3xl md:text-5xl leading-tight">Calendario de publicación</h1>
          <p className="text-sm text-black/60 mt-3 max-w-2xl">
            Genera y programa N posts repartidos en X días. Cada post sigue el
            flujo de aprobación por WhatsApp: cuando llega su hora, Marta envía
            la propuesta al cliente; si responde OK, se publica en Instagram.
          </p>
          {tenant && (<p className="text-xs font-mono mt-2 text-black/50">Tenant: {tenant.name} · {tenant.id}</p>)}
        </header>

        <CalendarForm tenantId={tenantId} />

        <section className="card-hard bg-white p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="font-stencil text-2xl">Próximos posts</h2>
            <form action={`/api/admin/marta-calendar/trigger?tenant=${tenantId}`} method="post" className="flex items-center gap-2">
              <input
                type="text"
                name="to"
                placeholder="WhatsApp cliente (34600…)"
                className="border-2 border-black px-2 py-1 text-xs font-mono"
              />
              <button
                type="submit"
                formAction={`/api/admin/marta-calendar/trigger?tenant=${tenantId}&to=`}
                className="border-2 border-black px-3 py-1 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-[color:var(--mustard)]"
              >
                Disparar vencidos
              </button>
            </form>
          </div>
          {entries.length === 0 ? (
            <p className="text-sm text-black/50">Aún no hay posts programados.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {entries.map((e) => {
                const chip = statusChip(e.status);
                return (
                  <li key={e.id} className="border-2 border-black/15 p-3 flex flex-wrap items-start gap-3">
                    <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 font-bold ${chip.color}`}>
                      {chip.label}
                    </span>
                    <span className="text-[11px] text-black/55 font-mono">
                      {new Date(e.scheduledAt).toLocaleString("es-ES")}
                    </span>
                    <span className="text-[11px] text-black/40 font-mono">{e.mediaType}</span>
                    <p className="text-xs text-black/75 w-full whitespace-pre-wrap line-clamp-3">
                      {e.caption}
                    </p>
                    {e.igMediaId && (
                      <p className="text-[10px] font-mono text-black/50 w-full">
                        igMediaId: {e.igMediaId}
                      </p>
                    )}
                    {e.errorDetail && (
                      <p className="text-[11px] text-[color:var(--red)] w-full">
                        Error: {e.errorDetail}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
