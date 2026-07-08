// Lista de salones de booking (founder). Alta de nuevos + enlaces a la ficha
// pública y al panel del dueño.
import { redirect } from "next/navigation";
import { requireFounder } from "@/lib/admin-auth";
import { listBusinesses } from "@/lib/booking";

export const dynamic = "force-dynamic";

export default async function SalonesPage({ searchParams }: { searchParams: Promise<{ creado?: string }> }) {
  const a = await requireFounder();
  if (!a.ok) redirect("/login");
  const { creado } = await searchParams;
  const negocios = await listBusinesses();

  return (
    <div className="min-h-screen bg-[color:var(--cream)] px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <a href="/admin" className="text-xs font-mono underline text-black/50">← Admin</a>
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-black/40 mt-2">AI-Team Booking</div>
            <h1 className="font-stencil text-3xl sm:text-4xl leading-none mt-1">Salones</h1>
          </div>
          <a href="/admin/salones/nuevo" className="btn-mustard">＋ Nuevo salón</a>
        </div>

        {creado && (
          <div className="border-2 border-[color:var(--olive,#5A6B3F)] text-[color:var(--olive,#5A6B3F)] font-bold p-3 mb-4">
            ✓ Salón creado: <b>{creado}</b>. <a className="underline" href={`/reservas/${creado}`}>Ver ficha pública →</a>
          </div>
        )}

        <div className="space-y-2">
          {negocios.map((b) => (
            <div key={b.slug} className="card-hard bg-white p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-bold truncate">{b.nombre}</div>
                <div className="text-xs text-black/50 truncate">
                  /{b.slug} · {b.servicios.length} servicios · {b.categorias.length} categorías{b.direccion ? ` · ${b.direccion}` : ""}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={`/reservas/${b.slug}`} className="border-2 border-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-white hover:bg-[color:var(--cream)]">Ficha</a>
                <a href={`/reservas/${b.slug}`} className="border-2 border-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-white hover:bg-[color:var(--cream)]" title="Panel del dueño en /dashboard/reservas">↗</a>
              </div>
            </div>
          ))}
          {negocios.length === 0 && <p className="text-sm text-black/50">Aún no hay salones. Crea el primero.</p>}
        </div>
      </div>
    </div>
  );
}
