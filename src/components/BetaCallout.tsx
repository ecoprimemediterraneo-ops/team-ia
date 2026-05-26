/**
 * Banner grande BETA · justo debajo del Hero para máxima visibilidad.
 * Hace que la oferta de 50 plazas / 6 meses gratis sea imposible de pasar por alto.
 */
export default function BetaCallout() {
  return (
    <section className="bg-[color:var(--mustard)] border-y-[3px] border-black py-10 md:py-14">
      <div className="max-w-4xl mx-auto px-5 text-center">
        <div className="inline-block bg-black text-[color:var(--mustard)] px-3 py-1 text-xs font-mono font-bold tracking-[0.25em] mb-4">
          🔒 BETA PRIVADA · MÁLAGA · COSTA DEL SOL
        </div>
        <h2 className="font-stencil text-3xl md:text-5xl leading-tight mb-3">
          Abrimos 50 negocios locales para probar AI-Team
          <span className="block mt-1">gratis durante 6 meses.</span>
        </h2>
        <p className="text-sm md:text-base text-black/70 max-w-2xl mx-auto mb-6">
          Sin tarjeta. Sin permanencia. Tu precio fundador congelado para siempre cuando termine la beta.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="/beta" className="bg-black text-[color:var(--mustard)] font-bold uppercase tracking-widest text-sm px-8 py-4 border-[3px] border-black hover:bg-white hover:text-black transition-colors">
            Quiero mi plaza →
          </a>
          <span className="text-xs font-mono text-black/60 tracking-widest">
            QUEDAN 47 DE 50
          </span>
        </div>
      </div>
    </section>
  );
}
