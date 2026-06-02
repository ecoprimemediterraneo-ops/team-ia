// Sección de la home (y de /precios) que vende el INFORME MENSUAL como gran
// razón para contratar AI-Team. Tres variantes visualmente diferenciadas según
// plan: Esencial → Resumen, Completo → Informe, Pro → Auditoría.
//
// Estética: card-hard + sombras retro, paleta cream/mustard/red/ink. Encaja
// con Hero, Packs y PlansComparisonTable.

const TIERS = [
  {
    plan: "ESENCIAL",
    title: "Tu resumen mensual",
    tagline: "Lo esencial de un vistazo",
    accent: "white",                // bg-white
    badgeBg: "bg-black",
    badgeColor: "text-[color:var(--mustard)]",
    items: [
      "Cuánto dinero te ha generado tu equipo",
      "Cuántas horas te ha ahorrado",
      "Conversaciones, leads, citas y ventas del mes",
      "Una línea honesta: qué cerraste tú vs. qué se te escapó",
    ],
  },
  {
    plan: "COMPLETO",
    title: "Tu informe mensual",
    tagline: "Con leads calientes y análisis",
    accent: "mustard",              // bg-[color:var(--mustard)]
    badgeBg: "bg-[color:var(--red)]",
    badgeColor: "text-white",
    featured: true,
    items: [
      "Todo lo del resumen Esencial",
      "Lista de leads calientes que merece la pena recuperar",
      "Qué pregunta más tu cliente este mes (y qué le falta saber)",
      "Comparativa con el mes anterior — qué mejora, qué empeora",
    ],
  },
  {
    plan: "PRO",
    title: "Tu auditoría mensual",
    tagline: "Recomendaciones estratégicas",
    accent: "ink",                  // bg-black text-white
    badgeBg: "bg-[color:var(--mustard)]",
    badgeColor: "text-black",
    items: [
      "Todo lo del informe Completo",
      "Recomendaciones concretas: qué cambiar el mes que viene",
      "Análisis por canal, sector y campaña",
      "Detección de cuellos de botella en tu embudo de venta",
    ],
  },
] as const;

function tierBg(accent: "white" | "mustard" | "ink"): string {
  if (accent === "mustard") return "bg-[color:var(--mustard)]";
  if (accent === "ink") return "bg-black text-white";
  return "bg-white";
}

function tierBorderText(accent: "white" | "mustard" | "ink"): string {
  if (accent === "ink") return "border-[color:var(--mustard)]/40";
  return "border-black/15";
}

export default function MonthlyReportSection() {
  return (
    <section
      id="informe-mensual"
      className="py-20 md:py-24 border-t-[3px] border-black bg-[color:var(--cream)]"
    >
      <div className="max-w-6xl mx-auto px-5">
        {/* Cabecera */}
        <div className="text-center mb-12 md:mb-16">
          <div className="flex items-center justify-center gap-2 mb-4 text-[10px] font-mono tracking-[0.25em]">
            <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold">
              INFORME MENSUAL · INCLUIDO EN TODOS LOS PLANES
            </span>
          </div>
          <h2 className="font-stencil text-4xl md:text-6xl leading-[1.05] mb-5">
            Cada mes sabes <span className="text-[color:var(--red)]">exactamente</span><br />
            cuánto te ha valido tu equipo IA.
          </h2>
          <p className="text-xl md:text-2xl text-black/80 max-w-3xl mx-auto leading-snug font-medium">
            Cada mes, un informe claro: lo que ganaste, lo que se te escapó y
            lo que toca mejorar.
            <span className="block mt-4 font-stencil text-2xl md:text-3xl text-black tracking-tight">
              Como tener un director comercial que nunca duerme.
            </span>
          </p>
        </div>

        {/* Mockup visual de un informe — para que entre por los ojos */}
        <div className="mb-14 md:mb-16">
          <div className="max-w-3xl mx-auto card-hard bg-white p-6 md:p-8 relative">
            <div className="absolute -top-3 left-6 bg-[color:var(--red)] text-white text-[10px] font-bold tracking-widest px-3 py-1 border-2 border-black">
              EJEMPLO REAL
            </div>
            {/* Cabecera del mockup */}
            <div className="flex items-center gap-2 text-[9px] font-mono tracking-[0.25em] mb-4 text-black/60 mt-1">
              <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold">INFORME MENSUAL</span>
              <span>·</span>
              <span>MAYO 2026</span>
              <span>·</span>
              <span>CLÍNICA SONRISA</span>
            </div>
            <h3 className="font-stencil text-2xl md:text-3xl mb-5">Tu mes con AI-Team</h3>

            {/* Dos métricas grandes */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="card-hard bg-[color:var(--mustard)] p-4">
                <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-black/70 mb-1">
                  Valor generado
                </div>
                <div className="font-stencil text-4xl md:text-5xl leading-none">3.400€</div>
              </div>
              <div className="card-hard bg-white border-[3px] p-4">
                <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-black/70 mb-1">
                  Tiempo ahorrado
                </div>
                <div className="font-stencil text-4xl md:text-5xl leading-none">
                  46<span className="text-2xl ml-1">h</span>
                </div>
              </div>
            </div>

            {/* KPIs en banda */}
            <div className="grid grid-cols-5 gap-2 mb-5">
              {[
                { l: "Conv.", v: 184 },
                { l: "Msgs.", v: 692 },
                { l: "Leads", v: 27 },
                { l: "Citas", v: 12 },
                { l: "Ventas", v: 4 },
              ].map((k) => (
                <div key={k.l} className="card-hard bg-[color:var(--cream)] p-2 text-center">
                  <div className="text-[8px] font-mono uppercase tracking-widest text-black/55">{k.l}</div>
                  <div className="font-stencil text-xl md:text-2xl leading-none mt-0.5">{k.v}</div>
                </div>
              ))}
            </div>

            {/* Narrativa */}
            <p className="text-xs md:text-sm leading-relaxed text-black/75 max-w-2xl">
              En mayo, tu equipo IA atendió 692 mensajes de 184 conversaciones únicas,
              ahorrándote unas 46 horas. Detectamos 27 leads, agendaste 12 citas y
              cerraste 4 ventas — un valor estimado de 3.400€. AI-Team te trae el
              lead, cerrarlo es tu gestión. El mes que viene afinamos los textos de
              respuesta automática los viernes por la tarde, que es cuando más se te
              escapan.
            </p>
          </div>
          <p className="text-center text-xs text-black/50 mt-4 font-mono tracking-wider uppercase">
            ⌘P para imprimir · listo para tu gestoría o tu socio
          </p>
        </div>

        {/* Los 3 tiers de informe */}
        <div className="text-center mb-8">
          <h3 className="font-stencil text-3xl md:text-4xl">
            El informe escala con tu plan
          </h3>
          <p className="text-sm md:text-base text-black/60 mt-2">
            Cuanto más profundo el plan, más profundo el análisis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TIERS.map((t) => {
            const dark = t.accent === "ink";
            return (
              <article
                key={t.plan}
                className={`card-hard p-6 md:p-7 relative ${tierBg(t.accent)} ${"featured" in t && t.featured ? "md:scale-[1.03]" : ""}`}
              >
                {"featured" in t && t.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[color:var(--red)] text-white text-[10px] font-bold tracking-widest px-3 py-1 border-2 border-black whitespace-nowrap">
                    ★ MÁS VENDIDO
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`${t.badgeBg} ${t.badgeColor} px-2 py-1 text-[10px] font-mono font-bold tracking-widest`}>
                    {t.plan}
                  </span>
                </div>
                <h4 className="font-stencil text-3xl md:text-4xl leading-tight mb-1">
                  {t.title}
                </h4>
                <p className={`text-xs font-mono uppercase tracking-widest mb-5 ${dark ? "text-white/60" : "text-black/55"}`}>
                  {t.tagline}
                </p>
                <ul className={`space-y-3 ${dark ? "text-white/90" : "text-black/80"}`}>
                  {t.items.map((it) => (
                    <li key={it} className="flex gap-2 text-sm leading-snug">
                      <span className={`${dark ? "text-[color:var(--mustard)]" : "text-[color:var(--red)]"} font-bold mt-[1px]`}>›</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
                {/* Línea inferior diferenciadora del tier */}
                <div className={`mt-6 pt-4 border-t ${tierBorderText(t.accent)} text-[10px] font-mono uppercase tracking-widest ${dark ? "text-white/50" : "text-black/50"}`}>
                  Entrega 1ª semana del mes · listo para imprimir
                </div>
              </article>
            );
          })}
        </div>

        {/* Mensaje diferenciador final */}
        <div className="mt-14 md:mt-16 text-center max-w-3xl mx-auto">
          <div className="card-hard bg-black text-white p-6 md:p-8 relative">
            <span className="absolute -top-3 left-6 bg-[color:var(--mustard)] text-black text-[10px] font-bold tracking-widest px-3 py-1 border-2 border-black">
              LO QUE NOS HACE DIFERENTES
            </span>
            <p className="font-stencil text-2xl md:text-3xl leading-snug mt-2">
              Tu equipo IA <span className="text-[color:var(--mustard)]">no se queda igual.</span><br />
              Aprende y mejora cada mes.
            </p>
            <p className="text-sm md:text-base text-white/70 mt-4 max-w-2xl mx-auto leading-relaxed">
              Cada informe trae lo que vamos a afinar el mes siguiente: respuestas
              que conviene reescribir, horarios donde respondemos lento, sectores
              donde captamos más. Lo que pagues este mes, vale más el siguiente.
            </p>
            <div className="mt-6">
              <a href="/beta" className="btn-mustard inline-block text-sm px-8 py-3">
                Reservar mi plaza beta →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
