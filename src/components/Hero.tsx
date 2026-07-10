import { BETA, CTA, PRECIO_FUNDADOR } from "@/lib/oferta";

// Marquee decorativo: los 4 canales núcleo (copy corto, no es la fuente de verdad del precio).
const canales = [
  { icon: "💬", label: "WhatsApp", desc: "responde y agenda 24/7" },
  { icon: "📞", label: "Llamadas", desc: "coge el teléfono" },
  { icon: "📱", label: "Instagram", desc: "responde y publica" },
  { icon: "📅", label: "Agenda", desc: "todas tus citas juntas" },
];

export default function Hero() {
  const items = [...canales, ...canales, ...canales];
  return (
    <section id="top" className="relative">
      {/* === BANDA DE OFERTA FUNDADORES === */}
      <a
        href={CTA.primaria.href}
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
            <strong className="text-[color:var(--mustard)] font-bold">{BETA.plazas} plazas</strong> · {BETA.mesesGratis} meses gratis · sin tarjeta
          </span>
          <span className="hidden sm:inline text-white/40">·</span>
          <span className="inline-flex items-center gap-1 bg-[color:var(--mustard)] text-black font-bold text-[11px] sm:text-xs tracking-widest uppercase px-3 py-1 border-2 border-black shadow-[2px_2px_0_#000] group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:shadow-[1px_1px_0_#000] transition-all">
            {CTA.primaria.label} →
          </span>
        </div>
      </a>

      {/* Línea fina mostaza superior */}
      <div className="h-[3px] w-full bg-[color:var(--mustard)]" />

      {/* Marquee de los 4 canales (decorativo, oculto a lectores) */}
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

          {/* H1 principal (aria-label para lectura limpia) */}
          <h1
            aria-label="Tu negocio sigue respondiendo aunque estés ocupado."
            className="font-stencil text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.03] tracking-tight"
          >
            <span className="block text-white">TU NEGOCIO SIGUE</span>
            <span className="block text-[color:var(--mustard)] mt-2">RESPONDIENDO</span>
            <span className="block text-white mt-2">AUNQUE ESTÉS OCUPADO.</span>
          </h1>

          {/* Subtítulo — los 4 canales, en llano */}
          <p className="mt-7 max-w-2xl mx-auto text-base md:text-lg text-white/85 font-sans leading-relaxed">
            WhatsApp, llamadas, Instagram y agenda, gestionados por un equipo de{" "}
            <strong className="text-white font-semibold">agentes IA</strong> desde un único panel.
          </p>

          {/* CTA — primaria: solicitar plaza; secundaria: bajar a los 4 agentes */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href={CTA.primaria.href} className="btn-mustard text-sm px-8 py-3">
              {CTA.primaria.label} →
            </a>
            <a
              href={CTA.secundaria.href}
              className="text-sm font-mono border border-white/30 text-white/80 px-8 py-3 hover:border-white hover:text-white transition-all duration-200"
            >
              {CTA.secundaria.label} ↓
            </a>
          </div>

          {/* Microcopy + precio (sin competir con el CTA) */}
          <p className="mt-6 text-xs text-white/45 tracking-widest font-mono">
            {BETA.mesesGratis} meses gratis · Sin tarjeta · Sin permanencia
          </p>
          <p className="mt-2 text-sm font-mono text-white/70">
            Desde <strong className="text-white font-semibold">{PRECIO_FUNDADOR}€/mes</strong>
          </p>
        </div>
      </div>
    </section>
  );
}
