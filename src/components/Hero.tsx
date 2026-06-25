// Funciones del sistema (sin personajes ni caras).
const funciones = [
  { icon: "💬", label: "WhatsApp", desc: "responde y agenda 24/7" },
  { icon: "📞", label: "Llamadas", desc: "atiende el teléfono" },
  { icon: "⭐", label: "Reseñas", desc: "pide y responde en Google" },
  { icon: "📬", label: "Correo y agenda", desc: "ordena bandeja y citas" },
  { icon: "✉️", label: "Email marketing", desc: "campañas automáticas" },
  { icon: "📱", label: "Instagram", desc: "prepara y programa contenido" },
];

export default function Hero() {
  const items = [...funciones, ...funciones, ...funciones];
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
            Pide tu demo →
          </span>
        </div>
      </a>

      {/* Línea fina mostaza superior */}
      <div className="h-[3px] w-full bg-[color:var(--mustard)]" />

      {/* Marquee de funciones del sistema (decorativo, oculto a lectores) */}
      <div aria-hidden="true" className="border-y border-[color:var(--mustard)]/40 bg-[#111111] text-white py-3 overflow-hidden">
        <div className="marquee-track flex gap-10 items-center text-xl md:text-2xl font-stencil whitespace-nowrap">
          {items.map((f, i) => (
            <span key={i} className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>{f.icon}</span>
              <span>
                {f.label.toUpperCase()}{" "}
                <span className="text-white/40">·</span>{" "}
                <span className="text-white/70 normal-case font-sans text-base">{f.desc}</span>
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Bloque hero ladrillo */}
      <div className="brick relative overflow-hidden border-b-[3px] border-black/40">
        <div className="relative max-w-5xl mx-auto px-6 pt-14 md:pt-24 pb-14 md:pb-20 z-10 text-center text-white">

          {/* Badge de posicionamiento */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono mb-8 tracking-[0.2em]">
            <span className="border border-[color:var(--mustard)]/60 text-[color:var(--mustard)] px-3 py-1 rounded-full">
              PARA CLÍNICAS Y NEGOCIOS DE SERVICIOS
            </span>
          </div>

          {/* H1 principal — propuesta concreta (aria-label para lectura limpia) */}
          <h1
            aria-label="Todo tu negocio: respondido, agendado y mejorando solo."
            className="font-stencil text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.02] tracking-tight"
          >
            <span className="block text-white">TODO TU NEGOCIO:</span>
            <span className="block text-white mt-2">RESPONDIDO, AGENDADO</span>
            <span className="block text-white mt-2">Y <span className="text-[color:var(--mustard)]">MEJORANDO SOLO.</span></span>
          </h1>

          {/* Capacidades del sistema (sustituye al subtítulo en párrafo) */}
          <ul className="mt-8 max-w-xl mx-auto flex flex-col gap-3 text-left text-base md:text-lg text-white/85 font-sans">
            {[
              "Respondemos al instante 24/7 y convertimos más leads en clientes",
              "Atendemos WhatsApp, llamadas, Instagram, email y reseñas",
              "Agendamos tus citas solas, de la consulta a la confirmación",
              "Recuperamos las oportunidades que se te escapan",
              "Mejoramos tu negocio cada mes con lo que aprende toda la red",
            ].map((punto) => (
              <li key={punto} className="flex items-start gap-3 leading-snug">
                <span aria-hidden="true" className="text-[color:var(--mustard)] font-stencil text-lg leading-none mt-[2px]">✓</span>
                <span>{punto}</span>
              </li>
            ))}
          </ul>

          {/* CTA — primaria de conversión: Pide tu demo; secundaria: bajar a cómo funciona */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="/beta" className="btn-mustard text-sm px-8 py-3">
              Pide tu demo →
            </a>
            <a
              href="#como-funciona"
              className="text-sm font-mono border border-white/30 text-white/80 px-8 py-3 hover:border-white hover:text-white transition-all duration-200"
            >
              Ver cómo funciona ↓
            </a>
          </div>

          {/* Microcopy + precio (sin competir con el CTA) */}
          <p className="mt-6 text-xs text-white/45 tracking-widest font-mono">
            6 meses gratis · Sin tarjeta · Sin permanencia
          </p>
          <p className="mt-2 text-sm font-mono text-white/70">
            Desde <strong className="text-white font-semibold">149€/mes</strong>
          </p>
        </div>
      </div>
    </section>
  );
}
