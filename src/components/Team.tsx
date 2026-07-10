// "Tu equipo": los 4 agentes que protagonizan la home (WhatsApp, Llamadas, Instagram, Agenda).
// Cada tarjeta usa el avatar y el nombre reales del agente (src/lib/agents.ts) y el canal +
// beneficio editorial (src/lib/oferta.ts). El resto de funciones (reseñas, email, competencia)
// NO se muestran aquí a propósito: la home lidera simple; se ven en /precios y /agentes.
import { CANALES_NUCLEO } from "@/lib/oferta";
import { agentBySlug } from "@/lib/agents";

export default function Team() {
  return (
    <section id="como-funciona" className="py-16 md:py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
      <div className="max-w-5xl mx-auto px-5">
        <div className="flex items-center gap-2 mb-6 text-[10px] font-mono tracking-[0.2em] flex-wrap">
          <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">TU EQUIPO</span>
        </div>
        <h2 className="font-stencil text-4xl md:text-6xl mb-4 leading-tight">
          Cuatro agentes.<br />Un solo panel.
        </h2>
        <p className="text-base max-w-2xl mb-10 text-black/60">
          Cada uno se encarga de un canal y trabajan juntos con tus reglas. Tú decides qué hacen
          solos y qué te pasan a aprobar.
        </p>

        <div className="grid sm:grid-cols-2 gap-5">
          {CANALES_NUCLEO.map((c) => {
            const a = agentBySlug[c.slug];
            return (
              <article key={c.slug} className="card-hard bg-white p-5 flex gap-4 items-start">
                <div className="w-20 h-20 shrink-0 border-[3px] border-black overflow-hidden bg-[color:var(--cream)]">
                  <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-stencil text-2xl leading-none">{a.name}</h3>
                    <span className="text-[10px] font-bold tracking-widest bg-black text-[color:var(--mustard)] px-2 py-0.5">
                      {c.canal.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-black/70 leading-snug">{c.beneficio}</p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <a
            href="/agentes"
            className="btn-mustard text-sm px-8 py-3 inline-block bg-black text-[color:var(--mustard)] border-black hover:bg-transparent hover:text-black"
          >
            Conocer a todo el equipo →
          </a>
        </div>
      </div>
    </section>
  );
}
