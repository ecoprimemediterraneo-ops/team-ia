// Ejemplo ilustrativo del sistema EN ACCIÓN, justo tras el hero.
// Texto, claramente etiquetado "Ejemplo ilustrativo" (no es un caso real).
// Marca/estilo intactos.

const mensajes = [
  { de: "cliente", texto: "Hola, ¿tenéis hueco esta semana para una revisión?" },
  { de: "sistema", texto: "¡Claro! Tengo martes 17:30 o jueves 10:00. ¿Cuál te viene mejor?" },
  { de: "cliente", texto: "El jueves a las 10." },
  { de: "sistema", texto: "Reservado ✅ Te mando recordatorio el día antes. ¡Nos vemos!" },
  { de: "sistema", texto: "📅 Cita registrada en tu agenda: jueves 10:00." },
];

export default function EjemploHome() {
  return (
    <section id="ejemplo" className="py-16 md:py-20 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-5xl mx-auto px-5">
        <div className="flex items-center gap-3 mb-6 text-xs font-mono flex-wrap">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">ASÍ FUNCIONA</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">EJEMPLO ILUSTRATIVO</span>
        </div>

        <div className="grid md:grid-cols-[1.1fr_1fr] gap-6 items-center">
          {/* Chat de ejemplo */}
          <div className="card-hard bg-white p-5">
            <div className="flex items-center gap-2 border-b-2 border-black/10 pb-3 mb-4">
              <span className="text-xl" aria-hidden>💬</span>
              <span className="font-stencil text-lg">WhatsApp · atendido por el sistema</span>
            </div>
            <div className="space-y-2.5">
              {mensajes.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] px-3 py-2 text-sm leading-snug border-2 border-black ${
                    m.de === "sistema"
                      ? "ml-auto bg-[color:var(--mustard)] text-black"
                      : "mr-auto bg-[color:var(--cream)] text-black"
                  }`}
                >
                  {m.texto}
                </div>
              ))}
            </div>
          </div>

          {/* Texto */}
          <div>
            <h2 className="font-stencil text-4xl md:text-5xl leading-tight mb-4">
              Contesta, propone y agenda.<br /><span className="text-[color:var(--red)]">Con las reglas que tú definas.</span>
            </h2>
            <p className="text-base text-black/70 leading-relaxed">
              El mismo sistema que atiende WhatsApp coge las llamadas, pide reseñas, prepara tu agenda
              y centraliza tus canales. Todo conectado, con las reglas y aprobaciones que tú definas.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
