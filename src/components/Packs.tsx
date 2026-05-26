const packs = [
  {
    name: "Esencial",
    priceFounder: "89",
    priceRegular: "189",
    tagline: "Equivalente a una recepcionista part-time. Operativo 24/7.",
    agents: [
      "Pablo — WhatsApp 24/7",
      "Carmen — Llamadas entrantes",
      "Rocío — Reseñas Google",
    ],
    cta: "Activar plan Esencial",
  },
  {
    name: "Completo",
    priceFounder: "189",
    priceRegular: "389",
    tagline: "Operación 360. Los 6 agentes activos.",
    agents: [
      "Todo lo del plan Esencial",
      "Lucía — Correo y calendario",
      "Eva — Email marketing",
      "Marta — Redes sociales",
    ],
    cta: "Activar plan Completo",
    featured: true,
  },
  {
    name: "Pro",
    priceFounder: "389",
    priceRegular: "789",
    tagline: "Completo + onboarding personalizado + multiusuario.",
    agents: [
      "Todo lo del plan Completo",
      "Onboarding 1:1 con setup incluido",
      "Multiusuario (hasta 5 cuentas)",
      "Soporte prioritario email (4h)",
      "Integraciones a medida (Gesden, ClinicCloud…)",
    ],
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
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">SOLO 50 PLAZAS</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-4">
          Nivel de<br />automatización
        </h2>
        <p className="text-lg max-w-2xl mb-8 text-black/70">
          La misma operación que un equipo de 2.000–5.000 €/mes. Sin nóminas, sin contratos, sin fricciones de gestión.
        </p>

        {/* Banner Diana incluida en todos los packs */}
        <div className="card-hard p-4 bg-[#14B8A6]/10 border-[#14B8A6] mb-8 flex items-center gap-4 flex-wrap">
          <span className="text-3xl">🔍</span>
          <div className="flex-1 min-w-[200px]">
            <div className="font-bold">Diana — Auditora — incluida en todos los packs</div>
            <div className="text-xs text-black/60">Diagnóstico inicial gratis + revisión mensual continua de tu clínica. HOTEL-D8.</div>
          </div>
          <a href="/diagnostico" className="text-xs font-mono font-bold tracking-widest border-2 border-black px-3 py-2 hover:bg-black hover:text-white">PROBAR GRATIS →</a>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
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
                * El cobro se activa tras 6 meses gratis
              </p>
            </article>
          ))}
        </div>

        <p className="text-center text-xs text-black/50 mt-8 font-mono uppercase tracking-widest">
          6 meses de prueba · cancela en un click · sin permanencia · precio fundador para siempre
        </p>
      </div>
    </section>
  );
}
