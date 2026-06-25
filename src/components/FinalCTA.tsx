// Banner final de la home. Un único formulario en todo el funnel vive en /beta,
// así que aquí solo hay un CTA que lleva allí (sin formulario inline).
export default function FinalCTA() {
  return (
    <section id="waitlist" className="border-t-[3px] border-black bg-black text-[color:var(--cream)]">
      <div className="max-w-3xl mx-auto px-5 py-16 md:py-24 text-center">
        <div className="flex flex-wrap justify-center items-center gap-2 text-[10px] font-mono mb-8 tracking-[0.2em]">
          <span className="border border-[color:var(--mustard)]/40 text-[color:var(--mustard)] px-3 py-1">ACCESO FUNDADOR</span>
          <span className="border border-white/20 text-white/40 px-3 py-1">20 PLAZAS · PRECIO CONGELADO</span>
        </div>

        <h2 className="font-stencil text-5xl md:text-7xl mb-6 leading-tight">
          Tu sistema operativo.<br />Esta noche.
        </h2>

        <p className="font-stencil text-xl md:text-2xl text-[color:var(--mustard)] mb-6">
          El sistema detecta la oportunidad y ejecuta las acciones que tengas autorizadas.
        </p>

        <p className="text-base md:text-lg mb-2 text-white/50 max-w-md mx-auto">
          Desde <span className="text-white font-semibold">149 €/mes</span>, precio fundador congelado de por vida.
        </p>
        <p className="text-sm mb-10 text-white/30 max-w-sm mx-auto">
          6 meses gratis, sin tarjeta y sin permanencia. Si no ves el valor, te vas en un click.
        </p>

        <a
          href="/beta"
          className="bg-[color:var(--mustard)] text-black font-bold text-base py-4 px-10 border-[3px] border-[color:var(--mustard)] hover:bg-transparent hover:text-[color:var(--mustard)] transition-colors tracking-wide inline-block"
        >
          Pide tu demo →
        </a>
      </div>
    </section>
  );
}
