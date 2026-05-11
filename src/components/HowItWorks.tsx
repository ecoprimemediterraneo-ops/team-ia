const steps = [
  {
    n: "01",
    title: "Conectas",
    text: "Te das de alta en 1 minuto, conectas tu Gmail (OAuth) y tu WhatsApp Business. Sin código, sin instalar nada. La unidad ya está dentro.",
    icon: "🔌",
  },
  {
    n: "02",
    title: "Entrenas",
    text: "Le cuentas a tu unidad cómo es tu negocio: tono, servicios, precios, horarios, FAQ. Te lleva 5 minutos en una pantalla guiada. Lo aprenden al instante.",
    icon: "🧠",
  },
  {
    n: "03",
    title: "Trabajan",
    text: "Tú vuelves a lo tuyo. Pablo contesta WhatsApps, Lucía limpia tu correo, Eva manda newsletters, Rocío responde reseñas, Marta publica, Carmen coge llamadas. Tú apruebas con un click.",
    icon: "⚡",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">PROTOCOLO DE DESPLIEGUE</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">3 PASOS</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-4">
          Cómo funciona<br />en 3 pasos
        </h2>
        <p className="text-lg max-w-2xl mb-14 text-black/70">
          De 0 a unidad operativa en menos de 10 minutos. Sin tutoriales largos, sin tecnicismos.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <article key={s.n} className="card-hard p-6 relative bg-white">
              <div className="absolute -top-4 -left-4 bg-[color:var(--mustard)] border-[3px] border-black w-14 h-14 flex items-center justify-center font-stencil text-xl shadow-[3px_3px_0_#000]">
                {s.n}
              </div>
              <div className="text-5xl mb-3 mt-3">{s.icon}</div>
              <h3 className="font-stencil text-3xl mb-2">{s.title}</h3>
              <p className="text-black/70 leading-relaxed">{s.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
