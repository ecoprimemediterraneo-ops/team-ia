
export default function Pains() {
  return (
    <section className="py-20 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-8 text-xs font-mono">
          <span className="bg-[color:var(--red)] text-white px-2 py-1 font-bold tracking-widest">SITUACIÓN ACTUAL</span>
          <span className="border-2 border-black px-2 py-1 font-bold tracking-widest">COSTE OPERATIVO</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-10 leading-[0.95]">
          La operación<br />te come el tiempo
        </h2>

        {/* Viñeta cómic */}
        <div
          className="relative w-full overflow-hidden border-[5px] border-black shadow-[10px_10px_0_#000]"
          style={{ aspectRatio: "4 / 3" }}
        >
          {/* Fondo cómic: degradado azul noche + halftone */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1.6px),
                linear-gradient(135deg, #1a2540 0%, #0f1729 100%)
              `,
              backgroundSize: "8px 8px, 100% 100%",
              backgroundPosition: "0 0, 0 0",
            }}
          />

          {/* Imagen cómic ochentera del equipo trabajando */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/agentes/team-action.png"
            alt="AI-Team trabajando en la oficina ochentera"
            className="absolute inset-0 w-full h-full object-cover object-top"
          />


          {/* Sello rojo en esquina */}
          <div className="absolute top-4 right-4 stamp text-[10px] sm:text-xs">
            Problema resuelto
          </div>
        </div>

        <p className="mt-8 text-center text-base md:text-lg max-w-xl mx-auto text-black/60">
          La operación diaria no debería depender del fundador. Cada hora gestionando correos, llamadas o redes es una hora que no va a crecimiento.
          <span className="block mt-2 font-semibold text-black">AI-Team automatiza esa carga.</span>
        </p>
      </div>
    </section>
  );
}
