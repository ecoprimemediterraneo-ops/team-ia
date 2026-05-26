/**
 * Fila simple de "qué hace exactamente" justo debajo del hero.
 * Sin animaciones. Sin texto largo. Solo verbo + sustantivo.
 */
const actions = [
  "Responde WhatsApps",
  "Recuerda citas",
  "Publica Instagram",
  "Coge llamadas",
  "Sigue clientes",
  "Ordena emails",
];

export default function QuickActions() {
  return (
    <section className="bg-[color:var(--cream)] border-b-[3px] border-black py-6">
      <div className="max-w-5xl mx-auto px-5">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm md:text-base font-sans">
          {actions.map((a) => (
            <span key={a} className="flex items-center gap-2">
              <span className="text-[color:var(--red)] font-bold">✓</span>
              <span className="text-black/80">{a}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
