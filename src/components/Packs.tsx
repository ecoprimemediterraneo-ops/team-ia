// Roles canónicos (alineados con src/lib/agents.ts y los prompts):
//   Pablo  → WhatsApp (ventas)
//   Marta  → Instagram y redes
//   Carmen → Llamadas de voz
//   Eva    → Email marketing
//   Lucía  → Agenda y gestión
//   Rocío  → Reseñas de Google

type Pack = {
  name: string;
  priceFounder: string;
  priceRegular: string;
  tagline: string;
  agents: string[];
  extras: string[];
  reportLabel: string;       // título del informe mensual del plan
  reportItems: string[];     // 3-4 bullets concretos de qué incluye
  users: string;
  cta: string;
  featured?: boolean;
};

const packs: Pack[] = [
  {
    name: "Esencial",
    priceFounder: "89",
    priceRegular: "189",
    tagline: "Lo justo para empezar a no perder clientes.",
    agents: [
      "Pablo · WhatsApp (ventas)",
      "Carmen · Llamadas de voz",
      "Rocío · Reseñas de Google",
    ],
    extras: [
      "Asistente de configuración guiado por sector",
      "1 usuario",
    ],
    reportLabel: "Resumen mensual",
    reportItems: [
      "Dinero generado y horas ahorradas",
      "Conversaciones, leads, citas y ventas del mes",
      "Una línea honesta: qué cerraste tú vs. qué se escapó",
    ],
    users: "1 usuario",
    cta: "Activar plan Esencial",
  },
  {
    name: "Completo",
    priceFounder: "189",
    priceRegular: "389",
    tagline: "Operación 360. Los 6 agentes activos.",
    agents: [
      "Pablo · WhatsApp (ventas)",
      "Carmen · Llamadas de voz",
      "Rocío · Reseñas de Google",
      "Lucía · Agenda y gestión",
      "Eva · Email marketing",
      "Marta · Instagram y redes",
    ],
    extras: [
      "Asistente de configuración guiado por sector",
      "2 usuarios",
    ],
    reportLabel: "Informe mensual con análisis y leads calientes",
    reportItems: [
      "Todo lo del Resumen Esencial",
      "Lista de leads calientes a recuperar",
      "Qué pregunta más tu cliente este mes",
      "Comparativa vs. el mes anterior",
    ],
    users: "2 usuarios",
    cta: "Activar plan Completo",
    featured: true,
  },
  {
    name: "Pro",
    priceFounder: "389",
    priceRegular: "789",
    tagline: "Completo + soporte prioritario y multiusuario.",
    agents: [
      "Pablo · WhatsApp (ventas)",
      "Carmen · Llamadas de voz",
      "Rocío · Reseñas de Google",
      "Lucía · Agenda y gestión",
      "Eva · Email marketing",
      "Marta · Instagram y redes",
    ],
    extras: [
      "Soporte prioritario email (4 h)",
      "5 usuarios",
    ],
    reportLabel: "Auditoría mensual con recomendaciones estratégicas",
    reportItems: [
      "Todo lo del Informe Completo",
      "Recomendaciones concretas para el mes siguiente",
      "Análisis por canal, sector y campaña",
      "Detección de cuellos de botella en tu embudo",
    ],
    users: "5 usuarios",
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
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">SOLO 20 PLAZAS</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-4">
          Nivel de<br />automatización
        </h2>
        <p className="text-lg max-w-2xl mb-8 text-black/70">
          La misma operación que un equipo de 2.000–5.000 €/mes. Sin nóminas, sin contratos, sin fricciones de gestión.
        </p>

        <div className="grid md:grid-cols-3 gap-5 pt-6">
          {packs.map((p) => (
            <article
              key={p.name}
              className={`card-hard p-6 flex flex-col relative ${p.featured ? "bg-[color:var(--mustard)]" : "bg-white"}`}
            >
              {p.featured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[color:var(--red)] text-white text-xs font-bold tracking-widest px-3 py-1 border-2 border-black z-10 whitespace-nowrap shadow-[3px_3px_0_#000]">
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

              {/* Agentes incluidos */}
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/55 mb-2">
                Agentes incluidos
              </div>
              <ul className="space-y-1.5 mb-4 text-sm">
                {p.agents.map((a) => (
                  <li key={a} className="flex items-start gap-2">
                    <span className="text-[color:var(--red)] font-bold leading-snug">▸</span>
                    <span className="leading-snug">{a}</span>
                  </li>
                ))}
              </ul>

              {/* Extras */}
              {p.extras.length > 0 && (
                <ul className="space-y-1 mb-4 text-xs text-black/70 border-t border-black/15 pt-3">
                  {p.extras.map((e) => (
                    <li key={e} className="flex items-start gap-2">
                      <span className="text-black/40 font-bold">+</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Informe mensual destacado */}
              <div className="mb-5 border-t-2 border-black/15 pt-3">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/55">
                  Informe mensual incluido
                </div>
                <div className="text-sm font-bold leading-snug mt-0.5 mb-2">
                  📊 {p.reportLabel}
                </div>
                <ul className="space-y-1 text-xs text-black/75">
                  {p.reportItems.map((it) => (
                    <li key={it} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-[color:var(--red)] font-bold">›</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex-1" />

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
