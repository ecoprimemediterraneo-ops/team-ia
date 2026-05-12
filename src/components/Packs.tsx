const packs = [
  {
    name: "Local",
    priceFounder: "39",
    priceRegular: "99",
    tagline: "Automatización de canales presenciales",
    agents: ["Pablo — WhatsApp 24/7", "Carmen — Llamadas entrantes", "Rocío — Reseñas Google"],
    cta: "Activar plan Local",
  },
  {
    name: "Digital",
    priceFounder: "89",
    priceRegular: "149",
    tagline: "Automatización de canales digitales",
    agents: ["Lucía — Correo y calendario", "Marta — Redes sociales", "Eva — Email marketing"],
    cta: "Activar plan Digital",
  },
  {
    name: "Élite",
    priceFounder: "149",
    priceRegular: "249",
    tagline: "Operación completa. Los 6 canales.",
    agents: ["Pablo — WhatsApp 24/7", "Carmen — Llamadas entrantes", "Rocío — Reseñas Google", "Lucía — Correo y calendario", "Marta — Redes sociales", "Eva — Email marketing"],
    cta: "Activar plan Élite",
    featured: true,
  },
  {
    name: "Pro",
    priceFounder: "299",
    priceRegular: "499",
    tagline: "Élite + inteligencia competitiva + soporte directo",
    agents: ["Los 6 agentes operativos", "Sergio — Monitorización de competidores", "Onboarding 1:1 con setup incluido", "Soporte prioritario directo"],
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
          Nivel de<br />automatización
        </h2>
        <p className="text-lg max-w-2xl mb-12 text-black/70">
          La misma operación que un equipo de 2.000–5.000 €/mes. Sin nóminas, sin contratos, sin fricciones de gestión.
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
