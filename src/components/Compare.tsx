const rows: [string, true | false | string, true | false | string][] = [
  ["Contesta WhatsApp 24/7", true, false],
  ["Pide reseñas a clientes y responde", true, false],
  ["Manda newsletters y secuencias de bienvenida", true, "A medias"],
  ["Publica en redes sociales", true, "A medias"],
  ["Contesta llamadas en español", true, false],
  ["Gestiona correo y calendario", true, false],
  ["Monitoriza competidores 24/7 (Sergio)", true, false],
  ["Alerta si un competidor cambia precios", true, false],
  ["Disponible a las 3 de la madrugada", true, false],
  ["Aprende y mejora con cada corrección", true, false],
  ["Necesita vacaciones o bajas", false, true],
  ["Coste mensual (plan Pro completo)", "299 €", "+3.500 €"],
];

export default function Compare() {
  return (
    <section className="py-24 border-t-[3px] border-black bg-white">
      <div className="max-w-5xl mx-auto px-5">
        <h2 className="font-stencil text-5xl md:text-7xl text-center mb-4">
          AI-Team vs<br />contratar gente
        </h2>
        <p className="text-center text-black/70 mb-12">Mismas tareas. Sin nóminas, sin bajas, sin lunes flojos.</p>

        <div className="card-hard overflow-hidden">
          <div className="grid grid-cols-3 font-display text-lg md:text-2xl bg-black text-[color:var(--cream)]">
            <div className="p-4 md:p-6">Tarea</div>
            <div className="p-4 md:p-6 text-center bg-[color:var(--mustard)] text-black">AI-Team</div>
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
