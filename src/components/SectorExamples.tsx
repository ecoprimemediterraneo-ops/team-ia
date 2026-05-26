/**
 * Sección "¿Qué haría AI-Team en tu negocio?" con 4 ejemplos por sector.
 * Va justo antes de Packs.
 */
const examples = [
  {
    sector: "Clínica",
    icon: "🩺",
    text: "Mientras estás en consulta, Pablo responde primeras visitas.",
  },
  {
    sector: "Peluquería",
    icon: "💇",
    text: "Si cancelan una cita, intentamos rellenar el hueco.",
  },
  {
    sector: "Restaurante",
    icon: "🍽️",
    text: "Aunque estés en pleno servicio, las reservas siguen entrando.",
  },
  {
    sector: "Fisio",
    icon: "💪",
    text: "Los pacientes reciben seguimiento sin perseguir mensajes.",
  },
];

export default function SectorExamples() {
  return (
    <section className="py-12 md:py-20 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-6xl mx-auto px-5">
        <h2 className="font-stencil text-3xl md:text-6xl mb-2 md:mb-3 text-center">
          ¿Qué haría AI-Team<br />en tu negocio?
        </h2>
        <p className="text-center text-xs md:text-sm text-black/60 mb-6 md:mb-12 font-mono uppercase tracking-widest">
          Ejemplos reales por sector
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {examples.map((e) => (
            <article key={e.sector} className="card-hard p-4 md:p-6 bg-white flex flex-col">
              <div className="text-3xl md:text-4xl mb-2 md:mb-3">{e.icon}</div>
              <div className="font-stencil text-xl md:text-2xl mb-2 md:mb-3">{e.sector}</div>
              <p className="text-sm text-black/75 leading-snug">{e.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
