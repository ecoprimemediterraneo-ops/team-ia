/**
 * Muestra los agentes adaptados a un sector concreto:
 *  - Top 3 (prioritarios)
 *  - Útiles también (secundarios)
 *  - Lo que NO encaja todavía
 *
 * Se usa en landings sectoriales (/dentistas, /peluquerias, etc.).
 */
import Image from "next/image";
import { agents } from "@/lib/agents";
import type { SectorSlug } from "@/lib/sector-fit";
import { SECTOR_FIT } from "@/lib/sector-fit";

export default function AgentsForSector({ sector }: { sector: SectorSlug }) {
  const fit = SECTOR_FIT[sector];
  const get = (slug: string) => agents.find((a) => a.slug === slug)!;

  return (
    <section className="py-16 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center mb-10">
          <div className="text-xs font-mono uppercase tracking-widest mb-2 text-black/60">
            Equipo IA adaptado a tu sector
          </div>
          <h2 className="font-stencil text-3xl md:text-5xl mb-3">
            {fit.emoji} Lo que mueve la aguja en {fit.label.toLowerCase()}
          </h2>
          <p className="text-base text-black/70 max-w-2xl mx-auto">{fit.porQue}</p>
        </div>

        {/* TOP 3 — héroes */}
        <div className="mb-12">
          <div className="text-xs font-mono uppercase tracking-widest mb-4 text-[color:var(--red)] font-bold">
            ★ Top 3 imprescindibles
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {fit.top.map((slug) => {
              const a = get(slug);
              return (
                <article
                  key={slug}
                  className="card-hard p-5 bg-white relative overflow-hidden"
                >
                  <div className="flex items-start gap-4 mb-3">
                    <div
                      className="w-16 h-16 border-2 border-black shrink-0 relative overflow-hidden"
                      style={{ background: a.color }}
                    >
                      <Image src={a.avatar} alt={a.name} fill sizes="64px" className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-stencil text-2xl">{a.name}</div>
                      <div className="text-[10px] font-mono tracking-widest text-black/50 uppercase">
                        {a.codename} · {a.role}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-black/80">{a.short}</p>
                </article>
              );
            })}
          </div>
        </div>

        {/* Útiles */}
        {fit.util.length > 0 && (
          <div className="mb-12">
            <div className="text-xs font-mono uppercase tracking-widest mb-4 text-black/60 font-bold">
              ✓ También útiles
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {fit.util.map((slug) => {
                const a = get(slug);
                return (
                  <div
                    key={slug}
                    className="card-hard p-3 bg-white flex items-center gap-3"
                  >
                    <div
                      className="w-10 h-10 border-2 border-black shrink-0 relative overflow-hidden"
                      style={{ background: a.color }}
                    >
                      <Image src={a.avatar} alt={a.name} fill sizes="40px" className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm">{a.name}</div>
                      <div className="text-[10px] font-mono text-black/50 uppercase">{a.role}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Skip */}
        {fit.skip.length > 0 && (
          <div>
            <div className="text-xs font-mono uppercase tracking-widest mb-4 text-black/40 font-bold">
              · No prioritarios para este sector
            </div>
            <div className="flex flex-wrap gap-2">
              {fit.skip.map((slug) => {
                const a = get(slug);
                return (
                  <span
                    key={slug}
                    className="border-2 border-black/20 px-2 py-1 text-xs text-black/40 bg-white"
                  >
                    {a.name}
                  </span>
                );
              })}
            </div>
            <p className="text-[11px] text-black/40 mt-3 font-mono italic">
              No los activamos al inicio. Si más adelante los necesitas, los añadimos sin coste extra.
            </p>
          </div>
        )}

        <div className="mt-12 text-center">
          <a href="/beta" className="btn-mustard inline-block">
            Solicitar plaza beta (6 meses gratis) →
          </a>
        </div>
      </div>
    </section>
  );
}
