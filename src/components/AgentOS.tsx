const modules = [
  {
    id: "VENTAS",
    label: "Ventas",
    desc: "Captura leads, responde consultas y cierra citas sin intervención humana.",
    agents: [
      { name: "Pablo", role: "WhatsApp 24/7", status: "active", color: "#25D366" },
      { name: "Carmen", role: "Llamadas entrantes", status: "active", color: "#A88BE8" },
    ],
  },
  {
    id: "SOPORTE",
    label: "Soporte",
    desc: "Gestiona reseñas, responde correos y mantiene la relación con el cliente.",
    agents: [
      { name: "Rocío", role: "Reseñas Google", status: "active", color: "#FBBF24" },
      { name: "Lucía", role: "Correo y calendario", status: "active", color: "#F5C518" },
    ],
  },
  {
    id: "OPERACIONES",
    label: "Operaciones",
    desc: "Publica contenido, envía campañas y ejecuta secuencias automáticas.",
    agents: [
      { name: "Marta", role: "Redes sociales", status: "active", color: "#FF7A59" },
      { name: "Eva", role: "Email marketing", status: "active", color: "#60A5FA" },
    ],
  },
];

export default function AgentOS() {
  return (
    <section className="py-24 border-t-[3px] border-black bg-black text-white overflow-hidden">
      <div className="max-w-5xl mx-auto px-6">

        <h2 className="font-stencil text-5xl md:text-6xl mb-4 leading-tight">
          Tres módulos.<br />Seis agentes.
        </h2>
        <p className="text-base text-white/40 mb-16 max-w-xl font-mono">
          Cada agente es un proceso autónomo. Cada módulo cubre una función crítica del negocio. El sistema opera en paralelo, sin supervisión.
        </p>

        {/* Grid de módulos */}
        <div className="grid md:grid-cols-3 gap-px bg-white/10 border border-white/10">
          {modules.map((m) => (
            <div key={m.id} className="p-6 bg-[#0a0a0a]">
              {/* Module header */}
              <div className="mb-4">
                <div className="text-[10px] font-mono tracking-[0.2em] text-white/30 mb-1">MÓDULO</div>
                <div className="font-stencil text-2xl text-white">
                  {m.label}
                </div>
              </div>

              <p className="text-xs text-white/40 leading-relaxed mb-5">{m.desc}</p>

              {/* Agentes del módulo */}
              <div className="space-y-2">
                {m.agents.map((a) => (
                  <div key={a.name} className="flex items-center gap-3 border border-white/8 px-3 py-2 bg-white/3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                    <span className="font-stencil text-sm text-white">{a.name}</span>
                    <span className="text-[10px] text-white/30 font-mono">{a.role}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
