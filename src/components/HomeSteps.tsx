// "Qué pasa cuando te registras" — 3 pasos. Bloque propio en la home
// (extraído del antiguo FinalCTA, que ahora es solo un banner a /beta).
const nextSteps = [
  { step: "01", text: "Recibes acceso a tu sistema en menos de 2 minutos." },
  { step: "02", text: "Videollamada de setup de 15 min. El sistema aprende tu negocio." },
  { step: "03", text: "Operativo. Tu sistema trabaja —y se adelanta— desde esa noche." },
];

export default function HomeSteps() {
  return (
    <section className="py-20 border-t-[3px] border-black bg-black text-[color:var(--cream)]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-[10px] font-mono tracking-[0.2em] text-white/30 mb-8 uppercase">
          Qué pasa cuando te registras
        </div>
        <div className="grid md:grid-cols-3 gap-px bg-white/10">
          {nextSteps.map((s) => (
            <div key={s.step} className="bg-black p-6">
              <div className="font-stencil text-4xl text-white/10 mb-4">{s.step}</div>
              <p className="text-sm text-white/60 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
