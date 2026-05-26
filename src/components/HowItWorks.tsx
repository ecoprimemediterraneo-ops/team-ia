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
    <section className="py-10 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center justify-between gap-2 mb-4 text-[10px] font-mono tracking-[0.2em] flex-wrap">
          <div className="flex items-center gap-2">
            <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold">PROTOCOLO DE DESPLIEGUE</span>
            <span className="border border-black/30 px-2 py-1 text-black/50">3 PASOS</span>
          </div>
          <h2 className="font-stencil text-2xl md:text-3xl leading-none">
            Operativo en 10 minutos
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-black border-[3px] border-black">
          {steps.map((s) => (
            <article key={s.n} className="p-4 bg-[color:var(--cream)] relative">
              <div className="font-stencil text-3xl text-black/15 mb-1">{s.n}</div>
              <h3 className="font-stencil text-lg mb-1 text-black">{s.title}</h3>
              <p className="text-xs text-black/60 leading-snug">{s.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
