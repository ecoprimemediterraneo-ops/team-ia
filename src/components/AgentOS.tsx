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
  {
    id: "INTELIGENCIA",
    label: "Inteligencia",
    desc: "Monitoriza el mercado, analiza competidores y genera informes automáticos.",
    agents: [
      { name: "Sergio", role: "Coordinador IA", status: "active", color: "#3B82F6" },
    ],
    highlight: true,
  },
];

export default function AgentOS() {
  return (
    <section className="py-24 border-t-[3px] border-black bg-black text-white overflow-hidden">
      <div className="max-w-5xl mx-auto px-6">

        {/* Header */}
        <div className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-[0.2em]">
          <span className="border border-[color:var(--mustard)]/40 text-[color:var(--mustard)] px-3 py-1">SISTEMA OPERATIVO</span>
          <span className="border border-white/10 text-white/30 px-3 py-1">v1.0 · 7 MÓDULOS ACTIVOS</span>
        </div>

        <h2 className="font-stencil text-5xl md:text-6xl mb-4 leading-tight">
          Cuatro módulos.<br />Ocho agentes.
        </h2>
        <p className="text-base text-white/40 mb-16 max-w-xl font-mono">
          Cada agente es un proceso autónomo. Cada módulo cubre una función crítica del negocio. El sistema opera en paralelo, sin supervisión.
        </p>

        {/* Grid de módulos */}
        <div className="grid md:grid-cols-2 gap-px bg-white/10 border border-white/10">
          {modules.map((m) => (
            <div
              key={m.id}
              className={`p-6 ${m.highlight ? "bg-[#0d1117]" : "bg-[#0a0a0a]"}`}
            >
              {/* Module header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] font-mono tracking-[0.2em] text-white/30 mb-1">MÓDULO</div>
                  <div className={`font-stencil text-2xl ${m.highlight ? "text-[color:var(--mustard)]" : "text-white"}`}>
                    {m.label}
                  </div>
                </div>
                <div className="text-[10px] font-mono text-green-400 border border-green-400/30 px-2 py-1">
                  ● ACTIVO
                </div>
              </div>

              <p className="text-xs text-white/40 leading-relaxed mb-5">{m.desc}</p>

              {/* Agentes del módulo */}
              <div className="space-y-2">
                {m.agents.map((a) => (
                  <div key={a.name} className="flex items-center justify-between border border-white/8 px-3 py-2 bg-white/3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                      <span className="font-stencil text-sm text-white">{a.name}</span>
                      <span className="text-[10px] text-white/30 font-mono">{a.role}</span>
                    </div>
                    <div className="text-[9px] font-mono text-green-400">RUNNING</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer sistema */}
        <div className="mt-6 border border-white/10 px-5 py-3 flex flex-wrap gap-6 text-[10px] font-mono text-white/20 tracking-widest">
          <span>UPTIME: 99.98%</span>
          <span>·</span>
          <span>LATENCIA MEDIA: 8 SEG</span>
          <span>·</span>
          <span>TAREAS EJECUTADAS HOY: 847</span>
          <span>·</span>
          <span>INTERVENCIÓN HUMANA: 0</span>
        </div>
      </div>
    </section>
  );
}
