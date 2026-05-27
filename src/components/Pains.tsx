const pains = [
  {
    icon: "📧",
    title: "100+ correos sin leer cada mañana",
    text: "Pierdes hora y media revisando bandeja antes de empezar a trabajar.",
  },
  {
    icon: "📱",
    title: "Redes sin publicar. Visibilidad cayendo.",
    text: "Tus competidores aparecen en Instagram. Tú no. Cada semana sin postear pesa.",
  },
  {
    icon: "📞",
    title: "Llamada no contestada = cliente perdido",
    text: "El 40% de las consultas llegan fuera de horario. La mayoría no vuelve a llamar.",
  },
  {
    icon: "⭐",
    title: "Reseñas sin responder",
    text: "Una reseña sin contestar resta más que tres respondidas. Google lo penaliza.",
  },
];

export default function Pains() {
  return (
    <section className="py-20 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-8 text-xs font-mono">
          <span className="bg-[color:var(--red)] text-white px-2 py-1 font-bold tracking-widest">
            SITUACIÓN ACTUAL
          </span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-4 leading-[0.95]">
          La operación<br />te come el tiempo
        </h2>
        <p className="text-base md:text-lg max-w-2xl mb-10 text-black/60">
          La operación diaria no debería depender del fundador. Cada hora gestionando correos, llamadas o redes es una hora que no va a crecimiento.
        </p>

        <div className="grid sm:grid-cols-2 gap-5">
          {pains.map((p) => (
            <article key={p.title} className="card-hard p-5 bg-white flex gap-4 items-start">
              <span className="text-3xl shrink-0">{p.icon}</span>
              <div>
                <h3 className="font-bold text-base mb-1">{p.title}</h3>
                <p className="text-sm text-black/60 leading-relaxed">{p.text}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-base md:text-lg max-w-xl mx-auto text-black/80">
          <span className="font-semibold">AI-Team automatiza esa carga.</span> Seis agentes que trabajan mientras tú haces lo importante.
        </p>
      </div>
    </section>
  );
}
