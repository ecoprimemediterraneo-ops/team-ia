const items = [
  {
    name: "Andrea M.",
    sector: "Estudio de fisioterapia · Valencia",
    text: "Carmen me coge las llamadas mientras estoy con pacientes. He pasado de perder citas a tener la agenda llena dos semanas por delante.",
  },
  {
    name: "Javier R.",
    sector: "Agencia inmobiliaria · Málaga",
    text: "Diego me ha conseguido más leads en un mes que el comercial que tenía contratado a media jornada. Y no se queja los lunes.",
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
    text: "Pensé que era marketing. Es una pasada. La tropa funciona mientras yo cierro la clínica.",
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
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">INFORMES DE CAMPO</span>
        </div>
        <h2 className="font-display text-5xl md:text-7xl mb-12">
          Lo que dicen<br />los del frente
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((t) => (
            <article key={t.name} className="card-hard p-6">
              <div className="text-3xl mb-3">★★★★★</div>
              <p className="leading-relaxed mb-5">«{t.text}»</p>
              <div className="border-t-2 border-black pt-3">
                <div className="font-display text-xl">{t.name}</div>
                <div className="text-xs uppercase tracking-wider text-black/60">{t.sector}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
