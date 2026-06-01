// Sección honesta: solo el testimonio real (Bogotá). El resto se rellenará
// cuando los primeros clientes de la beta empiecen a usarlo.

const items = [
  {
    name: "Patricia G.",
    sector: "Clínica dental · Bogotá",
    text: "Pensé que era marketing. Es una pasada. La tropa funciona mientras yo cierro la clínica.",
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-[0.2em]">
          <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">
            CLIENTE PILOTO
          </span>
        </div>
        <h2 className="font-stencil text-5xl md:text-6xl mb-6 leading-tight">
          Los primeros<br />usándolo de verdad
        </h2>
        <p className="text-base text-black/60 mb-16 max-w-2xl">
          Estamos en beta privada con las primeras 50 plazas fundadoras. Aquí compartimos lo que dicen quienes ya están dentro.
        </p>

        <div className="grid md:grid-cols-2 gap-px bg-black border-[3px] border-black">
          {items.map((t) => (
            <article key={t.name} className="p-6 bg-[color:var(--cream)]">
              <div className="text-xs text-black/30 tracking-widest font-mono mb-4">★★★★★</div>
              <p className="text-base leading-relaxed text-black/80 mb-6">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="border-t border-black/10 pt-4">
                <div className="font-semibold text-sm">{t.name}</div>
                <div className="text-[11px] uppercase tracking-wider text-black/40 mt-0.5">
                  {t.sector}
                </div>
              </div>
            </article>
          ))}

          {/* Tarjeta honesta sobre las plazas */}
          <article className="p-6 bg-black text-[color:var(--mustard)] flex flex-col justify-center">
            <div className="font-stencil text-5xl mb-2">49</div>
            <p className="text-sm text-white/80 mb-4">
              plazas fundadoras todavía libres. 6 meses gratis, sin tarjeta, precio congelado para siempre.
            </p>
            <a
              href="/beta"
              className="inline-block self-start text-xs font-mono font-bold tracking-widest uppercase border-2 border-[color:var(--mustard)] px-3 py-2 hover:bg-[color:var(--mustard)] hover:text-black transition-colors"
            >
              Reservar plaza →
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
