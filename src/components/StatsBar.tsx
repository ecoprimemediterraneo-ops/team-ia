const stats = [
  { value: "< 10 seg", label: "Respuesta media por canal" },
  { value: "0", label: "Contactos sin atender" },
  { value: "−73%", label: "Reducción de carga operativa" },
  { value: "24/7", label: "Disponibilidad garantizada" },
];

export default function StatsBar() {
  return (
    <div className="border-t-[3px] border-b-[3px] border-black bg-black">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
          {stats.map((s) => (
            <div key={s.label} className="py-6 px-4 md:px-6 text-center">
              <div className="font-stencil text-3xl md:text-4xl text-[color:var(--mustard)] mb-1">{s.value}</div>
              <div className="text-[10px] font-mono text-white/40 tracking-widest uppercase leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
