import { agents } from "@/lib/agents";

export default function Hero() {
  const items = [...agents, ...agents, ...agents];
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
            Sistema operativo de empleados IA · Para pequeñas y medianas empresas
          </p>

          {/* Badges refinados */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono mb-10 tracking-[0.2em]">
            <span className="border border-white/30 text-white/60 px-3 py-1 rounded-full">INFRAESTRUCTURA IA</span>
            <span className="border border-[color:var(--red)]/60 text-[color:var(--red)] px-3 py-1 rounded-full">● SISTEMA ACTIVO</span>
          </div>

          {/* H1 principal */}
          <h1 className="font-stencil text-4xl sm:text-6xl md:text-7xl lg:text-[80px] leading-[1.0] tracking-tight">
            <span className="block text-white">TU COMPETENCIA</span>
            <span className="block text-white">YA CONTESTA</span>
            <span className="block text-[color:var(--mustard)] mt-2">A LAS 23:00.</span>
            <span className="block text-white mt-2">TÚ DECIDES.</span>
          </h1>

          {/* Separador */}
          <div className="w-16 h-[2px] bg-white/20 mx-auto mt-10 mb-10" />

          {/* Descripción */}
          <p className="text-base md:text-lg max-w-xl mx-auto text-white/70 leading-relaxed font-sans">
            Siete empleados IA cubren WhatsApp, llamadas, reseñas, correo, redes y vigilan a tu competencia mientras duermes.
            <span className="block mt-2 text-white/90 font-semibold">Desde 39 €/mes. Operativo en 24 horas.</span>
          </p>

          {/* CTAs */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="/demo" className="btn-mustard text-sm px-8 py-3">
              Ver demo en vivo →
            </a>
            <a
              href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono border border-white/30 text-white/80 px-8 py-3 hover:border-white hover:text-white transition-all duration-200"
            >
              Reservar llamada →
            </a>
          </div>

          {/* Social proof */}
          <p className="mt-6 text-xs text-white/35 tracking-widest font-mono">
            +1.200 NEGOCIOS EN LISTA · OPERATIVO EN 24H · 14 DÍAS SIN TARJETA
          </p>
        </div>

        {/* Foto-strip de 7 agentes */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 md:gap-3">
            {agents.map((a) => (
              <div
                key={a.slug}
                className="relative border-2 border-white/20 overflow-hidden group hover:border-white/60 transition-all duration-200"
                style={{ background: a.color }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.avatar} alt={a.name} className="w-full aspect-square object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white px-2 py-1 font-stencil text-[10px] md:text-xs text-center leading-tight">
                  {a.name.toUpperCase()}
                  <div className="text-[7px] tracking-widest text-white/50 font-sans normal-case">{a.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
