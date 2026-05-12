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
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-[0.2em]">
          <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">ANÁLISIS COMPARATIVO</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-6xl mb-4 leading-tight">
          AI-Team vs<br />equipo interno
        </h2>
        <p className="text-base text-black/40 mb-12 font-mono">Misma capacidad operativa. Fracción del coste. Sin gestión de personas.</p>

        <div className="border-[3px] border-black overflow-hidden">
          <div className="grid grid-cols-3 text-xs font-mono tracking-widest bg-black text-white">
            <div className="p-4 md:p-5">TAREA</div>
            <div className="p-4 md:p-5 text-center bg-[color:var(--mustard)] text-black">AI-TEAM</div>
            <div className="p-4 md:p-5 text-center text-white/50">EMPLEADO</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className={`grid grid-cols-3 border-t border-black/10 ${i % 2 ? "bg-white" : "bg-[color:var(--cream)]/40"}`}
            >
              <div className="p-4 md:p-5 text-sm font-medium">{r[0]}</div>
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
  if (value === true) content = <span className="text-lg">✓</span>;
  else if (value === false) content = <span className="text-lg text-black/20">✕</span>;
  else content = <span className="font-bold text-sm">{String(value)}</span>;
  return <div className={`p-4 md:p-5 text-center ${highlight ? "bg-[color:var(--mustard)]/20" : ""}`}>{content}</div>;
}
