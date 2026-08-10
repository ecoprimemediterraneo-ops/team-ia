import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VerticalCTA from "@/components/dental/VerticalCTA";

export const metadata = {
  title: "AI-Team para Gestorías — el sistema operativo que no deja escapar una consulta",
  description:
    "Un único sistema integrado para tu despacho. Responde las consultas por WhatsApp al instante, atiende las llamadas 24/7, cualifica el caso y agenda la primera consulta. Gestiona contacto y agenda cumpliendo el RGPD. Para gestorías de 1-50 personas.",
};

const legalPains = [
  { stat: "90%", text: "de los clientes abandona un despacho si no recibe respuesta en menos de 24 horas. Y el fin de semana cuenta.", icon: "⏱️" },
  { stat: "+60%", text: "de las llamadas y WhatsApp se pierden en los despachos pequeños por no atenderse a tiempo.", icon: "📵" },
  { stat: "Buzón de voz", text: "el cliente que te llama después del trabajo y salta el contestador contrata al despacho que SÍ contesta.", icon: "📞" },
  { stat: "Tardes y noches", text: "el cliente llega estresado, con un problema urgente, y llama cuando tú ya has cerrado.", icon: "🌙" },
  { stat: "Miles de €", text: "un caso perdido por no responder a tiempo vale miles de euros. Y ni te enteras de que lo perdiste.", icon: "💸" },
  { stat: "Curiosos", text: "horas atendiendo consultas que no van a contratar, en vez de trabajar los casos que sí.", icon: "🔍" },
];

const legalFunciones: { emoji: string; funcion: string; titulo: string; bullets: string[] }[] = [
  {
    emoji: "💬",
    funcion: "WhatsApp",
    titulo: "El sistema responde y cualifica las consultas al instante",
    bullets: [
      "Una consulta urgente un domingo por la tarde → responde al instante",
      "Cualifica el caso: tipo de asunto (laboral, civil, penal, mercantil…) y urgencia",
      "Agenda la primera consulta directo en tu calendario. 24/7, también noches y fines de semana",
    ],
  },
  {
    emoji: "📞",
    funcion: "Llamadas",
    titulo: "El sistema atiende las llamadas 24/7",
    bullets: [
      "Coge la llamada del cliente que te llama después del trabajo",
      "Si no estás, no salta el buzón de voz: el sistema atiende, cualifica y agenda",
      "Filtra a los comerciales para que solo te lleguen los clientes",
    ],
  },
  {
    emoji: "📅",
    funcion: "Agenda de consultas",
    titulo: "El sistema gestiona el calendario de consultas",
    bullets: [
      "Cuadra las primeras consultas sin solapamientos",
      "Manda recordatorios automáticos para reducir las ausencias",
      "Reorganiza si alguien cancela y te avisa de los huecos libres",
    ],
  },
  {
    emoji: "✉️",
    funcion: "Seguimiento",
    titulo: "El sistema hace seguimiento de las consultas que no se cerraron",
    bullets: [
      "Recontacta a quien preguntó y no llegó a contratar",
      "Reactiva las consultas dormidas a los 7, 30 y 60 días",
      "Mantiene el contacto con el cliente sin que tú muevas un dedo",
    ],
  },
];

const legalDay = [
  { hora: "08:30", funcion: "Seguimiento", text: "El sistema recontacta 3 consultas que entraron la semana pasada y no llegaron a cerrarse." },
  { hora: "11:00", funcion: "WhatsApp", text: "Contesta una consulta laboral, cualifica la urgencia del caso y agenda la primera cita para el jueves." },
  { hora: "14:30", funcion: "Llamadas", text: "Coge la llamada de un cliente en su pausa de comer. La atiende, cualifica el asunto y agenda la consulta." },
  { hora: "18:00", funcion: "Agenda de consultas", text: "Manda los recordatorios de las consultas de mañana para que no se caiga ninguna por un despiste." },
  { hora: "21:30", funcion: "WhatsApp", text: "Entra una consulta urgente un domingo por la noche. Responde al instante y agenda, mientras tú descansas." },
  { hora: "23:45", funcion: "Llamadas", text: "De madrugada atiende y filtra, sin buzón de voz. Por la mañana tienes solo a los clientes que valen." },
];

const legalPacks = [
  {
    name: "Sistema Operativo",
    priceFounder: "149",
    priceRegular: "299",
    tagline: "Un único sistema integrado para tu despacho. Todo conectado, no herramientas sueltas.",
    funciones: [
      "WhatsApp y llamadas 24/7 que cualifican y agendan",
      "Agenda de consultas con recordatorios",
      "Seguimiento de consultas no cerradas por email",
      "Gestión de contacto y agenda, cumpliendo RGPD",
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
      "Reporte mensual de consultas y citas",
      "Soporte prioritario",
    ],
    cta: "Pide tu demo",
    featured: false,
  },
];

const legalFAQ = [
  {
    q: "¿El sistema accede a la información confidencial de mis expedientes?",
    a: "No. El sistema gestiona el contacto con el cliente —consultas, datos de contacto y agenda de la primera cita—, NO la información confidencial del expediente ni el contenido del caso. Cumple el RGPD en el tratamiento de los datos de contacto y de la agenda.",
  },
  {
    q: "¿Cualifica el caso de verdad (tipo de asunto, urgencia)?",
    a: "Sí. El sistema pregunta el tipo de asunto (laboral, civil, penal, mercantil, etc.) y la urgencia, y lo guarda en la ficha de la consulta. Así llegas a la primera cita sabiendo de qué va antes de sentarte con el cliente.",
  },
  {
    q: "¿Esto sustituye a mis gestorías?",
    a: "No, y es a propósito. El sistema no sustituye al gestor: le quita las preguntas que se repiten —el estado de un trámite, qué papeles faltan, cuándo vence un modelo— para que el equipo se dedique a lo que de verdad requiere criterio.",
  },
  {
    q: "¿Y una consulta que necesita asesoramiento jurídico inmediato?",
    a: "El sistema no da asesoramiento jurídico: atiende, cualifica la urgencia y, en cuanto detecta algo que pide tu intervención inmediata, te lo escala con el resumen al móvil para que entres tú en el momento justo.",
  },
];

export default function GestoríasPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="brick relative overflow-hidden border-b-[6px] border-[color:var(--red)]">
          <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-28 z-10 text-center text-white">
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono mb-8">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">EXPEDIENTE M-LEGAL</span>
              <span className="border-2 border-white text-white px-2 py-1 font-bold tracking-widest">CLASIFICADO</span>
              <span className="bg-[color:var(--red)] text-white px-2 py-1 font-bold tracking-widest">MISIÓN ACTIVA</span>
            </div>
            <h1 className="font-stencil text-3xl sm:text-5xl md:text-7xl lg:text-8xl leading-[1.05]">
              <span className="block">UN DESPACHO.</span>
              <span className="block">UN</span>
              <span className="block">SISTEMA.</span>
              <span className="inline-block barred mt-4 px-3 py-1">TODO INTEGRADO.</span>
            </h1>
            <p className="mt-8 font-display text-2xl sm:text-3xl md:text-5xl leading-tight">
              El sistema operativo que tu despacho<br />
              <span className="text-[color:var(--mustard)]">necesita para no perder una consulta</span>
            </p>
            <p className="mt-8 text-base md:text-lg max-w-2xl mx-auto text-white/85">
              El <span className="font-bold text-white">90%</span> de los clientes abandona un despacho si no recibe respuesta en menos de <span className="font-bold text-white">24 horas</span> —y el fin de semana cuenta. En los despachos pequeños se pierde <span className="font-bold text-white">más del 60%</span> de las llamadas y WhatsApp por no atenderse a tiempo. El cliente llega estresado, con un problema urgente, y llama después del trabajo; si salta el buzón de voz, contrata al despacho que SÍ contesta. Un caso perdido vale <span className="font-bold text-white">miles de euros</span>.
              <span className="block mt-2 font-bold text-white">No son herramientas sueltas: es un solo sistema que contesta al instante, atiende la llamada, cualifica y agenda la primera consulta por ti.</span>
            </p>
            <div className="mt-10 flex flex-col items-center gap-3">
              <a href="#waitlist-gestorías" className="btn-mustard text-lg">Pide tu demo →</a>
              <p className="text-sm text-white/60">20 plazas · 6 meses gratis · sin tarjeta · 149€/mes fundador para siempre</p>
            </div>
          </div>
          <div className="relative z-10 max-w-6xl mx-auto px-5 pb-12">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 max-w-3xl mx-auto">
              {legalFunciones.map((f) => (
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
            <p className="text-lg max-w-2xl mb-2 text-black/70">Lo que pasa en todo despacho pequeño. Cada una de estas cosas te cuesta un cliente.</p>
            <p className="text-lg max-w-2xl mb-12 font-bold text-[color:var(--red)]">El cliente con un problema urgente contrata a quien le responde primero. Tus competidores ya están automatizados: sin un sistema así, te quedas fuera.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {legalPains.map((p) => (
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
            <p className="text-lg max-w-2xl mb-14 text-black/70">Todas las funciones conectadas en un único sistema para despachos. No las contratas por separado: vienen juntas y trabajan juntas.</p>
            <div className="grid md:grid-cols-2 gap-8">
              {legalFunciones.map((f) => (
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
                El sistema <span className="text-[color:var(--mustard)]">no sustituye al gestor</span>.
              </p>
              <p className="mt-3 text-base md:text-lg text-white/85">
                Le quita la tarea de no perder ninguna consulta —responder a deshora, coger la llamada, agendar la cita— para que se dedique a lo que paga las facturas: <span className="font-bold text-white">los casos</span>.
              </p>
            </div>

            <div className="mt-6 card-hard bg-white p-5 md:p-6 max-w-3xl mx-auto flex items-start gap-4">
              <span className="text-3xl shrink-0" aria-hidden>🔒</span>
              <div>
                <div className="font-stencil text-lg mb-1">Tus expedientes son tuyos</div>
                <p className="text-sm text-black/70 leading-relaxed">El sistema gestiona <b>datos de contacto y agenda</b>, no la información confidencial del expediente ni el contenido del caso. <b>Cumple el RGPD.</b></p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-4xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Un día con el sistema</h2>
            <p className="text-lg max-w-2xl mb-2 text-black/70">El sistema no espera a que le hables: se adelanta. Atiende las consultas que entran a deshora, coge las llamadas y hace el seguimiento.</p>
            <p className="text-base max-w-2xl mb-6 font-bold text-[color:var(--red)]">Mientras otros saltan al buzón de voz, tu sistema ya atendió.</p>
            <ul className="space-y-3 mt-8">
              {legalDay.map((d) => (
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
              {legalPacks.map((p) => (
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
                  <a href="#waitlist-gestorías" className="btn-mustard text-xs text-center block">{p.cta}</a>
                </article>
              ))}
            </div>
            <p className="text-center text-sm text-black/60 mt-6">
              ¿Necesitas multiusuario o soporte prioritario?{" "}
              <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-[color:var(--red)]">Hablar con ventas →</a>
            </p>
            <p className="text-center text-sm font-bold text-[color:var(--red)] mt-8">Si tu software solo responde cuando le hablas, la consulta ya se la lleva otro despacho.</p>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl text-center mb-12">FAQ Despacho</h2>
            <div className="flex flex-col gap-4">
              {legalFAQ.map((f, i) => (
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
          id="waitlist-gestorías"
          sector="Gestoría"
          city=""
          emoji="⚖️"
          headline="Pide tu demo y reserva plaza"
          plazas="20 plazas · 6 meses gratis"
          priceFounder="149€/mes"
          ctaLabel="despacho"
        />
      </main>
      <Footer />
    </>
  );
}
