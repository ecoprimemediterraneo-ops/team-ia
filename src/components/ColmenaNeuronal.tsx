// Sección "La Colmena Neuronal" — el diferencial de red, justo después del Hero.
// El nombre "Colmena Neuronal" es concepto de marca y aparece SOLO en esta sección.
// Marca/estilo intactos (Anton/stencil, rojo C8202A, mostaza F5C518, fondo crema).

const puntos = [
  {
    titulo: "Aprende de todos",
    desc: "Cuando una estrategia da resultado en otro negocio de la red, tu sistema la adopta.",
  },
  {
    titulo: "Mejora cada mes",
    desc: "No es un software estático: evoluciona solo con la experiencia de toda la red.",
  },
  {
    titulo: "Más fuerte cada día",
    desc: "Cuanto más crece la colmena, más inteligente se vuelve tu sistema.",
  },
];

export default function ColmenaNeuronal() {
  return (
    <section
      id="colmena"
      className="py-16 md:py-24 border-t-[3px] border-black bg-[color:var(--cream)] text-black"
    >
      <div className="max-w-5xl mx-auto px-5">
        {/* Etiqueta + título + intro */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-block bg-black text-[color:var(--mustard)] px-2 py-1 text-xs font-mono font-bold tracking-widest mb-6">
            LA COLMENA NEURONAL
          </span>
          <h2 className="font-stencil text-4xl sm:text-5xl md:text-6xl leading-[1.02] tracking-tight">
            No trabajas solo.
            <span className="block text-[color:var(--red)] mt-2">Trabajas en red.</span>
          </h2>
          <p className="mt-6 text-base md:text-lg text-black/70 font-sans leading-relaxed">
            Cada negocio de AI-Team aprende de los demás. Lo que funciona en uno, se aplica al tuyo automáticamente.
          </p>
        </div>

        {/* 3 puntos del diferencial de red */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {puntos.map((p) => (
            <article key={p.titulo} className="card-hard bg-white p-6 md:p-7 flex flex-col">
              <span
                aria-hidden="true"
                className="inline-flex items-center justify-center w-12 h-12 bg-black text-[color:var(--mustard)] text-2xl mb-4 border-2 border-black"
              >
                ⬢
              </span>
              <h3 className="font-stencil text-xl md:text-2xl leading-tight mb-2">{p.titulo}</h3>
              <p className="text-sm md:text-base text-black/70 leading-snug font-sans">{p.desc}</p>
            </article>
          ))}
        </div>

        {/* CTA único */}
        <div className="flex justify-center mt-12">
          <a href="/beta" className="btn-mustard text-sm px-8 py-3">
            Pide tu demo →
          </a>
        </div>
      </div>
    </section>
  );
}
