const labels = [
  { text: "Empiezas el día con 100+ correos sin leer", pos: "top-[8%] left-[3%] sm:top-[12%] sm:left-[4%]", rot: "-rotate-2" },
  { text: "Tus redes sociales no se actualizan hace semanas", pos: "top-[34%] right-[3%] sm:top-[38%] sm:right-[4%]", rot: "rotate-2" },
  { text: "Llamadas perdidas = clientes perdidos", pos: "top-[58%] left-[3%] sm:top-[60%] sm:left-[6%]", rot: "-rotate-1" },
  { text: "Todo se pospone para «la próxima semana»", pos: "bottom-[6%] right-[3%] sm:bottom-[8%] sm:right-[5%]", rot: "rotate-1" },
];

export default function Pains() {
  return (
    <section className="py-20 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-8 text-xs font-mono">
          <span className="bg-[color:var(--red)] text-white px-2 py-1 font-bold tracking-widest">SITUACIÓN ACTUAL</span>
          <span className="border-2 border-black px-2 py-1 font-bold tracking-widest">CIVIL EN APUROS</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-10 leading-[0.95]">
          Quieres crecer,<br />pero estás solo
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

          {/* Silueta tipo cómic — usa una imagen colocada en /public/hero-pain.png cuando la tengas */}
          {/* Mientras: silueta CSS con un emoji grande en el centro y "papeles volando" */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[20vw] md:text-[14rem] leading-none select-none drop-shadow-[6px_6px_0_rgba(0,0,0,0.6)]">
              😩
            </div>
          </div>
          {/* Papeles volando (decorativos) */}
          <div className="absolute top-6 left-8 w-16 h-20 bg-white/90 border-2 border-black rotate-[-12deg]" />
          <div className="absolute top-12 right-12 w-14 h-18 bg-white/85 border-2 border-black rotate-[8deg]" />
          <div className="absolute bottom-12 left-16 w-12 h-16 bg-white/80 border-2 border-black rotate-[15deg]" />
          <div className="absolute bottom-20 right-20 w-16 h-20 bg-white/85 border-2 border-black rotate-[-6deg]" />

          {/* Líneas de viñeta tipo cómic en las esquinas */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
            <defs>
              <pattern id="lines" width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M-1 7 l8-8 M0 6 l6-6" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#lines)" />
          </svg>

          {/* Etiquetas amarillas flotantes */}
          {labels.map((l, i) => (
            <span
              key={i}
              className={`absolute ${l.pos} ${l.rot} bg-[color:var(--mustard)] text-black font-bold text-sm sm:text-base md:text-lg px-3 py-2 sm:px-4 sm:py-3 border-[3px] border-black shadow-[5px_5px_0_#000] max-w-[60%] sm:max-w-xs leading-tight`}
            >
              {l.text}
            </span>
          ))}

          {/* Sello rojo en esquina */}
          <div className="absolute top-4 right-4 stamp text-[10px] sm:text-xs">
            Misión: rescatarte
          </div>
        </div>

        <p className="mt-8 text-center text-lg md:text-xl max-w-2xl mx-auto">
          Eres el CEO, el comercial, el de marketing y el que coge el teléfono.
          A las 23:00 sigues con el portátil. <span className="font-bold">Esto se acaba hoy.</span>
        </p>
      </div>
    </section>
  );
}
