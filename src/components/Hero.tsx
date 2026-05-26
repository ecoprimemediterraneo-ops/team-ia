import { agents } from "@/lib/agents";

export default function Hero() {
  // Excluimos Tomás del hero (es soporte interno, no agente operativo vendible)
  const team = agents.filter((a) => a.slug !== "tomas");
  const items = [...team, ...team, ...team];
  return (
    <section id="top" className="relative">
      {/* Cinta militar superior */}
      <div className="stripe-tape h-3 w-full" />

      {/* Marquee de la unidad */}
      <div className="border-y-[3px] border-black bg-[color:var(--olive)] text-white py-3 overflow-hidden">
        <div className="marquee-track flex gap-12 items-center text-2xl md:text-3xl font-stencil whitespace-nowrap">
          {items.map((a, i) => (
            <span key={i} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.avatar}
                alt={a.name}
                className="w-12 h-12 border-[3px] border-black"
                style={{ background: a.color }}
              />
              <span>{a.name.toUpperCase()} · {a.role.toUpperCase()}</span>
              <span className="text-[color:var(--mustard)]">★</span>
            </span>
          ))}
        </div>
      </div>

      {/* Bloque hero ladrillo */}
      <div className="brick relative overflow-hidden border-b-[3px] border-black/40">
        <div className="relative max-w-5xl mx-auto px-6 pt-24 md:pt-36 pb-16 md:pb-24 z-10 text-center text-white">

          {/* Concepto en 3 segundos */}
          <p className="text-[11px] font-mono tracking-[0.25em] text-white/40 mb-6 uppercase">
            9 empleados IA para tu negocio local · Sin nómina, sin vacaciones
          </p>

          {/* Badges refinados */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono mb-10 tracking-[0.2em]">
            <span className="border border-white/30 text-white/60 px-3 py-1 rounded-full">CLÍNICAS · PELUQUERÍAS · FISIOS · RESTAURANTES</span>
            <span className="border-2 border-[color:var(--mustard)] text-[color:var(--mustard)] px-3 py-1 rounded-full font-bold">🔒 50 PLAZAS · 6 MESES GRATIS</span>
          </div>

          {/* H1 principal */}
          <h1 className="font-stencil text-4xl sm:text-6xl md:text-7xl lg:text-[80px] leading-[1.0] tracking-tight">
            <span className="block text-white">TU NEGOCIO SIGUE</span>
            <span className="block text-[color:var(--mustard)] mt-2">RESPONDIENDO</span>
            <span className="block text-white mt-2">AUNQUE ESTÉS</span>
            <span className="block text-white">OCUPADO.</span>
          </h1>

          {/* Separador */}
          <div className="w-16 h-[2px] bg-white/20 mx-auto mt-10 mb-10" />

          {/* Descripción */}
          <p className="text-base md:text-lg max-w-xl mx-auto text-white/70 leading-relaxed font-sans">
            WhatsApp, llamadas, citas y clientes organizados sin perseguir mensajes todo el día.
            <span className="block mt-2 text-[color:var(--mustard)] font-semibold">50 plazas · 6 meses gratis</span>
          </p>

          {/* CTAs */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="/beta" className="btn-mustard text-sm px-8 py-3">
              Probar gratis →
            </a>
            <a
              href="#equipo"
              className="text-sm font-mono border border-white/30 text-white/80 px-8 py-3 hover:border-white hover:text-white transition-all duration-200"
            >
              Ver agentes →
            </a>
          </div>

          {/* Social proof honesta */}
          <p className="mt-6 text-xs text-white/35 tracking-widest font-mono">
            50 PLAZAS · 6 MESES GRATIS · SIN PERMANENCIA · PRECIO CONGELADO
          </p>
        </div>

        {/* Foto-strip de 8 agentes operativos (sin Tomás) · móvil 4x2 · desktop 8x1 */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 md:gap-3">
            {team.map((a) => (
              <div
                key={a.slug}
                className="relative border-2 border-white/20 overflow-hidden group hover:border-white/60 transition-all duration-200"
                style={{ background: a.color }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.avatar} alt={a.name} className="w-full aspect-square object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/85 text-white px-2 py-1.5 text-center leading-tight">
                  <div className="font-stencil text-[11px] md:text-xs">{a.name.toUpperCase()}</div>
                  <div className="text-[9px] md:text-[10px] text-[color:var(--mustard)] font-bold mt-0.5">{a.tagline}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
