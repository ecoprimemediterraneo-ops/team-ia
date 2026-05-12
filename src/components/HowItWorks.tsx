const steps = [
  {
    n: "01",
    title: "Conectas",
    text: "Alta en 1 minuto. Conectas Gmail y WhatsApp Business. Sin código, sin instalaciones.",
  },
  {
    n: "02",
    title: "Briefing",
    text: "5 minutos en una pantalla guiada. Tu tono, servicios, precios y FAQ. Los agentes aprenden al instante.",
  },
  {
    n: "03",
    title: "Operativo",
    text: "WhatsApp contestado. Correo gestionado. Posts publicados. Reseñas respondidas. Tú solo apruebas.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-[0.2em]">
          <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">PROTOCOLO DE DESPLIEGUE</span>
          <span className="border border-black/30 px-3 py-1 text-black/50">3 PASOS</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-6xl mb-4 leading-tight">
          Operativo en<br />10 minutos
        </h2>
        <p className="text-base max-w-xl mb-16 text-black/50">
          Sin tutoriales. Sin código. Sin consultor de implementación.
        </p>

        <div className="grid md:grid-cols-3 gap-px bg-black border-[3px] border-black">
          {steps.map((s) => (
            <article key={s.n} className="p-8 bg-[color:var(--cream)] relative">
              <div className="font-stencil text-5xl text-black/10 mb-6">{s.n}</div>
              <h3 className="font-stencil text-2xl mb-3 text-black">{s.title}</h3>
              <p className="text-sm text-black/60 leading-relaxed">{s.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
