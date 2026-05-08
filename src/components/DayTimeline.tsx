import { agents } from "@/lib/agents";

const avatarOf = (name: string) => agents.find((a) => a.name === name);

const moments = [
  {
    time: "07:00",
    name: "Lucía",
    emoji: "📬",
    title: "Tu bandeja ya está ordenada",
    text: "Abres el correo esperando la avalancha. Está limpio. Lucía ha filtrado el ruido, ha marcado lo importante y te ha dejado borradores listos con tu tono.",
  },
  {
    time: "09:30",
    name: "Pablo",
    emoji: "💬",
    title: "Pablo cierra una cita por WhatsApp",
    text: "Te llega un mensaje al móvil: 'Cita confirmada — Carmen López, jueves 18:00. Le he confirmado precios y enviado ubicación.' Tú no has tocado el WhatsApp.",
  },
  {
    time: "11:00",
    name: "Marta",
    emoji: "📱",
    title: "No has publicado, pero Marta sí",
    text: "Sale un carrusel en Instagram: «5 errores que cometen los autónomos al fichar a su primer empleado». Lo programó hace una hora. La semana siguiente ya está en cola.",
  },
  {
    time: "13:30",
    name: "Eva",
    emoji: "✉️",
    title: "Eva manda la newsletter del lunes",
    text: "180 clientes reciben tu correo de la semana con un consejo y una promo. 12 abren en la primera media hora. 3 reservan cita esa misma tarde.",
  },
  {
    time: "17:30",
    name: "Carmen",
    emoji: "📞",
    title: "Carmen contesta una llamada en directo",
    text: "Suena el teléfono mientras conduces. Carmen lo coge al segundo tono. Conoce tus servicios y tus precios de memoria. Agenda visita y te manda el resumen al móvil.",
  },
  {
    time: "20:00",
    name: "Rocío",
    emoji: "⭐",
    title: "Rocío pide reseñas y sube tu Google",
    text: "Después de cada cita del día, manda un WhatsApp pidiendo reseña. Llegan 4 nuevas. Rocío contesta a cada una con tu tono. Subes a 4,8★.",
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
          Un día<br />en misión
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
