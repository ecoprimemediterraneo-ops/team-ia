// "3 resultados principales" — qué hace el sistema por el negocio.
// Compacto, sin métricas inventadas. Marca/estilo intactos.

const resultados = [
  {
    icon: "📲",
    titulo: "Responde y agenda",
    desc: "Contesta WhatsApp y llamadas, propone hueco y deja la cita en tu agenda. Disponible fuera de tu horario.",
  },
  {
    icon: "🔁",
    titulo: "Recupera oportunidades sin atender",
    desc: "Detecta mensajes sin responder y clientes que no vuelven, y reactiva el contacto según tus reglas.",
  },
  {
    icon: "🗂️",
    titulo: "Centraliza canales y tareas",
    desc: "Reúne WhatsApp, llamadas, reseñas, correo, agenda y redes en un solo sitio, no en apps sueltas.",
  },
];

export default function Resultados() {
  return (
    <section id="resultados" className="py-16 md:py-20 border-t-[3px] border-black bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-2 mb-6 text-[10px] font-mono tracking-[0.2em]">
          <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">QUÉ HACE POR TI</span>
        </div>
        <h2 className="font-stencil text-4xl md:text-6xl leading-tight mb-6">
          Menos tareas. Más clientes.
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {resultados.map((r) => (
            <article key={r.titulo} className="card-hard bg-[color:var(--cream)] p-5 flex flex-col">
              <div className="w-12 h-12 border-[3px] border-black bg-[color:var(--mustard)] flex items-center justify-center text-xl mb-3" aria-hidden>
                {r.icon}
              </div>
              <h3 className="font-stencil text-2xl leading-tight mb-2">{r.titulo}</h3>
              <p className="text-sm text-black/70 leading-relaxed">{r.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
