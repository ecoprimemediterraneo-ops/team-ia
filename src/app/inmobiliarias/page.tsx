import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VerticalCTA from "@/components/dental/VerticalCTA";

export const metadata = {
  title: "AI-Team para Inmobiliarias — el sistema operativo que no deja escapar un lead",
  description:
    "Un único sistema integrado para tu inmobiliaria. Responde los leads de Idealista y Fotocasa al instante 24/7, cualifica al interesado, agenda la visita y reactiva leads dormidos. Para inmobiliarias y agentes de 1-50 personas.",
};

const inmoPains = [
  { stat: "23 horas", text: "es el tiempo medio de respuesta del sector. Para entonces, el interesado ya está visitando con otra agencia.", icon: "⏱️" },
  { stat: "5 minutos", text: "responder en menos capta hasta un 40% más de interesados. Casi ninguna agencia llega a tiempo.", icon: "⚡" },
  { stat: "78%", text: "de los compradores cierran con la PRIMERA agencia que les responde. Al segundo ni lo miran.", icon: "🥇" },
  { stat: "Noches y findes", text: "los leads de Idealista y Fotocasa entran a cualquier hora. Si nadie contesta, se van a otra.", icon: "🌙" },
  { stat: "Curiosos", text: "horas filtrando a mano a quien no va a comprar, en vez de visitar y cerrar.", icon: "🔍" },
  { stat: "Visitas", text: "interesados que no aparecen a la visita sin avisar y te dejan el hueco muerto.", icon: "🏠" },
];

const inmoFunciones: { emoji: string; funcion: string; titulo: string; bullets: string[] }[] = [
  {
    emoji: "💬",
    funcion: "WhatsApp",
    titulo: "El sistema responde y cualifica cada consulta de un inmueble",
    bullets: [
      "Un lead de Idealista a las 23h → responde al instante con los datos del inmueble",
      "Cualifica al interesado: presupuesto, zona, tipo de inmueble y si compra o alquila",
      "Agenda la visita directo en tu calendario. 24/7, también noches y fines de semana",
    ],
  },
  {
    emoji: "📅",
    funcion: "Agenda de visitas",
    titulo: "El sistema gestiona el calendario de visitas",
    bullets: [
      "Cuadra las visitas en tu agenda sin solapamientos",
      "Manda recordatorios automáticos para reducir las ausencias",
      "Reorganiza si alguien cancela y te avisa de los huecos libres",
    ],
  },
  {
    emoji: "✉️",
    funcion: "Email marketing",
    titulo: "El sistema reactiva a los interesados que se enfriaron",
    bullets: [
      "Hace seguimiento de los interesados que no llegaron a responder",
      "Reactiva los leads dormidos a los 7, 30 y 60 días",
      "Les manda inmuebles nuevos que encajan con lo que buscaban",
    ],
  },
  {
    emoji: "📱",
    funcion: "Instagram y redes",
    titulo: "El sistema publica tus inmuebles en redes",
    bullets: [
      "Sube los inmuebles a Instagram automáticamente",
      "Reels de tours por la vivienda y novedades de cartera",
      "Genera el copy con tu voz y elige las mejores horas para publicar",
    ],
  },
];

const inmoDay = [
  { hora: "08:30", funcion: "Email marketing", text: "El sistema te pasa el resumen del día y reactiva 3 leads dormidos con pisos nuevos que encajan con lo que buscaban." },
  { hora: "11:00", funcion: "WhatsApp", text: "Contesta una consulta sobre un piso, cualifica al interesado (presupuesto, zona, compra/alquila) y agenda la visita para el jueves." },
  { hora: "13:30", funcion: "Agenda de visitas", text: "Manda los recordatorios de las visitas de mañana para que no se caiga ninguna por un despiste." },
  { hora: "18:00", funcion: "Instagram y redes", text: "Publica solo el Reel del tour del ático nuevo de cartera. Tú no has tenido que tocar nada." },
  { hora: "21:30", funcion: "WhatsApp", text: "Entra un lead de Idealista mientras cenas. Responde al instante, lo cualifica y le ofrece hueco de visita." },
  { hora: "23:45", funcion: "WhatsApp", text: "De madrugada, contesta y filtra a los curiosos mientras la competencia duerme. Por la mañana tienes solo a los que valen." },
];

const inmoPacks = [
  {
    name: "Sistema Operativo",
    priceFounder: "149",
    priceRegular: "299",
    tagline: "Un único sistema integrado para tu inmobiliaria. Todo conectado, no herramientas sueltas.",
    funciones: [
      "WhatsApp 24/7 que cualifica y agenda visitas",
      "Agenda de visitas con recordatorios",
      "Reactivación de leads dormidos por email",
      "Inmuebles publicados en Instagram solos",
      "Todo conectado en un único sistema",
    ],
    cta: "Pide tu demo",
    featured: true,
  },
  {
    name: "Gestión (opcional)",
    priceFounder: "+799",
    priceRegular: null,
    tagline: "Si no quieres ni revisarlo: lo gestionamos por ti. Se suma al Sistema Operativo.",
    funciones: [
      "Supervisión humana del sistema completo",
      "Puesta a punto y ajustes continuos",
      "Reporte mensual de leads y visitas",
      "Soporte prioritario",
    ],
    cta: "Pide tu demo",
    featured: false,
  },
];

const inmoFAQ = [
  {
    q: "¿Se conecta con Idealista y Fotocasa?",
    a: "El sistema vive al lado de los portales, no dentro. Cuando un interesado te escribe (por WhatsApp, email o desde el portal), el sistema lo recoge, lo cualifica y agenda la visita; tu equipo sigue llevando el inmueble en el CRM de siempre. La integración nativa con los principales portales y CRM está en nuestro roadmap.",
  },
  {
    q: "¿Cualifica de verdad (presupuesto, zona, compra o alquiler)?",
    a: "Sí. El sistema pregunta presupuesto, zona, tipo de inmueble y si busca comprar o alquilar, y lo guarda en la ficha del lead. Así tu agente llega a la visita sabiendo exactamente con quién habla, sin perder tiempo en filtrar.",
  },
  {
    q: "¿Esto sustituye a mis comerciales?",
    a: "No, y es a propósito. La IA no sustituye al agente: le quita las tareas mecánicas —responder lo mismo veinte veces, filtrar curiosos, cuadrar visitas— para que se dedique a lo que de verdad cierra ventas: visitar, negociar y firmar.",
  },
  {
    q: "¿Y un lead complejo (hipoteca, permuta, gran inversor)?",
    a: "El sistema cualifica y, en cuanto detecta algo que pide trato humano (financiación, permuta, un inversor importante), te lo escala con el resumen al móvil para que entres tú en el momento justo.",
  },
];

export default function InmobiliariasPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="brick relative overflow-hidden border-b-[6px] border-[color:var(--red)]">
          <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-28 z-10 text-center text-white">
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono mb-8">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">EXPEDIENTE M-INMO</span>
              <span className="border-2 border-white text-white px-2 py-1 font-bold tracking-widest">CLASIFICADO</span>
              <span className="bg-[color:var(--red)] text-white px-2 py-1 font-bold tracking-widest">MISIÓN ACTIVA</span>
            </div>
            <h1 className="font-stencil text-3xl sm:text-5xl md:text-7xl lg:text-8xl leading-[1.05]">
              <span className="block">UNA INMOBILIARIA.</span>
              <span className="block">UN</span>
              <span className="block">SISTEMA.</span>
              <span className="inline-block barred mt-4 px-3 py-1">TODO INTEGRADO.</span>
            </h1>
            <p className="mt-8 font-display text-2xl sm:text-3xl md:text-5xl leading-tight">
              El sistema operativo que tu inmobiliaria<br />
              <span className="text-[color:var(--mustard)]">necesita para no perder un lead</span>
            </p>
            <p className="mt-8 text-base md:text-lg max-w-2xl mx-auto text-white/85">
              El tiempo medio de respuesta del sector es de <span className="font-bold text-white">23 horas</span>. Quien responde en menos de <span className="font-bold text-white">5 minutos</span> capta hasta un <span className="font-bold text-white">40% más</span>, y el <span className="font-bold text-white">78%</span> de los compradores cierran con la PRIMERA agencia que responde. Los leads de Idealista y Fotocasa llegan a cualquier hora —noches y fines de semana—; si nadie contesta, se van a otra.
              <span className="block mt-2 font-bold text-white">No son herramientas sueltas: es un solo sistema que contesta al instante, cualifica y agenda la visita por ti.</span>
            </p>
            <div className="mt-10 flex flex-col items-center gap-3">
              <a href="#waitlist-inmo" className="btn-mustard text-lg">Pide tu demo →</a>
              <p className="text-sm text-white/60">20 plazas · 6 meses gratis · sin tarjeta · 149€/mes fundador para siempre</p>
            </div>
          </div>
          <div className="relative z-10 max-w-6xl mx-auto px-5 pb-12">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 max-w-3xl mx-auto">
              {inmoFunciones.map((f) => (
                <div key={f.funcion} className="relative border-[4px] border-white shadow-[6px_6px_0_#000] overflow-hidden bg-black">
                  <div className="w-full aspect-square flex items-center justify-center text-5xl md:text-6xl">{f.emoji}</div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/85 text-white px-2 py-1 font-stencil text-xs md:text-sm text-center leading-tight">{f.funcion.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-6xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">¿Te suena?</h2>
            <p className="text-lg max-w-2xl mb-2 text-black/70">Lo que pasa en toda inmobiliaria. Cada una de estas cosas te cuesta una venta.</p>
            <p className="text-lg max-w-2xl mb-12 font-bold text-[color:var(--red)]">El comprador de hoy cierra con quien responde primero. Tus competidores ya están automatizados: sin un sistema así, te quedas fuera.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {inmoPains.map((p) => (
                <article key={p.text} className="card-hard p-6">
                  <div className="text-4xl mb-3">{p.icon}</div>
                  <div className="font-stencil text-3xl text-[color:var(--red)] mb-1">{p.stat}</div>
                  <p className="text-sm leading-relaxed">{p.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-6xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Lo que hace el sistema</h2>
            <p className="text-lg max-w-2xl mb-14 text-black/70">Todas las funciones conectadas en un único sistema para inmobiliarias. No las contratas por separado: vienen juntas y trabajan juntas.</p>
            <div className="grid md:grid-cols-2 gap-8">
              {inmoFunciones.map((f) => (
                <article key={f.funcion} className="dossier pt-14 p-6 relative overflow-hidden">
                  <div className="absolute top-1 left-4 right-4 flex items-center z-10 text-black/70 text-[11px] font-mono tracking-widest">
                    <span>{f.funcion.toUpperCase()}</span>
                  </div>
                  <div className="flex items-start gap-5 relative">
                    <div className="relative w-28 h-28 border-[3px] border-black overflow-hidden shrink-0 bg-black flex items-center justify-center">
                      <span className="text-5xl">{f.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-stencil text-3xl sm:text-4xl">{f.funcion}</h3>
                      <p className="text-sm uppercase tracking-wider font-semibold text-black/60">Función del sistema</p>
                      <p className="text-sm font-bold mt-2">{f.titulo}</p>
                    </div>
                  </div>
                  <ul className="mt-5 space-y-2 text-sm">
                    {f.bullets.map((b, i) => (<li key={i} className="flex items-start gap-2 leading-relaxed"><span className="text-[color:var(--red)] font-bold mt-0.5">▸</span><span>{b}</span></li>))}
                  </ul>
                </article>
              ))}
            </div>
            <div className="mt-12 card-hard bg-black text-[color:var(--cream)] p-6 md:p-8 text-center max-w-3xl mx-auto">
              <p className="font-display text-2xl md:text-3xl leading-tight">
                La IA <span className="text-[color:var(--mustard)]">no sustituye a tu agente</span>.
              </p>
              <p className="mt-3 text-base md:text-lg text-white/85">
                Le quita las tareas mecánicas —responder lo mismo veinte veces, filtrar curiosos, cuadrar visitas— para que se dedique a lo que cierra ventas: <span className="font-bold text-white">visitar, negociar y firmar</span>.
              </p>
            </div>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-4xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Un día con el sistema</h2>
            <p className="text-lg max-w-2xl mb-2 text-black/70">El sistema no espera a que le hables: se adelanta. Contesta los leads que entran a deshora, te avisa de los que están sin atender y publica solo.</p>
            <p className="text-base max-w-2xl mb-6 font-bold text-[color:var(--red)]">Mientras otros esperan a que les escriban, tu sistema ya respondió.</p>
            <ul className="space-y-3 mt-8">
              {inmoDay.map((d) => (
                <li key={d.hora} className="card-hard p-4 flex items-start gap-4">
                  <div className="font-stencil text-2xl text-[color:var(--red)] w-20 shrink-0">{d.hora}</div>
                  <div className="flex-1"><div className="font-bold text-sm">{d.funcion}</div><p className="text-sm text-black/70 mt-1">{d.text}</p></div>
                </li>
              ))}
            </ul>
            <p className="text-sm text-black/50 mt-6 italic">El sistema se está activando por fases: algunas acciones funcionan ya y otras se irán encendiendo durante tu periodo fundador.</p>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-6xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Un sistema, un precio</h2>
            <p className="text-lg max-w-2xl mb-8 text-black/70">No pagas por herramientas sueltas: pagas por el sistema completo. Si además no quieres ni revisarlo, súmale la gestión.</p>
            <div className="grid sm:grid-cols-2 gap-5 mt-8 max-w-3xl">
              {inmoPacks.map((p) => (
                <article key={p.name} className={`card-hard p-6 flex flex-col relative ${p.featured ? "bg-[color:var(--mustard)]" : "bg-white"}`}>
                  {p.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[color:var(--red)] text-white text-xs font-bold tracking-widest px-3 py-1 border-2 border-black">★ EL SISTEMA</div>}
                  <div className="font-stencil text-3xl mb-1">{p.name}</div>
                  <p className="text-xs text-black/60 leading-tight mb-5">{p.tagline}</p>
                  <div className="mb-5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-stencil text-5xl">{p.priceFounder}</span>
                      <span className="text-sm font-bold">€/mes</span>
                    </div>
                    {p.priceRegular ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-black/50 line-through">{p.priceRegular} €</span>
                        <span className="text-[10px] font-bold tracking-widest bg-[color:var(--red)] text-white px-1.5 py-0.5">FUNDADOR -50%</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold tracking-widest bg-black text-white px-1.5 py-0.5">SE SUMA AL SISTEMA</span>
                      </div>
                    )}
                  </div>
                  <ul className="space-y-2 mb-6 text-sm flex-1">
                    {p.funciones.map((a) => (<li key={a} className="flex items-start gap-2"><span className="text-[color:var(--red)] font-bold">▸</span><span>{a}</span></li>))}
                  </ul>
                  <a href="#waitlist-inmo" className="btn-mustard text-xs text-center block">{p.cta}</a>
                </article>
              ))}
            </div>
            <p className="text-center text-sm text-black/60 mt-6">
              ¿Necesitas multiusuario o soporte prioritario?{" "}
              <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-[color:var(--red)]">Hablar con ventas →</a>
            </p>
            <p className="text-center text-sm font-bold text-[color:var(--red)] mt-8">Si tu software solo responde cuando le hablas, el lead ya está visitando con otra agencia.</p>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl text-center mb-12">FAQ Inmobiliaria</h2>
            <div className="flex flex-col gap-4">
              {inmoFAQ.map((f, i) => (
                <details key={i} className="card-hard overflow-hidden bg-white group">
                  <summary className="cursor-pointer p-5 font-display text-xl md:text-2xl list-none flex items-center justify-between">
                    <span>{f.q}</span>
                    <span className="text-3xl group-open:rotate-45 transition">+</span>
                  </summary>
                  <div className="px-5 pb-5 border-t-2 border-black pt-4 text-black/80 leading-relaxed">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <VerticalCTA
          id="waitlist-inmo"
          sector="Inmobiliaria"
          city=""
          emoji="🏠"
          headline="Pide tu demo y reserva plaza"
          plazas="20 plazas · 6 meses gratis"
          priceFounder="149€/mes"
          ctaLabel="inmobiliaria"
        />
      </main>
      <Footer />
    </>
  );
}
