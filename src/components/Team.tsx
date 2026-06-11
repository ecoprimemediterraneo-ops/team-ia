import { agents } from "@/lib/agents";

// Tres módulos funcionales como intro breve, y debajo las 6 tarjetas de agentes
// con sus citas. Sección única (antes estaba duplicada con AgentOS).
const modules = [
  {
    label: "Ventas",
    desc: "Captura leads, responde consultas y cierra citas.",
    agents: [
      { name: "Pablo", role: "WhatsApp 24/7", color: "#25D366" },
      { name: "Carmen", role: "Llamadas entrantes", color: "#A88BE8" },
    ],
  },
  {
    label: "Soporte",
    desc: "Gestiona reseñas, responde correos y cuida al cliente.",
    agents: [
      { name: "Rocío", role: "Reseñas Google", color: "#FBBF24" },
      { name: "Lucía", role: "Correo y gestión", color: "#F5C518" },
    ],
  },
  {
    label: "Operaciones",
    desc: "Publica contenido, envía campañas y ejecuta secuencias.",
    agents: [
      { name: "Marta", role: "Redes sociales", color: "#FF7A59" },
      { name: "Eva", role: "Email marketing", color: "#60A5FA" },
    ],
  },
];

export default function Team() {
  return (
    <section id="equipo" className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-[0.2em]">
          <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">TRES MÓDULOS</span>
          <span className="border border-black/30 px-3 py-1 text-black/50">SEIS AGENTES</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-6xl mb-4 leading-tight">
          Seis agentes.<br />Un sistema.
        </h2>
        <p className="text-base max-w-xl mb-10 text-black/50">
          Tres módulos cubren tu negocio de punta a punta. Cada agente gestiona un canal de forma
          autónoma: tú apruebas, ellos ejecutan.
        </p>

        {/* Intro: los tres módulos */}
        <div className="grid md:grid-cols-3 gap-px bg-black/10 border-2 border-black mb-16">
          {modules.map((m) => (
            <div key={m.label} className="p-5 bg-white">
              <div className="text-[10px] font-mono tracking-[0.2em] text-black/40 mb-1">MÓDULO</div>
              <div className="font-stencil text-2xl mb-2">{m.label}</div>
              <p className="text-xs text-black/55 leading-relaxed mb-4">{m.desc}</p>
              <div className="space-y-1.5">
                {m.agents.map((a) => (
                  <div key={a.name} className="flex items-center gap-2 border border-black/10 px-2.5 py-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                    <span className="font-stencil text-sm">{a.name}</span>
                    <span className="text-[10px] text-black/40 font-mono">{a.role}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Las 6 tarjetas de agentes con sus citas */}
        <div className="grid md:grid-cols-2 gap-10">
          {agents.filter((a) => a.showOnHome).map((a) => (
            <article
              key={a.slug}
              className="dossier pt-14 p-6 hover:-translate-y-1 transition relative overflow-hidden"
            >
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
      </div>
    </section>
  );
}
