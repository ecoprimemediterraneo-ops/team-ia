// Kit de iniciación AI-Team — 5 pasos con timeline diagonal retro-arcade.
// Diseño distinto del antiguo "Operativo en 24 horas" para no parecerse.
// Liga los pasos 3 y 5 al informe mensual como motor de retención.

type Step = {
  num: string;
  title: string;
  desc: string;
  accent: "mustard" | "red" | "ink" | "cream";
  badge?: string;        // si es etapa especial: "Informe", "Resultado", etc.
};

const STEPS: Step[] = [
  {
    num: "01",
    title: "Conecta tus agentes",
    desc: "WhatsApp, Instagram, Google Business, agenda y email — todo enchufado en una sola tarde, sin código.",
    accent: "mustard",
  },
  {
    num: "02",
    title: "Trabaja con ellos",
    desc: "Los agentes aprenden tu negocio, tu tono y tus servicios. Tú haces lo de siempre; ellos cubren el resto.",
    accent: "cream",
  },
  {
    num: "03",
    title: "Revisa tu informe mensual",
    desc: "Llega el primer informe: cuánto te han ahorrado, qué leads pasaron, qué hay que afinar. En cristiano, una página.",
    accent: "red",
    badge: "INFORME",
  },
  {
    num: "04",
    title: "Tus agentes trabajan por ti",
    desc: "Respuestas, citas, reseñas, posts, llamadas y correos cubiertos 24/7. Tú decides, ellos ejecutan.",
    accent: "cream",
  },
  {
    num: "05",
    title: "Mejora cada mes, sola",
    desc: "Ves las métricas y el valor generado, y además AI-Team afina tus agentes solos cada mes: respuestas más finas, análisis más profundo, menos fugas. No tocas nada — mejora en automático.",
    accent: "ink",
    badge: "MEJORA CONTINUA",
  },
];

function stepBg(a: Step["accent"]): string {
  if (a === "mustard") return "bg-[color:var(--mustard)]";
  if (a === "red") return "bg-[color:var(--red)] text-white";
  if (a === "ink") return "bg-black text-white";
  return "bg-white";
}

function badgeStyle(a: Step["accent"]): string {
  if (a === "ink") return "bg-[color:var(--mustard)] text-black";
  if (a === "red") return "bg-[color:var(--mustard)] text-black";
  return "bg-black text-[color:var(--mustard)]";
}

function arrowColor(a: Step["accent"]): string {
  if (a === "ink") return "text-[color:var(--mustard)]";
  if (a === "red") return "text-white";
  return "text-black";
}

export default function KitInicio() {
  return (
    <section
      id="kit-inicio"
      className="py-20 md:py-28 border-t-[3px] border-black bg-[color:var(--cream)] relative overflow-hidden"
    >
      {/* Banda diagonal decorativa de fondo */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent 0 18px, #000 18px 19px)",
        }}
        aria-hidden
      />

      <div className="max-w-6xl mx-auto px-5 relative">
        {/* Cabecera */}
        <div className="text-center mb-14 md:mb-16">
          <div className="flex items-center justify-center gap-2 mb-4 text-[10px] font-mono tracking-[0.25em]">
            <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold">
              KIT DE INICIACIÓN · 5 PASOS
            </span>
          </div>
          <h2 className="font-stencil text-4xl md:text-6xl leading-[1.05]">
            De cero a equipo IA<br className="hidden md:block" /> en{" "}
            <span className="text-[color:var(--red)]">5 pasos</span>.
          </h2>
          <p className="text-base md:text-lg text-black/65 mt-5 max-w-2xl mx-auto leading-relaxed">
            El paso 3 y el paso 5 son los que enganchan. Cada mes ves negro sobre
            blanco qué hicieron por ti y cuánto vale.
          </p>
        </div>

        {/* Timeline vertical en móvil, horizontal en desktop */}
        <ol className="grid grid-cols-1 md:grid-cols-5 gap-5 md:gap-3 relative">
          {STEPS.map((s, i) => {
            const isLast = i === STEPS.length - 1;
            return (
              <li key={s.num} className="relative">
                <article
                  className={`card-hard p-5 md:p-5 h-full flex flex-col ${stepBg(s.accent)} relative`}
                >
                  {s.badge && (
                    <span
                      className={`absolute -top-3 -right-3 text-[10px] font-mono font-bold tracking-widest px-2 py-1 border-2 border-black shadow-[2px_2px_0_#000] ${badgeStyle(s.accent)}`}
                    >
                      {s.badge}
                    </span>
                  )}
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-stencil text-5xl md:text-6xl leading-none">
                      {s.num}
                    </span>
                  </div>
                  <h3
                    className={`font-stencil text-xl md:text-[22px] leading-tight mb-2 ${s.accent === "red" || s.accent === "ink" ? "text-white" : ""}`}
                  >
                    {s.title}
                  </h3>
                  <p
                    className={`text-xs md:text-[13px] leading-relaxed ${
                      s.accent === "ink"
                        ? "text-white/85"
                        : s.accent === "red"
                          ? "text-white/95"
                          : "text-black/75"
                    }`}
                  >
                    {s.desc}
                  </p>
                </article>

                {/* Flecha entre pasos */}
                {!isLast && (
                  <>
                    {/* Desktop: flecha entre columnas */}
                    <div
                      className={`hidden md:flex absolute top-1/2 -right-2 -translate-y-1/2 text-3xl font-stencil pointer-events-none ${arrowColor(s.accent)}`}
                      aria-hidden
                    >
                      ›
                    </div>
                    {/* Móvil: flecha hacia abajo */}
                    <div
                      className="md:hidden flex justify-center text-2xl font-stencil mt-2 pointer-events-none text-black/40"
                      aria-hidden
                    >
                      ↓
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ol>

        {/* Bloque de cierre con el mensaje fuerte */}
        <div className="mt-14 md:mt-16 max-w-3xl mx-auto">
          <div className="card-hard bg-black text-white p-6 md:p-8 text-center relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[color:var(--mustard)] text-black text-[10px] font-bold tracking-widest px-3 py-1 border-2 border-black whitespace-nowrap">
              LO QUE TE RETIENE
            </span>
            <p className="font-stencil text-2xl md:text-3xl leading-snug mt-2">
              Cada mes ves <span className="text-[color:var(--mustard)]">qué te ha valido tu equipo</span>.<br />
              No es magia: son números.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a href="/beta" className="btn-mustard inline-block text-sm px-7 py-3">
                Reservar mi plaza beta →
              </a>
              <a
                href="#informe-mensual"
                className="text-xs font-mono border-2 border-white/30 text-white/80 px-5 py-3 hover:border-white hover:text-white transition-colors"
              >
                Ver cómo son los informes
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
