// "Cómo funciona": lo que hace cada canal, en lenguaje llano. Una línea por canal,
// sin nombres de personajes. Compacto.
const canales = [
  { icon: "💬", label: "WhatsApp", desc: "Contesta a tus clientes y les da cita." },
  { icon: "📞", label: "Llamadas", desc: "Atiende el teléfono y reserva citas, aunque estés ocupado." },
  { icon: "📱", label: "Instagram", desc: "Responde los mensajes directos y publica tus posts." },
  { icon: "✉️", label: "Email", desc: "Gestiona los correos de tus clientes." },
  { icon: "⭐", label: "Reseñas de Google", desc: "Pide reseñas a tus clientes y sube tu reputación." },
  { icon: "📅", label: "Agenda", desc: "Todas las citas juntas en un sitio, sin dobles reservas." },
];

export default function Team() {
  return (
    <section id="como-funciona" className="py-16 md:py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-4xl mx-auto px-5">
        <div className="flex items-center gap-2 mb-6 text-[10px] font-mono tracking-[0.2em] flex-wrap">
          <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">CÓMO FUNCIONA</span>
        </div>
        <h2 className="font-stencil text-4xl md:text-6xl mb-4 leading-tight">
          No son herramientas sueltas.<br />Es un sistema.
        </h2>
        <p className="text-base max-w-2xl mb-8 text-black/60">
          Un solo sistema atiende a tus clientes por todos los canales. Tú pones las reglas.
        </p>

        {/* Qué hace cada canal — una línea */}
        <div className="border-2 border-black divide-y-2 divide-black bg-white">
          {canales.map((c) => (
            <div key={c.label} className="flex items-start gap-4 p-4">
              <span className="text-2xl leading-none shrink-0" aria-hidden>{c.icon}</span>
              <div className="min-w-0">
                <span className="font-stencil text-xl leading-none">{c.label}</span>
                <p className="text-sm text-black/65 leading-snug mt-0.5">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
