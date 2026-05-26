const items = [
  {
    name: "Andrea M.",
    sector: "Estudio de fisioterapia · Valencia",
    text: "Carmen me coge las llamadas mientras estoy con pacientes. He pasado de perder citas a tener la agenda llena dos semanas por delante.",
  },
  {
    name: "Javier R.",
    sector: "Agencia inmobiliaria · Málaga",
    text: "Pablo me contesta los WhatsApps de noche y los fines de semana. He cerrado 3 visitas que antes se me caían por no responder a tiempo.",
  },
  {
    name: "Sofía L.",
    sector: "E-commerce de cosmética · CDMX",
    text: "Marta publica en Instagram y TikTok mejor que yo. Mis ventas por redes han subido un 38% en seis semanas.",
  },
  {
    name: "Carlos B.",
    sector: "Consultor freelance · Madrid",
    text: "Lucía me organiza el correo y me prepara los borradores. He recuperado la mañana. Literal.",
  },
  {
    name: "Patricia G.",
    sector: "Clínica dental · Bogotá",
    text: "Pensé que era marketing. Es una pasada. La tropa funciona mientras yo cierro el negocio.",
  },
  {
    name: "Néstor V.",
    sector: "Coach de negocio · Barcelona",
    text: "Estaba al borde del burnout. Hoy tengo cuatro empleados que no me piden vacaciones. Me cambia la vida.",
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-[0.2em]">
          <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">INFORMES DE CAMPO</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-6xl mb-16 leading-tight">
          Resultados reales
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-black border-[3px] border-black">
          {items.map((t) => (
            <article key={t.name} className="p-6 bg-[color:var(--cream)]">
              <div className="text-xs text-black/30 tracking-widest font-mono mb-4">★★★★★</div>
              <p className="text-sm leading-relaxed text-black/80 mb-6">"{t.text}"</p>
              <div className="border-t border-black/10 pt-4">
                <div className="font-semibold text-sm">{t.name}</div>
                <div className="text-[11px] uppercase tracking-wider text-black/40 mt-0.5">{t.sector}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
