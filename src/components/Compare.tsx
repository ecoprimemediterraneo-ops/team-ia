const rows = [
  ["Gestiona tu correo y calendario", true, false],
  ["Publica en redes sociales cada semana", true, "A medias"],
  ["Genera leads y hace cold outreach", true, false],
  ["Contesta llamadas en español 24/7", true, false],
  ["Toma notas en tus reuniones", true, false],
  ["Coste mensual", "29 €", "+2.000 €"],
  ["Necesita vacaciones", false, true],
];

export default function Compare() {
  return (
    <section className="py-24 border-t-[3px] border-black bg-white">
      <div className="max-w-5xl mx-auto px-5">
        <h2 className="font-display text-5xl md:text-7xl text-center mb-4">
          Tropa vs<br />hacerlo solo
        </h2>
        <p className="text-center text-black/70 mb-12">Misma tarea. Resultados muy distintos.</p>

        <div className="card-hard overflow-hidden">
          <div className="grid grid-cols-3 font-display text-lg md:text-2xl bg-black text-[color:var(--cream)]">
            <div className="p-4 md:p-6">Tarea</div>
            <div className="p-4 md:p-6 text-center bg-[color:var(--mustard)] text-black">Tropa</div>
            <div className="p-4 md:p-6 text-center">Tú solo</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className={`grid grid-cols-3 ${i % 2 ? "bg-[color:var(--cream)]" : "bg-white"} border-t-2 border-black`}
            >
              <div className="p-4 md:p-5 font-semibold">{r[0]}</div>
              <Cell value={r[1]} highlight />
              <Cell value={r[2]} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cell({ value, highlight = false }: { value: unknown; highlight?: boolean }) {
  let content: React.ReactNode;
  if (value === true) content = <span className="text-2xl">✅</span>;
  else if (value === false) content = <span className="text-2xl">❌</span>;
  else content = <span className="font-bold">{String(value)}</span>;
  return <div className={`p-4 md:p-5 text-center ${highlight ? "bg-[color:var(--mustard)]/30" : ""}`}>{content}</div>;
}
