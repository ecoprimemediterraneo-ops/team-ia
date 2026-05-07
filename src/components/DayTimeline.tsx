import { agents } from "@/lib/agents";

const codenames: Record<string, string> = {
  Lucía: "ALFA-01",
  Marta: "BRAVO-02",
  Diego: "CHARLIE-03",
  Carmen: "DELTA-04",
};

const avatarOf = (name: string) => agents.find((a) => a.name === name);

const moments = [
  {
    time: "07:00",
    name: "Lucía",
    emoji: "📬",
    title: "Tu bandeja ya está ordenada",
    text: "Abres el correo esperando la avalancha. Está limpio. Lucía ha filtrado el ruido, ha marcado lo importante y te ha dejado borradores listos con tu tono. Solo tienes que decir sí.",
  },
  {
    time: "11:00",
    name: "Marta",
    emoji: "📱",
    title: "No has publicado, pero Marta sí",
    text: "Mientras estás en una reunión, sale en Instagram un carrusel nuevo. «5 errores que cometen los autónomos al fichar a su primer empleado». Lo programó hace una hora. La semana siguiente ya está en cola.",
  },
  {
    time: "14:00",
    name: "Diego",
    emoji: "🎯",
    title: "Diego te llena el pipeline",
    text: "Comes fuera. Diego trabaja. Encuentra prospectos, manda 60 correos personalizados y hace seguimiento. Vuelves al despacho y tienes tres respuestas calientes esperando.",
  },
  {
    time: "17:30",
    name: "Carmen",
    emoji: "📞",
    title: "Carmen contesta en español e inglés",
    text: "Suena el teléfono mientras conduces. Carmen lo coge al segundo tono. Conoce tu horario, tus servicios y tus precios. Agenda una visita para el jueves y te manda el resumen al móvil.",
  },
  {
    time: "21:00",
    name: "Lucía",
    emoji: "📝",
    title: "Notas de la reunión, ya escritas",
    text: "Cierras el portátil después de cenar. En el grupo aparecen las notas de la reunión de las 18:00: acuerdos, responsables y próximos pasos. Lucía estuvo escuchando.",
  },
  {
    time: "23:00",
    name: "Marta",
    emoji: "🌙",
    title: "El día acabó, tu marca no",
    text: "Te vas a dormir. Tu cuenta de LinkedIn comenta posts del sector, agradece menciones y publica un thread programado a las 8:15 para pillar el café de la mañana.",
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
              const code = codenames[m.name] ?? "X-00";
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
                      {/* Cabecera tipo informe de campo */}
                      <header className="bg-[color:var(--olive)] text-white border-b-[3px] border-black px-4 py-2 flex items-center justify-between text-[11px] font-mono uppercase tracking-widest">
                        <span>Informe #{reportNum}</span>
                        <span className="hidden sm:inline">· CONFIDENCIAL ·</span>
                        <span>{m.time}H</span>
                      </header>

                      <div className="p-6 relative">
                        <h3 className="font-stencil text-2xl md:text-3xl mb-3 pr-20">{m.title}</h3>
                        <p className="text-sm md:text-base leading-relaxed font-mono text-black/85">{m.text}</p>

                        {/* Sello rojo abajo a la derecha */}
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
