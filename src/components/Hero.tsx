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
            <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">EXPEDIENTE M-001</span>
            <span className="border-2 border-white text-white px-2 py-1 font-bold tracking-widest">CLASIFICADO</span>
            <span className="bg-[color:var(--red)] text-white px-2 py-1 font-bold tracking-widest">MISIÓN ACTIVA</span>
          </div>

          <h1 className="font-stencil text-4xl sm:text-6xl md:text-8xl leading-[1.05]">
            <span className="block">UNA UNIDAD.</span>
            <span className="block">CUATRO</span>
            <span className="block">ESPECIALISTAS.</span>
            <span className="inline-block barred mt-4 px-3 py-1">UN SUELDO.</span>
          </h1>

          <p className="mt-10 font-display text-3xl md:text-5xl leading-tight">
            Tu equipo de IA<br />
            <span className="text-[color:var(--mustard)]">para escalar tu negocio</span>
          </p>

          <p className="mt-8 text-base md:text-lg max-w-2xl mx-auto text-white/85">
            Mientras estás en una reunión, alguien contesta el teléfono.
            Mientras tomas un café, salen tus posts. Mientras duermes, tu correo se ordena solo.
            <span className="block mt-2 font-bold text-white">Tú dejas de hacerlo todo. Ellos lo hacen por ti.</span>
          </p>

          <div className="mt-10 flex flex-col items-center gap-3">
            <a href="#waitlist" className="btn-mustard text-lg">Reclutar mi equipo</a>
            <p className="text-sm text-white/60">+1.200 negocios ya quieren entrar · Plazas fundadoras a 29 €/mes</p>
          </div>
        </div>

        {/* Foto-strip de los 4 agentes al pie del hero */}
        <div className="relative z-10 max-w-6xl mx-auto px-5 pb-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-5">
            {agents.map((a) => (
              <div
                key={a.slug}
                className="relative border-[4px] border-white shadow-[6px_6px_0_#000] overflow-hidden"
                style={{ background: a.color }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.avatar} alt={a.name} className="w-full aspect-square object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/85 text-white px-2 py-1.5 font-stencil text-sm md:text-base text-center">
                  {a.name.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
