import { agents } from "@/lib/agents";

const avatarOf = (name: string) => agents.find((a) => a.name === name);

const moments = [
  {
    time: "07:00",
    name: "Lucía",
    emoji: "📬",
    title: "Bandeja procesada antes de que abras el negocio",
    text: "Lucía ha clasificado 47 correos, marcado 3 como urgentes y generado borradores de respuesta con tu tono. Abres el correo para aprobar, no para gestionar.",
  },
  {
    time: "09:30",
    name: "Pablo",
    emoji: "💬",
    title: "Cita cerrada sin intervención",
    text: "Notificación en el móvil: «Cita confirmada — Carmen López, jueves 18:00. Precios enviados. Ubicación confirmada.» El cliente llevaba esperando desde las 23:12 del día anterior.",
  },
  {
    time: "11:00",
    name: "Marta",
    emoji: "📱",
    title: "Contenido publicado. Pipeline de la semana en cola.",
    text: "Marta ha publicado un carrusel en Instagram y tiene los tres posts de la semana programados. La presencia en redes no depende de tu disponibilidad.",
  },
  {
    time: "13:30",
    name: "Eva",
    emoji: "✉️",
    title: "Newsletter enviada a 180 contactos",
    text: "Tasa de apertura del 34%. 3 reservas directas en las primeras dos horas. La secuencia de nurturing sigue activa para los que no abrieron.",
  },
  {
    time: "17:30",
    name: "Carmen",
    emoji: "📞",
    title: "Llamada atendida al segundo tono",
    text: "Carmen tiene cargado el catálogo completo de servicios y precios. Agenda la visita, genera el resumen y te lo envía. Sin desvíos, sin llamadas perdidas.",
  },
  {
    time: "20:00",
    name: "Rocío",
    emoji: "⭐",
    title: "4 reseñas nuevas. Valoración media: 4.9★",
    text: "Rocío ha enviado solicitudes de reseña tras cada cita del día y ha respondido las nuevas con el tono de tu negocio. Tu posición en Google mejora sin gestión manual.",
  },
];

export default function DayTimeline() {
  return (
    <section
      id="dia"
      className="py-24 border-t-[3px] border-black bg-[color:var(--mustard)]"
    >
      <div className="max-w-5xl mx-auto px-5">
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono mb-6">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">DIARIO DE OPERACIONES</span>
          <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] bg-white px-2 py-1 font-bold tracking-widest">24H · TURNO COMPLETO</span>
        </div>
        <h2 className="font-stencil text-5xl md:text-7xl mb-16 leading-[1]">
          El sistema<br />en operación
        </h2>

        <div className="relative">
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-1 bg-black -translate-x-1/2" />
          <div className="flex flex-col gap-12">
            {moments.map((m, i) => {
              const agent = avatarOf(m.name);
              const code = agent?.codename ?? "X-00";
              const reportNum = String(i + 1).padStart(2, "0");
              return (
                <div
                  key={i}
                  className={`relative md:grid md:grid-cols-2 md:gap-12 ${
                    i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <div className={`pl-16 md:pl-0 ${i % 2 === 1 ? "md:text-left" : "md:text-right"}`}>
                    <div className="font-stencil text-5xl md:text-6xl">{m.time}H</div>
                    <div className={`flex items-center gap-2 mt-2 ${i % 2 === 1 ? "md:justify-start" : "md:justify-end"}`}>
                      {agent && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={agent.avatar}
                          alt={m.name}
                          className="w-10 h-10 border-[3px] border-black"
                          style={{ background: agent.color }}
                        />
                      )}
                      <span className="text-xs font-mono font-bold uppercase tracking-widest bg-black text-[color:var(--mustard)] px-2 py-1">
                        {code} · {m.name.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="pl-16 md:pl-0 mt-3 md:mt-0">
                    <article
                      className="card-hard relative overflow-hidden"
                      style={{ transform: i % 2 === 1 ? "rotate(-1deg)" : "rotate(1deg)" }}
                    >
                      <header className="bg-[color:var(--olive)] text-white border-b-[3px] border-black px-4 py-2 flex items-center justify-between text-[11px] font-mono uppercase tracking-widest">
                        <span>Informe #{reportNum}</span>
                        <span className="hidden sm:inline">· CONFIDENCIAL ·</span>
                        <span>{m.time}H</span>
                      </header>
                      <div className="p-6 relative">
                        <h3 className="font-stencil text-2xl md:text-3xl mb-3 pr-20">{m.title}</h3>
                        <p className="text-sm md:text-base leading-relaxed font-mono text-black/85">{m.text}</p>
                        <div className="absolute bottom-3 right-3 stamp text-[10px]" style={{ transform: "rotate(8deg)" }}>
                          Misión cumplida
                        </div>
                      </div>
                    </article>
                  </div>

                  <div className="absolute left-6 md:left-1/2 top-3 -translate-x-1/2 w-6 h-6 rounded-full bg-[color:var(--red)] border-[3px] border-black" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
