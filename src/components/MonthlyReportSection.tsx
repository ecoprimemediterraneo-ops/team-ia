// Sección FUSIONADA: informe mensual + capa proactiva, en una sola sección
// compacta (una visualización, tres métricas, una recomendación de ejemplo,
// marcada "Ejemplo ilustrativo", y qué está disponible vs en activación).
// Estética: card-hard, paleta cream/mustard/red/ink.

export default function MonthlyReportSection({ compact = false }: { compact?: boolean }) {
  return (
    <section
      id="informe-mensual"
      className="py-16 md:py-24 border-t-[3px] border-black bg-[color:var(--cream)]"
    >
      <div className="max-w-3xl mx-auto px-5">
        {/* Cabecera compacta */}
        <div className="text-center mb-8">
          <span className="inline-block bg-black text-[color:var(--mustard)] px-2 py-1 text-[10px] font-mono font-bold tracking-[0.25em] mb-4">
            INFORME MENSUAL + CAPA PROACTIVA
          </span>
          <h2 className="font-stencil text-4xl md:text-5xl leading-[1.05]">
            Cada mes te dice qué mejorar<br />
            <span className="text-[color:var(--red)]">y ejecuta lo que autorices.</span>
          </h2>
        </div>

        {/* Mockup del informe (una visualización) */}
        <div className="card-hard bg-white p-6 md:p-7 relative">
          <div className="absolute -top-3 left-6 bg-[color:var(--red)] text-white text-[10px] font-bold tracking-widest px-3 py-1 border-2 border-black">
            EJEMPLO ILUSTRATIVO
          </div>
          <div className="flex items-center gap-2 text-[9px] font-mono tracking-[0.25em] mb-4 text-black/60 mt-1">
            <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold">INFORME MENSUAL</span>
            <span aria-hidden="true">·</span>
            <span>EJEMPLO</span>
          </div>

          {/* Tres métricas */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="card-hard bg-[color:var(--mustard)] p-3">
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-black/70 mb-1">Valor generado</div>
              <div className="font-stencil text-3xl md:text-4xl leading-none">3.400€</div>
            </div>
            <div className="card-hard bg-white border-[3px] p-3">
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-black/70 mb-1">Tiempo ahorrado</div>
              <div className="font-stencil text-3xl md:text-4xl leading-none">46<span className="text-xl ml-0.5">h</span></div>
            </div>
            <div className="card-hard bg-white border-[3px] p-3">
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-black/70 mb-1">Leads detectados</div>
              <div className="font-stencil text-3xl md:text-4xl leading-none">27</div>
            </div>
          </div>

          {/* Recomendación de ejemplo (la capa proactiva) */}
          <div className="border-l-4 border-[color:var(--red)] pl-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[color:var(--red)] font-bold mb-1">
              Recomendación del mes
            </div>
            <p className="text-sm leading-snug text-black/80">
              «Los viernes por la tarde se escapan más respuestas: ajusto el seguimiento automático a
              esa franja.» El sistema detecta la oportunidad y ejecuta las acciones que tengas
              autorizadas.
            </p>
          </div>
        </div>

        {/* Disponible vs en activación */}
        <p className="text-center text-xs text-black/55 mt-5 leading-snug max-w-2xl mx-auto">
          El informe mensual y las recomendaciones ya están disponibles. La ejecución automática de
          esas acciones (capa proactiva) se activa por fases.
        </p>

        {!compact && (
          <div className="text-center mt-8">
            <a href="/beta" className="btn-mustard inline-block text-sm px-8 py-3">
              Pide tu demo →
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
