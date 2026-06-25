// "Cómo funciona y qué incluye" (fusionado): tres módulos + las funciones
// agrupadas por disponibilidad (Disponible ahora / Requiere aprobación /
// En activación por fases). Sin personajes ni caras. Compacto.
const modules = [
  { label: "Ventas", desc: "Capta leads, responde y cierra citas.", canales: "WhatsApp 24/7 · Llamadas" },
  { label: "Soporte", desc: "Reseñas, correo y atención al cliente.", canales: "Reseñas de Google · Correo y agenda" },
  { label: "Operaciones", desc: "Contenido, campañas y secuencias.", canales: "Instagram y redes · Email marketing" },
];

const estados = [
  {
    titulo: "Disponible ahora",
    bg: "bg-[color:var(--mustard)]",
    items: "Email marketing · Correo y agenda (Gmail) · respuesta por WhatsApp",
  },
  {
    titulo: "Requiere aprobación",
    bg: "bg-white border-2 border-[color:var(--red)]",
    items: "Reseñas de Google · Instagram y redes · llamadas de voz (según plataforma)",
  },
  {
    titulo: "En activación por fases",
    bg: "bg-black text-[color:var(--cream)]",
    items: "Capa proactiva: avisos, sugerencias y acciones automáticas",
  },
];

export default function Team() {
  return (
    <section id="como-funciona" className="py-16 md:py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-2 mb-6 text-[10px] font-mono tracking-[0.2em] flex-wrap">
          <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">CÓMO FUNCIONA · QUÉ INCLUYE</span>
        </div>
        <h2 className="font-stencil text-4xl md:text-6xl mb-4 leading-tight">
          No son herramientas sueltas.<br />Es un sistema.
        </h2>
        <p className="text-base max-w-2xl mb-8 text-black/60">
          Un solo sistema cubre tu negocio de punta a punta: tú defines las reglas y aprobaciones, el
          sistema ejecuta.
        </p>

        {/* Tres módulos (lista compacta) */}
        <div className="border-2 border-black divide-y-2 divide-black mb-8 bg-white">
          {modules.map((m) => (
            <div key={m.label} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <span className="font-stencil text-xl leading-none">{m.label}</span>
                <p className="text-xs text-black/55 leading-snug mt-0.5">{m.desc}</p>
              </div>
              <span className="text-[11px] font-bold text-right shrink-0 max-w-[42%] leading-snug">{m.canales}</span>
            </div>
          ))}
        </div>

        {/* Qué incluye, por disponibilidad */}
        <div className="grid sm:grid-cols-3 gap-3">
          {estados.map((e) => (
            <div key={e.titulo} className={`card-hard p-4 ${e.bg}`}>
              <div className="font-stencil text-lg leading-tight mb-1">{e.titulo}</div>
              <p className="text-xs leading-snug opacity-90">{e.items}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
