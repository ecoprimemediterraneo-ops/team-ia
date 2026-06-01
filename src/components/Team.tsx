import { agents } from "@/lib/agents";

// Agentes secundarios — incluidos pero no en el grid principal.
// Tomás no está en el catálogo agents.ts (es soporte), así que va aparte.
const secondary = [
  {
    slug: "diana",
    name: "Diana",
    role: "Auditoría inicial gratis",
    avatar: "/agentes/diana.webp",
    color: "#14B8A6",
    href: "/agentes/diana",
  },
  {
    slug: "sergio",
    name: "Sergio",
    role: "Vigila a tu competencia 24/7",
    avatar: "/agentes/sergio.webp",
    color: "#3B82F6",
    href: "/agentes/sergio",
  },
  {
    slug: "tomas",
    name: "Tomás",
    role: "Soporte 24/7 dentro del producto",
    avatar: "/agentes/tomas/tomas.webp",
    color: "#A88BE8",
    href: null, // Tomás no tiene página propia
  },
];

export default function Team() {
  return (
    <section id="equipo" className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-[0.2em]">
          <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">MÓDULO 01</span>
          <span className="border border-black/30 px-3 py-1 text-black/50">AGENTES ESPECIALIZADOS</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-6xl mb-4 leading-tight">
          Seis agentes.<br />Un sistema.
        </h2>
        <p className="text-base max-w-xl mb-16 text-black/50">
          Cada agente gestiona un canal de forma autónoma. Operan en paralelo, sin supervisión, sin interrupciones.
        </p>

        {/* Grid principal: 6 agentes */}
        <div className="grid md:grid-cols-2 gap-10 mt-16">
          {agents.filter((a) => a.showOnHome).map((a) => (
            <article
              key={a.slug}
              className="dossier pt-14 p-6 hover:-translate-y-1 transition relative overflow-hidden"
            >
              {/* Pestaña decorativa superior (color mostaza, sin texto militar) */}
              <div className="absolute top-1 left-4 right-4 flex items-center z-10 text-black/70 text-[10px] font-mono tracking-widest">
                <span>{a.name.toUpperCase()}</span>
              </div>

              {a.status === "soon" && (
                <div className="absolute top-14 -right-14 rotate-45 bg-[color:var(--red)] text-white text-[9px] sm:text-[10px] font-bold tracking-widest px-14 py-1 z-20 shadow-md">
                  PRÓXIMAMENTE
                </div>
              )}

              <div className="flex items-start gap-5 relative">
                <div
                  className="relative w-28 h-28 border-[3px] border-black overflow-hidden shrink-0"
                  style={{ background: a.color }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.avatar}
                    alt={a.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <span className="absolute -bottom-1 -right-1 bg-white border-[3px] border-black w-9 h-9 flex items-center justify-center text-xl z-10">
                    {a.emoji}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 pr-20 sm:pr-24">
                    <h3 className="font-stencil text-3xl sm:text-4xl">{a.name}</h3>
                  </div>
                  <p className="text-sm uppercase tracking-wider font-semibold text-black/60">
                    {a.role}
                  </p>
                  <p className="text-sm text-black/70 mt-2">{a.short}</p>
                </div>
              </div>

              <blockquote className="mt-5 text-base md:text-lg leading-relaxed border-l-4 border-[color:var(--red)] pl-4 italic">
                «{a.quote}»
              </blockquote>
            </article>
          ))}
        </div>

        {/* Agentes secundarios — cards más pequeñas (~65% del tamaño principal) */}
        <div className="mt-16 pt-10 border-t-2 border-black/15">
          <div className="text-[10px] font-mono tracking-[0.25em] text-black/40 uppercase mb-6 text-center">
            También incluidos
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {secondary.map((a) => {
              const CardInner = (
                <div className="flex items-center gap-3 p-4 bg-white border-2 border-black/80 shadow-[4px_4px_0_#000] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#000] transition h-full">
                  <div
                    className="relative w-16 h-16 rounded-full border-[3px] border-black overflow-hidden shrink-0"
                    style={{ background: a.color }}
                  >
                    {/* Fallback (inicial) detrás — se ve si la imagen falla */}
                    <span
                      className="absolute inset-0 flex items-center justify-center font-stencil text-2xl text-white"
                      aria-hidden="true"
                    >
                      {a.name.charAt(0)}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.avatar}
                      alt={a.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-stencil text-lg leading-tight">{a.name}</div>
                    <div className="text-[11px] text-black/55 leading-snug">{a.role}</div>
                  </div>
                </div>
              );

              return a.href ? (
                <a key={a.slug} href={a.href} className="block">
                  {CardInner}
                </a>
              ) : (
                <div key={a.slug}>{CardInner}</div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
