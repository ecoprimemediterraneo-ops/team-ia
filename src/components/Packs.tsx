// Roles canónicos (alineados con src/lib/agents.ts y los prompts):
//   Pablo  → WhatsApp (ventas)
//   Marta  → Instagram y redes
//   Carmen → Llamadas de voz
//   Eva    → Email marketing
//   Lucía  → Correo y gestión
//   Rocío  → Reseñas de Google
//
// DOS planes públicos: Esencial y Completo. Los extras del antiguo "Pro"
// (multiusuario, soporte prioritario, auditoría) pasan a "hablar con ventas".
// Prop `compact`: en la home se muestran solo agentes + precio + CTA; en
// /precios se muestra además el detalle del informe mensual.

type Pack = {
  name: string;
  priceFounder: string;
  priceRegular: string;
  tagline: string;
  agents: string[];
  extras: string[];
  reportLabel: string;
  reportItems: string[];
  users: string;
  cta: string;
  featured?: boolean;
};

const packs: Pack[] = [
  {
    name: "Esencial",
    priceFounder: "99",
    priceRegular: "199",
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
      "Lucía · Correo y gestión",
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
];

export default function Packs({ compact = false }: { compact?: boolean }) {
  return (
    <section id="packs" className="py-24 border-t-[3px] border-black bg-white">
      <div className="max-w-5xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono flex-wrap">
          <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">PRECIOS FUNDADORES</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">PARA SIEMPRE</span>
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">SOLO 20 PLAZAS</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-4">
          Dos planes.<br />Precio fundador.
        </h2>
        <p className="text-lg max-w-2xl mb-8 text-black/70">
          La misma operación que un equipo de 2.000–5.000 €/mes. Sin nóminas, sin contratos, sin fricciones de gestión.
        </p>

        <div className="grid md:grid-cols-2 gap-5 pt-6 max-w-3xl">
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

              {/* Detalle ampliado: solo fuera de la home (compact = false) */}
              {!compact && (
                <>
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
                </>
              )}

              <div className="flex-1" />

              <a href="/beta" className="btn-mustard text-xs text-center block">
                {p.cta}
              </a>
              <p className="text-[10px] text-black/40 text-center mt-1 font-mono">
                * El cobro se activa tras 6 meses gratis
              </p>
            </article>
          ))}
        </div>

        {/* Extras del antiguo Pro → hablar con ventas */}
        <p className="text-sm text-black/60 mt-8">
          ¿Necesitas multiusuario o soporte prioritario?{" "}
          <a
            href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-bold hover:text-[color:var(--red)]"
          >
            Hablar con ventas →
          </a>
        </p>
      </div>
    </section>
  );
}
