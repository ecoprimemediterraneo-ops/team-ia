/**
 * Microejemplos reales de "esto ya funciona" — sin fake testimonials.
 * Líneas cortas, escaneables, generan sensación de producto real.
 */
const lines = [
  "Pablo ya responde preguntas de precio y disponibilidad.",
  "Marta deja publicaciones listas para revisar.",
  "Lucía separa correos importantes automáticamente.",
  "Carmen recoge llamadas y avisa por WhatsApp.",
  "Rocío prepara respuestas para tus reseñas.",
  "Diana detecta dónde se te escapan clientes.",
];

export default function AlreadyWorks() {
  return (
    <section className="bg-black text-white border-y-[3px] border-black py-10 md:py-12">
      <div className="max-w-5xl mx-auto px-5">
        <div className="text-center mb-6">
          <span className="inline-block bg-[color:var(--mustard)] text-black px-3 py-1 text-xs font-mono font-bold tracking-[0.25em]">
            ESTO YA FUNCIONA
          </span>
        </div>
        <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 max-w-3xl mx-auto text-sm md:text-base">
          {lines.map((l) => (
            <li key={l} className="flex items-start gap-2">
              <span className="text-[color:var(--mustard)] font-bold mt-0.5">▸</span>
              <span className="text-white/85">{l}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
