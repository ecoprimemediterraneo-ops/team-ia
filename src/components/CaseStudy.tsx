const before = [
  { metric: "Llamadas perdidas / mes", value: "40+" },
  { metric: "Horas semanales en admin", value: "12 h" },
  { metric: "Valoración Google", value: "3.8 ★" },
  { metric: "Respuesta media WhatsApp", value: "6 horas" },
];

const after = [
  { metric: "Llamadas perdidas / mes", value: "0" },
  { metric: "Horas semanales en admin", value: "< 1 h" },
  { metric: "Valoración Google", value: "4.9 ★" },
  { metric: "Respuesta media WhatsApp", value: "9 seg" },
];

const timeline = [
  { week: "Día 1", event: "Alta y briefing completado. Pablo y Carmen operativos." },
  { week: "Semana 1", event: "23 WhatsApps contestados automáticamente. 0 citas perdidas." },
  { week: "Semana 3", event: "Eva lanza secuencia de bienvenida a 60 pacientes. 14 reactivaciones." },
  { week: "Mes 2", event: "Rocío consigue 31 reseñas nuevas. Media Google sube de 3.8 a 4.9." },
];

export default function CaseStudy() {
  return (
    <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-5xl mx-auto px-6">

        {/* Header */}
        <div className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-[0.2em]">
          <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">CASO DE ESTUDIO</span>
          <span className="border border-black/30 px-3 py-1 text-black/50">CLÍNICA DENTAL · VALENCIA</span>
        </div>

        <div className="grid md:grid-cols-2 gap-12 mb-16">
          <div>
            <h2 className="font-stencil text-5xl md:text-6xl mb-6 leading-tight">
              De perder<br />pacientes a<br />lista de espera
            </h2>
            <blockquote className="border-l-[4px] border-black pl-5 mb-6">
              <p className="text-base text-black/70 leading-relaxed italic mb-3">
                "Antes perdía entre 8 y 10 citas a la semana porque nadie contestaba el WhatsApp fuera de horario. Ahora Pablo lo gestiona solo. El mes pasado no perdí ninguna."
              </p>
              <footer className="text-xs font-mono text-black/40 uppercase tracking-widest">
                Dr. A. Moreno · Clínica Moreno Dental · Valencia
              </footer>
            </blockquote>
            <div className="flex items-center gap-3 text-xs font-mono text-black/40">
              <span className="border border-black/20 px-2 py-1">PACK LOCAL · 39 €/MES</span>
              <span className="border border-black/20 px-2 py-1">ACTIVO DESDE DÍA 1</span>
            </div>
          </div>

          {/* Tabla antes/después */}
          <div className="border-[3px] border-black overflow-hidden self-start">
            <div className="grid grid-cols-3 text-[10px] font-mono tracking-widest bg-black text-white">
              <div className="p-3 col-span-1">MÉTRICA</div>
              <div className="p-3 text-center text-white/40">ANTES</div>
              <div className="p-3 text-center text-[color:var(--mustard)]">DESPUÉS</div>
            </div>
            {before.map((b, i) => (
              <div key={b.metric} className={`grid grid-cols-3 border-t border-black/10 ${i % 2 ? "bg-white" : "bg-[color:var(--cream)]/60"}`}>
                <div className="p-3 text-xs text-black/60">{b.metric}</div>
                <div className="p-3 text-center text-sm font-mono text-black/30 line-through">{b.value}</div>
                <div className="p-3 text-center text-sm font-bold text-black bg-[color:var(--mustard)]/10">{after[i].value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="border-[3px] border-black overflow-hidden">
          <div className="bg-black px-5 py-3 text-[10px] font-mono text-white/40 tracking-widest">
            LÍNEA DE TIEMPO · PRIMEROS 60 DÍAS
          </div>
          <div className="grid md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-black/10">
            {timeline.map((t, i) => (
              <div key={i} className="p-5 bg-white">
                <div className="text-[10px] font-mono text-black/30 tracking-widest mb-2 uppercase">{t.week}</div>
                <p className="text-sm text-black/70 leading-relaxed">{t.event}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
