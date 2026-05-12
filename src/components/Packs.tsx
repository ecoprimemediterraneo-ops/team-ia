const packs = [
  {
    name: "Local",
    priceFounder: "39",
    priceRegular: "99",
    tagline: "Para negocio físico (peluquería, dental, gimnasio…)",
    agents: ["Pablo (WhatsApp)", "Carmen (Llamadas)", "Rocío (Reseñas)"],
    cta: "Empezar local",
  },
  {
    name: "Digital",
    priceFounder: "89",
    priceRegular: "149",
    tagline: "Para e-commerce, coach, consultor, agencia",
    agents: ["Lucía (Correo)", "Marta (Redes)", "Eva (Email mkt)"],
    cta: "Empezar digital",
  },
  {
    name: "Élite",
    priceFounder: "149",
    priceRegular: "249",
    tagline: "Toda la unidad. Lo más vendido.",
    agents: ["Pablo (WhatsApp)", "Carmen (Llamadas)", "Rocío (Reseñas)", "Lucía (Correo)", "Marta (Redes)", "Eva (Email mkt)"],
    cta: "Quiero la unidad entera",
    featured: true,
  },
  {
    name: "Pro",
    priceFounder: "299",
    priceRegular: "499",
    tagline: "Élite + onboarding personal + soporte premium",
    agents: ["Los 6 + Sergio (Inteligencia)", "Onboarding personal 1:1", "Soporte premium directo"],
    cta: "Hablar con ventas",
  },
];

export default function Packs() {
  return (
    <section id="packs" className="py-24 border-t-[3px] border-black bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono flex-wrap">
          <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">PRECIOS FUNDADORES</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">PARA SIEMPRE</span>
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">SOLO 100 PLAZAS</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-4">
          Elige tu pack
        </h2>
        <p className="text-lg max-w-2xl mb-12 text-black/70">
          Reemplazas un equipo de marketing de 2.000-5.000 €/mes. Sin nóminas, sin contratos, sin lunes flojos.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {packs.map((p) => (
            <article
              key={p.name}
              className={`card-hard p-6 flex flex-col relative ${p.featured ? "bg-[color:var(--mustard)]" : "bg-white"}`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[color:var(--red)] text-white text-xs font-bold tracking-widest px-3 py-1 border-2 border-black">
                  ★ MÁS VENDIDO
                </div>
              )}
              <div className="font-stencil text-3xl mb-1">{p.name}</div>
              <p className="text-xs text-black/60 leading-tight mb-5">{p.tagline}</p>

              <div className="mb-5">
                <div className="flex items-baseline gap-2">
                  <span className="font-stencil text-5xl">{p.priceFounder}</span>
                  <span className="text-sm font-bold">€/mes</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-black/50 line-through">{p.priceRegular} €</span>
                  <span className="text-[10px] font-bold tracking-widest bg-[color:var(--red)] text-white px-1.5 py-0.5">FUNDADOR</span>
                </div>
              </div>

              <ul className="space-y-2 mb-6 text-sm flex-1">
                {p.agents.map((a) => (
                  <li key={a} className="flex items-start gap-2">
                    <span className="text-[color:var(--red)] font-bold">▸</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>

              <a href="#waitlist" className="btn-mustard text-xs text-center block">
                {p.cta}
              </a>
              <p className="text-[10px] text-black/40 text-center mt-1 font-mono">
                * El cobro se activa tras 14 días gratis
              </p>
            </article>
          ))}
        </div>

        <p className="text-center text-xs text-black/50 mt-8 font-mono uppercase tracking-widest">
          14 días de prueba · cancela en un click · sin permanencia · precio fundador para siempre
        </p>
      </div>
    </section>
  );
}
