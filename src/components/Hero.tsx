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
      <div className="brick relative overflow-hidden border-b-[6px] border-[color:var(--red)]">
        <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-28 z-10 text-center text-white">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono mb-8">
            <span className="border-2 border-white text-white px-2 py-1 font-bold tracking-widest">CLASIFICADO</span>
            <span className="bg-[color:var(--red)] text-white px-2 py-1 font-bold tracking-widest">MISIÓN ACTIVA</span>
          </div>

          <h1 className="font-stencil text-3xl sm:text-5xl md:text-7xl lg:text-8xl leading-[1.05]">
            <span className="block">TU NEGOCIO.</span>
            <span className="block">SIETE AGENTES.</span>
            <span className="inline-block barred mt-4 px-3 py-1">UN SUELDO.</span>
          </h1>

          <p className="mt-8 text-base md:text-xl max-w-2xl mx-auto text-white/85 leading-relaxed">
            WhatsApp contestado. Reseñas respondidas. Posts publicados. Correos gestionados. Competidores vigilados.
            <span className="block mt-3 font-bold text-white text-lg md:text-2xl">Todo automático. Tú solo apruebas.</span>
          </p>

          <div className="mt-10 flex flex-col items-center gap-4">
            <div className="flex gap-3 flex-wrap justify-center">
              <a href="/demo" className="btn-mustard text-lg">
                👁 VER DEMO →
              </a>
              <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer" className="text-sm font-mono border-2 border-white text-white px-5 py-2 hover:bg-white hover:text-black transition-colors">
                📅 RESERVAR DEMO →
              </a>
            </div>
            <a href="/#packs" className="text-sm font-mono text-white/60 hover:text-white transition-colors underline underline-offset-4">Ver precios →</a>
            <p className="text-sm text-white/50">+1.200 negocios en lista de espera · desde 39 €/mes · 14 días gratis</p>
          </div>
        </div>

        {/* Foto-strip de 7 agentes al pie */}
        <div className="relative z-10 max-w-6xl mx-auto px-5 pb-12">
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 md:gap-3">
            {agents.map((a) => (
              <div
                key={a.slug}
                className="relative border-[4px] border-white shadow-[6px_6px_0_#000] overflow-hidden"
                style={{ background: a.color }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.avatar} alt={a.name} className="w-full aspect-square object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/85 text-white px-2 py-1 font-stencil text-xs md:text-sm text-center leading-tight">
                  {a.name.toUpperCase()}
                  <div className="text-[8px] tracking-widest text-white/60 font-sans normal-case">{a.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
