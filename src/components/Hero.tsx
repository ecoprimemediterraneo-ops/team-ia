import { agents } from "@/lib/agents";

export default function Hero() {
  const team = agents.filter((a) => a.showOnHome);
  const items = [...team, ...team, ...team];
  return (
    <section id="top" className="relative">
      {/* === BANDA DE OFERTA FUNDADORES === */}
      <a
        href="/beta"
        className="block bg-[color:var(--red)] text-white border-b-[3px] border-black group focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--mustard)]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[color:var(--mustard)] animate-pulse" aria-hidden />
            <span className="font-stencil tracking-[0.18em] text-sm sm:text-base">
              OFERTA FUNDADORES
            </span>
          </span>
          <span className="hidden sm:inline text-white/40">·</span>
          <span className="font-mono text-[11px] sm:text-xs tracking-widest uppercase">
            <strong className="text-[color:var(--mustard)] font-bold">20 plazas</strong> · 6 meses gratis · sin tarjeta
          </span>
          <span className="hidden sm:inline text-white/40">·</span>
          <span className="inline-flex items-center gap-1 bg-[color:var(--mustard)] text-black font-bold text-[11px] sm:text-xs tracking-widest uppercase px-3 py-1 border-2 border-black shadow-[2px_2px_0_#000] group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:shadow-[1px_1px_0_#000] transition-all">
            Reservar plaza →
          </span>
        </div>
      </a>

      {/* Línea fina mostaza superior */}
      <div className="h-[3px] w-full bg-[color:var(--mustard)]" />

      {/* Marquee del equipo */}
      <div className="border-y border-[color:var(--mustard)]/40 bg-[#111111] text-white py-3 overflow-hidden">
        <div className="marquee-track flex gap-10 items-center text-xl md:text-2xl font-stencil whitespace-nowrap">
          {items.map((a, i) => (
            <span key={i} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.avatar}
                alt={a.name}
                className="w-10 h-10 border-2 border-white/30 rounded-full"
                style={{ background: a.color }}
              />
              <span>
                {a.name.toUpperCase()}{" "}
                <span className="text-white/40">·</span>{" "}
                <span className="text-white/70">{a.role}</span>
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Bloque hero ladrillo */}
      <div className="brick relative overflow-hidden border-b-[3px] border-black/40">
        <div className="relative max-w-5xl mx-auto px-6 pt-24 md:pt-36 pb-16 md:pb-24 z-10 text-center text-white">

          {/* Badge superior */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono mb-10 tracking-[0.2em]">
            <span className="border border-[color:var(--mustard)]/60 text-[color:var(--mustard)] px-3 py-1 rounded-full">
              20 PLAZAS BETA · 6 MESES GRATIS
            </span>
          </div>

          {/* H1 principal */}
          <h1 className="font-stencil text-4xl sm:text-6xl md:text-7xl lg:text-[80px] leading-[1.0] tracking-tight">
            <span className="block text-white">SEIS EMPLEADOS 24H:</span>
            <span className="block text-white mt-2">MÁS TIEMPO PARA TI,</span>
            <span className="block text-white mt-2">
              <span className="text-[color:var(--mustard)]">MÁS CITAS</span> PARA TU NEGOCIO
            </span>
          </h1>

          {/* Separador */}
          <div className="w-16 h-[2px] bg-white/20 mx-auto mt-10 mb-10" />

          {/* Descripción */}
          <p className="text-base md:text-lg max-w-xl mx-auto text-white/70 leading-relaxed font-sans">
            Cubren WhatsApp, llamadas, reseñas, correo, redes y email marketing mientras duermes.
            <span className="block mt-2 text-white/90 font-semibold">
              Desde 89 €/mes. Operativo en 24 horas.
            </span>
          </p>

          {/* CTA */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="/beta" className="btn-mustard text-sm px-8 py-3">
              Reservar plaza →
            </a>
            <a
              href="/precios"
              className="text-sm font-mono border border-white/30 text-white/80 px-8 py-3 hover:border-white hover:text-white transition-all duration-200"
            >
              Ver planes y precios
            </a>
          </div>

          {/* Línea fina */}
          <p className="mt-6 text-xs text-white/35 tracking-widest font-mono">
            20 PLAZAS BETA · 6 MESES GRATIS · SIN PERMANENCIA
          </p>
        </div>

        {/* Foto-strip de agentes */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 md:gap-3">
            {team.map((a) => (
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
