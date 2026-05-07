import { agents } from "@/lib/agents";

const stats: Record<string, { codename: string; specialty: string; status: string }> = {
  lucia: { codename: "ALFA-01", specialty: "Operaciones de despacho", status: "OPERATIVO 24/7" },
  marta: { codename: "BRAVO-02", specialty: "Guerra de redes", status: "OPERATIVO 24/7" },
  diego: { codename: "CHARLIE-03", specialty: "Captación en frío", status: "OPERATIVO 24/7" },
  carmen: { codename: "DELTA-04", specialty: "Comunicaciones", status: "OPERATIVO 24/7" },
};

export default function Team() {
  return (
    <section id="equipo" className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">DOSSIER 01</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">EXPEDIENTES PERSONALES</span>
        </div>
        <h2 className="font-display text-5xl md:text-7xl mb-4">
          Conoce a tu<br />unidad de élite
        </h2>
        <p className="text-lg max-w-2xl mb-14 text-black/70">
          Cuatro especialistas, cuatro frentes. Trabajan en cadena, no se duermen y no te piden vacaciones.
        </p>

        <div className="grid md:grid-cols-2 gap-10 mt-16">
          {agents.map((a) => {
            const s = stats[a.slug];
            return (
              <article key={a.slug} className="dossier pt-12 p-6 hover:-translate-y-1 transition relative">
                {/* Etiqueta carpeta superior */}
                <div className="absolute top-1 left-4 right-4 flex items-center justify-between z-10 text-white text-[11px] font-mono tracking-widest">
                  <span>EXP. {s.codename}</span>
                  <span>· CONFIDENCIAL ·</span>
                  <span>{s.status}</span>
                </div>

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
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-display text-4xl">{a.name}</h3>
                      <span className="stamp text-xs">EXPERTO</span>
                    </div>
                    <p className="text-sm uppercase tracking-wider font-semibold text-black/60">
                      {a.role}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-1 text-[11px] font-mono uppercase">
                      <div className="border-2 border-black p-1.5">
                        <span className="text-black/50">Alias</span>
                        <div className="font-bold tracking-wider">{s.codename}</div>
                      </div>
                      <div className="border-2 border-black p-1.5">
                        <span className="text-black/50">Especialidad</span>
                        <div className="font-bold leading-tight">{s.specialty}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <blockquote className="mt-5 text-base md:text-lg leading-relaxed border-l-4 border-[color:var(--red)] pl-4 italic">
                  «{a.quote}»
                </blockquote>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
