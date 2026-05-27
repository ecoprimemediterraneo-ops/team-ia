const steps = [
  {
    n: "01",
    title: "Reservas",
    text: "En 30 segundos en /beta. Sin tarjeta. Te aseguras una de las 50 plazas fundadoras.",
  },
  {
    n: "02",
    title: "Conectamos tus cuentas",
    text: "Te ayudamos a enlazar WhatsApp, Gmail, Google Business y redes. Sin código ni tutoriales.",
  },
  {
    n: "03",
    title: "Tus agentes trabajan",
    text: "Contestan WhatsApp, responden reseñas, organizan tu correo y publican en redes. Tú apruebas.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-10 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center justify-between gap-2 mb-4 text-[10px] font-mono tracking-[0.2em] flex-wrap">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold">CÓMO FUNCIONA</span>
          <h2 className="font-stencil text-2xl md:text-3xl leading-none">
            Operativo en 24 horas
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
