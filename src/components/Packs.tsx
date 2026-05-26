const packs = [
  {
    name: "Discover",
    priceFounder: "0",
    priceRegular: "0",
    tagline: "Empieza gratis. Sin tarjeta. Para siempre.",
    agents: [
      "Sergio — Vigila 3 competidores",
      "Diana — 1 auditoría inicial gratis",
      "Tomás — Soporte IA",
    ],
    cta: "Empezar sin tarjeta",
  },
  {
    name: "Local",
    priceFounder: "79",
    priceRegular: "199",
    tagline: "Lo esencial para no perder ni una llamada ni un mensaje.",
    agents: [
      "Pablo — WhatsApp 24/7",
      "Rocío — Reseñas Google",
      "Carmen — Recepcionista (contestador)",
      "Diana — Auditora continua",
      "Tomás — Soporte IA 24/7",
    ],
    cta: "Quiero el plan Local",
  },
  {
    name: "Digital",
    priceFounder: "149",
    priceRegular: "349",
    tagline: "Local + marca digital completa (redes, email, calendario).",
    agents: [
      "Todo lo del plan Local",
      "Lucía — Correo y calendario",
      "Marta — Redes sociales",
      "Eva — Email marketing",
    ],
    cta: "Quiero el plan Digital",
  },
  {
    name: "Élite",
    priceFounder: "249",
    priceRegular: "549",
    tagline: "Equipo IA completo: 9 agentes operando 24/7.",
    agents: [
      "Todo lo del plan Digital",
      "Sergio — Inteligencia competitiva",
      "Carmen Pro — Reservas y agenda automática",
    ],
    cta: "Quiero el plan Élite",
    featured: true,
  },
  {
    name: "Pro",
    priceFounder: "449",
    priceRegular: "899",
    tagline: "Élite + onboarding 1:1 + multi-usuario + soporte directo.",
    agents: [
      "Todo lo del plan Élite",
      "Onboarding 1:1 con setup incluido",
      "Multi-usuario (hasta 5 cuentas)",
      "Soporte prioritario por WhatsApp directo",
      "Integración a medida con tu software",
    ],
    cta: "Hablar con ventas",
  },
];

export default function Packs() {
  return (
    <section id="packs" className="py-14 md:py-24 border-t-[3px] border-black bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono flex-wrap">
          <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">PRECIOS FUNDADORES</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">PARA SIEMPRE</span>
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">50 PLAZAS BETA · 6 MESES GRATIS</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-4">
          Empieza gratis.<br />Añade agentes<br />cuando los necesites.
        </h2>
        <p className="text-lg max-w-2xl mb-4 text-black/70">
          La misma operación que un equipo de 2.000–5.000 €/mes. Sin nóminas, sin contratos, sin fricciones de gestión.
        </p>
        <p className="text-sm max-w-2xl mb-8 text-black/60">
          ✓ Diana (auditora), Tomás (soporte IA 24/7), Pablo (WhatsApp) y Carmen (contestador) <b>incluidos en todos los packs</b>.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
                {p.priceFounder === "0" ? (
                  <>
                    <div className="font-stencil text-3xl leading-tight text-[color:var(--red)]">
                      Gratis<br />para siempre
                    </div>
                    <div className="text-xs text-black/60 mt-2 font-mono">Sin tarjeta</div>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="font-stencil text-5xl">{p.priceFounder}</span>
                      <span className="text-sm font-bold">€/mes</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-black/50 line-through">{p.priceRegular} €</span>
                      <span className="text-[10px] font-bold tracking-widest bg-[color:var(--red)] text-white px-1.5 py-0.5">FUNDADOR</span>
                    </div>
                  </>
                )}
              </div>

              <ul className="space-y-2 mb-6 text-sm flex-1">
                {p.agents.map((a) => (
                  <li key={a} className="flex items-start gap-2">
                    <span className="text-[color:var(--red)] font-bold">▸</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>

              <a href="/beta" className="btn-mustard text-xs text-center block">
                {p.cta}
              </a>
              <p className="text-[10px] text-black/40 text-center mt-1 font-mono">
                * 6 meses gratis · cancela cuando quieras · sin permanencia
              </p>
            </article>
          ))}
        </div>

        <p className="text-center text-xs text-black/50 mt-8 font-mono uppercase tracking-widest">
          6 meses gratis · cancela en un click · sin permanencia · precio fundador para siempre
        </p>

      </div>
    </section>
  );
}
