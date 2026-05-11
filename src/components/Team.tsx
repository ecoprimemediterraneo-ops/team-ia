import { agents } from "@/lib/agents";

export default function Team() {
  return (
    <section id="equipo" className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">DOSSIER 01</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">EXPEDIENTES PERSONALES</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-4">
          Conoce a tu<br />unidad de élite
        </h2>
        <p className="text-lg max-w-2xl mb-3 text-black/70">
          Seis especialistas, seis frentes. Trabajan en cadena, no se duermen y no te piden vacaciones.
        </p>
        <p className="text-sm max-w-2xl mb-14 text-black/60 font-mono">
          ★ <strong>Los 6 agentes operativos hoy.</strong> Eva ya envía emails reales y Lucía ya lee tu Gmail con OAuth. El resto trabaja en modo asistido (genera el contenido, tú publicas) mientras se completan integraciones automáticas con Meta, Google Business y Vapi.
          <br />Como fundador, te aseguras el precio actual de por vida.
        </p>

        <div className="grid md:grid-cols-2 gap-10 mt-16">
          {agents.map((a) => (
            <article key={a.slug} className="dossier pt-12 p-6 hover:-translate-y-1 transition relative overflow-hidden">
              {/* Etiqueta carpeta superior */}
              <div className="absolute top-1 left-4 right-4 flex items-center justify-between z-10 text-white text-[11px] font-mono tracking-widest">
                <span>EXP. {a.codename}</span>
                <span className="hidden sm:inline">· CONFIDENCIAL ·</span>
                <span>{a.status === "ready" ? "OPERATIVO" : "EN ALTA"}</span>
              </div>

              {a.status === "soon" && (
                <div className="absolute top-10 -right-14 rotate-45 bg-[color:var(--red)] text-white text-[9px] sm:text-[10px] font-bold tracking-widest px-14 py-1 z-20 shadow-md">
                  PRÓXIMAMENTE
                </div>
              )}
              {a.status === "ready" && (
                <div className="absolute top-10 -right-14 rotate-45 bg-green-600 text-white text-[9px] sm:text-[10px] font-bold tracking-widest px-14 py-1 z-20 shadow-md">
                  OPERATIVA
                </div>
              )}

              <div className="flex items-start gap-5 relative">
                <div
                  className="relative w-28 h-28 border-[3px] border-black overflow-hidden shrink-0"
                  style={{ background: a.color }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                  <span className="absolute -bottom-1 -right-1 bg-white border-[3px] border-black w-9 h-9 flex items-center justify-center text-xl">
                    {a.emoji}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 pr-20 sm:pr-24">
                    <h3 className="font-stencil text-3xl sm:text-4xl">{a.name}</h3>
                  </div>
                  <p className="text-sm uppercase tracking-wider font-semibold text-black/60">
                    {a.role}
                  </p>
                  <p className="text-sm text-black/70 mt-2">{a.short}</p>
                </div>
              </div>

              <blockquote className="mt-5 text-base md:text-lg leading-relaxed border-l-4 border-[color:var(--red)] pl-4 italic">
                «{a.quote}»
              </blockquote>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
