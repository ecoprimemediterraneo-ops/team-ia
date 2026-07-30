// /admin/sectores — panel de control del perfil de sector.
//
// Tres cosas:
//   1. Ver los cuatro perfiles: agentes, KPIs, vocabulario y prohibiciones.
//   2. Crear los negocios de ejemplo y abrir el panel de cada uno.
//   3. Comparar cómo contesta Pablo al MISMO mensaje en los cuatro sectores.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { SECTORES_LISTA } from "@/lib/sectores";
import { DEMOS, sembrarDemos } from "@/lib/sectores-demo";
import { getTenant } from "@/lib/tenants";
import SectorLab from "./SectorLab";

export const dynamic = "force-dynamic";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export default async function SectoresPage({
  searchParams,
}: {
  searchParams: Promise<{ sembrar?: string }>;
}) {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") redirect("/admin");

  const sp = await searchParams;
  let sembrado: { id: string; sector: string; creado: boolean; slug: string }[] | null = null;
  if (sp.sembrar === "1") sembrado = await sembrarDemos();

  const estado = await Promise.all(
    DEMOS.map(async (d) => ({ ...d, existe: !!(await getTenant(d.id)) })),
  );
  const hayDemos = estado.every((e) => e.existe);

  return (
    <div className="min-h-screen bg-[color:var(--cream)] px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <a href="/admin" className="text-xs font-mono underline text-black/50">← Admin</a>
          <h1 className="font-stencil text-3xl sm:text-4xl mt-2">Perfil de sector</h1>
          <p className="text-sm text-black/60 mt-1 max-w-2xl">
            Cuatro sectores en la beta. Cada uno decide qué agentes ve el cliente, con qué números abre
            su panel, qué palabras se usan y —lo importante— cómo habla cada IA.
          </p>
        </div>

        {/* Negocios de ejemplo */}
        <section className="card-hard bg-white p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-stencil text-xl">Negocios de ejemplo</h2>
            <a href="/admin/sectores?sembrar=1" className="btn-mustard text-xs px-3 py-2">
              {hayDemos ? "🔄 REPONER LOS 4" : "＋ CREAR LOS 4"}
            </a>
          </div>
          {sembrado && (
            <p className="text-xs font-mono bg-green-100 border-2 border-black px-2 py-1 mb-3 inline-block">
              Listo: {sembrado.filter((x) => x.creado).length} creados, {sembrado.filter((x) => !x.creado).length} actualizados.
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {estado.map((d) => (
              <div key={d.id} className="border-2 border-black p-3">
                <div className="font-bold">{d.nombre}</div>
                <div className="text-xs font-mono text-black/50 mb-2">{d.id}</div>
                {d.existe ? (
                  <a href={`/admin/ver-panel/${d.id}`} className="text-xs font-mono border-2 border-black px-2 py-1 inline-block hover:bg-black hover:text-white">
                    Ver su panel →
                  </a>
                ) : (
                  <span className="text-xs text-black/50">Todavía sin crear</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-black/50 mt-3">
            Al abrir el panel de un ejemplo se queda una cookie de vista.{" "}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ver-panel es un
                route handler que pone una cookie y redirige: necesita navegación completa,
                no la del router del cliente. */}
            <a href="/admin/ver-panel/propio" className="underline">Volver a tu panel</a>.
          </p>
        </section>

        {/* Banco de pruebas */}
        <section>
          <h2 className="font-stencil text-xl mb-2">El mismo mensaje en los cuatro sectores</h2>
          <SectorLab hayDemos={hayDemos} />
        </section>

        {/* Los perfiles */}
        <section className="space-y-4">
          <h2 className="font-stencil text-xl">Qué define cada sector</h2>
          {SECTORES_LISTA.map((p) => (
            <div key={p.id} className="card-hard bg-white p-4">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="font-stencil text-lg">{p.label}</h3>
                <code className="text-[11px] bg-black/5 px-1">{p.id}</code>
              </div>
              <p className="text-sm text-black/60 mt-1">{p.descripcion}</p>

              <div className="grid md:grid-cols-2 gap-4 mt-3 text-sm">
                <div>
                  <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-1">Agentes, en orden</div>
                  <p>{p.agentes.join(" · ")}</p>

                  <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-1 mt-3">Abre el panel con</div>
                  <ul className="list-disc pl-5">
                    {p.kpis.map((k) => <li key={k.id}>{k.etiqueta}</li>)}
                  </ul>

                  <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-1 mt-3">Vocabulario</div>
                  <p className="text-black/70">
                    {p.vocabulario.cliente} · {p.vocabulario.cita} · {p.vocabulario.servicio} · {p.vocabulario.negocio}
                  </p>
                </div>
                <div>
                  <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-1">Cómo habla</div>
                  <p className="text-black/70">{p.personalidad}</p>

                  <div className="text-xs font-mono uppercase tracking-widest text-[color:var(--red)] mb-1 mt-3">
                    Prohibido ({p.prohibiciones.length})
                  </div>
                  <ul className="list-disc pl-5 text-black/70">
                    {p.prohibiciones.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
              </div>

              <div className="mt-3 text-xs font-mono text-black/50">
                Encendido: {Object.entries(p.funciones).filter(([, on]) => on).map(([k]) => k).join(", ") || "nada extra"}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
