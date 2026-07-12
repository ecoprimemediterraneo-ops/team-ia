import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VerticalCTA from "@/components/dental/VerticalCTA";
import { PRECIO_FUNDADOR, PRECIO_NORMAL, GESTION_PRECIO, TOTAL_SISTEMA_GESTION, BETA } from "@/lib/oferta";

export const metadata = {
  title: "AI-Team para Salones de Belleza — llena tu agenda sin soltar las tijeras",
  description:
    "El sistema para peluquerías, centros de estética, uñas y barberías: capta clientas por Instagram, contesta WhatsApp y llamadas para darles cita al momento, y organiza todo en un solo calendario. Menos plantones, ningún hueco perdido, clientas recuperadas.",
  alternates: { canonical: "https://aiteam.marketing/salones" },
  openGraph: {
    title: "AI-Team para Salones de Belleza — tu agenda siempre llena",
    description:
      "La clienta llega por Instagram, pide cita por WhatsApp o teléfono y todo queda organizado en tu calendario. Para peluquerías, estética, uñas y barberías.",
    url: "https://aiteam.marketing/salones",
    type: "website",
    locale: "es_ES",
    siteName: "AI-Team",
  },
};

// Problema del salón — etiquetas cualitativas (sin cifras inventadas).
const salonPains = [
  { stat: "Manos ocupadas", text: "Suena el teléfono mientras estás con un tinte o un corte. No puedes cogerlo, y esa clienta llama al salón de al lado.", icon: "✂️" },
  { stat: "DMs sin leer", text: "Te preguntan precio y disponibilidad por Instagram, pero para cuando lo ves ya han reservado en otro sitio.", icon: "📱" },
  { stat: "Plantones", text: "Reservan una hora y no aparecen. Ese hueco no se recupera y el día cunde menos.", icon: "🚫" },
  { stat: "Huecos muertos", text: "Una cancelación de última hora deja un hueco vacío que nadie llega a llenar.", icon: "🕳️" },
  { stat: "Citas muy lejanas", text: "Das hora a largo plazo, la clienta se enfría y acaba yendo a quien tenía antes.", icon: "📆" },
  { stat: "No vuelven", text: "Clientas que venían cada mes llevan tiempo sin aparecer. Sin un recordatorio, se pierden.", icon: "👋" },
];

// El recorrido — el corazón para salones: CAPTAR → AGENDAR → ORGANIZAR.
const recorrido = [
  {
    paso: "01",
    titulo: "CAPTAR",
    canal: "Instagram · Marta",
    emoji: "📸",
    text: "Responde los DMs de clientas interesadas —precio, servicios, disponibilidad— y publica contenido para atraer nuevas. Sin que tengas que estar pendiente del móvil.",
  },
  {
    paso: "02",
    titulo: "AGENDAR",
    canal: "WhatsApp · Pablo  +  Llamadas · Carmen",
    emoji: "💬",
    text: "Cuando la clienta escribe o llama para pedir cita, se le contesta al momento y se le da hora — aunque estés con las manos ocupadas atendiendo.",
  },
  {
    paso: "03",
    titulo: "ORGANIZAR",
    canal: "Agenda · calendario único",
    emoji: "📅",
    text: "Todas las citas caen solas en un único calendario, sin dobles reservas. Tú ves tu día de un vistazo y sigues a lo tuyo.",
  },
];

// Funciones de agenda — CAPACIDADES del sistema (NO afirmar que ya están activas).
const agendaFunciones = [
  {
    nombre: "Lista de espera inteligente",
    emoji: "⏳",
    text: "El sistema puede poner en lista de espera a las clientas con cita muy lejana. Cuando alguien cancela, avisa automáticamente a la que tenía hora lejana para que la adelante. Así ningún hueco se queda vacío.",
  },
  {
    nombre: "Recordatorio anti-plantón",
    emoji: "🔔",
    text: "Pensado para enviar un aviso por WhatsApp la víspera, para que la clienta confirme o avise. Menos plantones, sin que tú tengas que llamar a nadie.",
  },
  {
    nombre: "Recaptura de clientas",
    emoji: "💌",
    text: "El sistema puede escribir a las clientas que hace tiempo que no vuelven («hace tiempo que no vienes, ¿te reservo?») para llenar los días más flojos.",
  },
];

// Un día en el salón — recorrido en acción (algunas acciones son capacidades en activación).
const salonDay = [
  { hora: "09:30", canal: "Instagram", text: "Una clienta pregunta por el precio de unas mechas en un DM. El sistema responde y le propone hueco esta semana." },
  { hora: "11:15", canal: "Llamadas", text: "Suena el teléfono mientras estás con un corte. El sistema lo coge, da cita y la registra en tu calendario." },
  { hora: "13:00", canal: "WhatsApp", text: "«¿Tenéis hueco esta tarde?» → respuesta al momento con las horas libres, sin que sueltes las tijeras." },
  { hora: "17:00", canal: "Lista de espera", text: "Una cancelación deja un hueco. El sistema puede avisar a una clienta con cita lejana para que lo adelante." },
  { hora: "19:30", canal: "Recordatorios", text: "Aviso de la víspera a las citas de mañana para que confirmen y no te dejen plantada." },
  { hora: "21:00", canal: "Recaptura", text: "Mensaje a clientas que hace dos meses que no vuelven, para llenar el martes flojo de la semana que viene." },
];

// Precio — desde la fuente única (src/lib/oferta.ts).
const salonPacks = [
  {
    name: "Sistema Operativo",
    priceFounder: String(PRECIO_FUNDADOR),
    priceRegular: String(PRECIO_NORMAL),
    tagline: "Un único sistema para tu salón. Instagram, WhatsApp, llamadas y agenda conectados, no herramientas sueltas.",
    funciones: [
      "Instagram: responde DMs y publica para captar clientas",
      "WhatsApp y llamadas que dan cita al momento",
      "Agenda en un único calendario, sin dobles reservas",
      "Lista de espera, recordatorios y recaptura (en activación)",
      "Todo conectado en un solo sistema",
    ],
    featured: true,
  },
  {
    name: "Gestión (opcional)",
    priceFounder: `+${GESTION_PRECIO}`,
    priceRegular: null,
    tagline: "Si no quieres ni revisarlo, lo llevamos por ti. Se suma al Sistema Operativo.",
    funciones: [
      "Supervisión humana del sistema completo",
      "Puesta a punto y ajustes continuos",
      "Reporte mensual de citas y clientas",
      "Soporte prioritario",
    ],
    featured: false,
  },
];

const salonFAQ = [
  {
    q: "¿Esto sustituye a mi recepcionista o a mí?",
    a: "No. Le quita la parte de estar pendiente del teléfono y del móvil —contestar DMs, coger la llamada mientras tienes las manos ocupadas, cuadrar la agenda— para que tú te dediques a lo que de verdad importa: la clienta que tienes delante.",
  },
  {
    q: "¿Contesta por Instagram y WhatsApp con mi tono?",
    a: "Sí. El sistema aprende tu tono, tus servicios y tus precios, y responde en tu nombre. Lo que necesita tu criterio (un cambio de color complejo, una reclamación), te lo pasa a ti.",
  },
  {
    q: "¿Las funciones de agenda (lista de espera, recordatorios, recaptura) ya están activas?",
    a: "Son capacidades del sistema, pensadas para tu salón, que se activan por fases durante tu periodo fundador. En la demo te enseñamos qué funciona ya y qué se irá encendiendo.",
  },
  {
    q: "¿Y si la clienta quiere varios servicios o algo especial?",
    a: "El sistema agenda las citas estándar (corte, tinte, manicura, barba…) y, cuando detecta algo que pide tu criterio, te lo escala con el resumen para que decidas tú.",
  },
];

export default function SalonesPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* HERO */}
        <section className="brick relative overflow-hidden border-b-[6px] border-[color:var(--red)]">
          <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-28 z-10 text-center text-white">
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono mb-8">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">SALONES DE BELLEZA</span>
              <span className="border-2 border-white text-white px-2 py-1 font-bold tracking-widest">PELUQUERÍA · ESTÉTICA · UÑAS · BARBERÍA</span>
            </div>
            <h1 className="font-stencil text-3xl sm:text-5xl md:text-7xl lg:text-8xl leading-[1.05]">
              <span className="block">TU SALÓN.</span>
              <span className="block">TU AGENDA.</span>
              <span className="inline-block barred mt-4 px-3 py-1">SIEMPRE LLENA.</span>
            </h1>
            <p className="mt-8 font-display text-2xl sm:text-3xl md:text-5xl leading-tight">
              La clienta llega por Instagram, pide cita por WhatsApp o teléfono<br />
              <span className="text-[color:var(--mustard)]">y todo queda organizado, solo</span>
            </p>
            <p className="mt-8 text-base md:text-lg max-w-2xl mx-auto text-white/85">
              El teléfono suena mientras tienes las manos en un tinte. Los DMs de Instagram se quedan sin leer. Hay plantones, huecos muertos y clientas que dejaron de venir. Cada uno de esos fallos es una cita que se pierde.
              <span className="block mt-2 font-bold text-white">No son apps sueltas: es un solo sistema que capta por Instagram, contesta WhatsApp y llamadas para dar cita al momento, y lo organiza todo en tu calendario — sin que sueltes las tijeras.</span>
            </p>
            <div className="mt-10 flex flex-col items-center gap-3">
              <a href="#waitlist-salones" className="btn-mustard text-lg">Solicitar plaza beta →</a>
              <p className="text-sm text-white/60">{BETA.plazas} plazas · {BETA.mesesGratis} meses gratis · sin tarjeta · {PRECIO_FUNDADOR}€/mes fundador para siempre</p>
            </div>
          </div>
          {/* Tiles del recorrido */}
          <div className="relative z-10 max-w-6xl mx-auto px-5 pb-12">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 max-w-3xl mx-auto">
              {[
                { emoji: "📸", label: "Instagram" },
                { emoji: "💬", label: "WhatsApp" },
                { emoji: "📞", label: "Llamadas" },
                { emoji: "📅", label: "Agenda" },
              ].map((f) => (
                <div key={f.label} className="relative border-[4px] border-white shadow-[6px_6px_0_#000] overflow-hidden bg-black">
                  <div className="w-full aspect-square flex items-center justify-center text-5xl md:text-6xl">{f.emoji}</div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/85 text-white px-2 py-1 font-stencil text-xs md:text-sm text-center leading-tight">{f.label.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PROBLEMA */}
        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-6xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">¿Te suena?</h2>
            <p className="text-lg max-w-2xl mb-2 text-black/70">Lo que pasa cada día en un salón. Cada una de estas cosas es una cita —y una clienta— que se escapa.</p>
            <p className="text-lg max-w-2xl mb-12 font-bold text-[color:var(--red)]">La clienta reserva en quien le contesta primero. Si no puedes soltar las tijeras para cogerlo, lo coge otro.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {salonPains.map((p) => (
                <article key={p.text} className="card-hard p-6">
                  <div className="text-4xl mb-3" aria-hidden>{p.icon}</div>
                  <div className="font-stencil text-2xl text-[color:var(--red)] mb-1">{p.stat}</div>
                  <p className="text-sm leading-relaxed">{p.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* EL RECORRIDO — captar / agendar / organizar */}
        <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex items-center gap-2 mb-6 text-[10px] font-mono tracking-[0.2em] flex-wrap">
              <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">EL RECORRIDO</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Captar. Agendar.<br />Organizar.</h2>
            <p className="text-lg max-w-2xl mb-14 text-black/70">El camino de una clienta, de principio a fin, en un solo sistema. Entra por Instagram, pide cita por WhatsApp o teléfono, y queda organizada en tu calendario.</p>
            <div className="grid md:grid-cols-3 gap-6">
              {recorrido.map((r) => (
                <article key={r.paso} className="dossier pt-14 p-6 relative overflow-hidden flex flex-col">
                  <div className="absolute top-1 left-4 right-4 flex items-center justify-between z-10 text-black/70 text-[11px] font-mono tracking-widest">
                    <span>PASO {r.paso}</span>
                    <span>{r.emoji}</span>
                  </div>
                  <div className="font-stencil text-6xl text-[color:var(--red)] leading-none mb-2">{r.paso}</div>
                  <h3 className="font-stencil text-3xl">{r.titulo}</h3>
                  <p className="text-xs uppercase tracking-wider font-semibold text-black/60 mb-3">{r.canal}</p>
                  <p className="text-sm leading-relaxed flex-1">{r.text}</p>
                </article>
              ))}
            </div>
            <div className="mt-12 card-hard bg-black text-[color:var(--cream)] p-6 md:p-8 text-center max-w-3xl mx-auto">
              <p className="font-display text-2xl md:text-3xl leading-tight">
                La clienta entra sola, se agenda sola y se organiza sola.<br />
                <span className="text-[color:var(--mustard)]">Tú no sueltas las tijeras.</span>
              </p>
            </div>
          </div>
        </section>

        {/* 3 FUNCIONES DE AGENDA — capacidades */}
        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-6xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Y la agenda, siempre llena</h2>
            <p className="text-lg max-w-2xl mb-3 text-black/70">Menos plantones, ningún hueco perdido y clientas recuperadas. Tres capacidades del sistema pensadas para que tu calendario no tenga días flojos.</p>
            <p className="text-sm max-w-2xl mb-12 font-mono text-black/50 border-l-4 border-[color:var(--mustard)] pl-3">
              Son capacidades del sistema pensadas para tu salón: se activan por fases durante tu periodo fundador.
            </p>
            <div className="grid md:grid-cols-3 gap-8">
              {agendaFunciones.map((f) => (
                <article key={f.nombre} className="card-hard p-6 flex flex-col">
                  <div className="w-16 h-16 border-[3px] border-black bg-[color:var(--mustard)] flex items-center justify-center text-3xl mb-4" aria-hidden>{f.emoji}</div>
                  <h3 className="font-stencil text-2xl leading-tight mb-2">{f.nombre}</h3>
                  <p className="text-sm leading-relaxed text-black/75 flex-1">{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA — un día en tu salón */}
        <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-4xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Un día en tu salón</h2>
            <p className="text-lg max-w-2xl mb-2 text-black/70">El sistema no espera a que le hables: capta, contesta y organiza mientras tú atiendes.</p>
            <p className="text-base max-w-2xl mb-6 font-bold text-[color:var(--red)]">Mientras el teléfono de al lado salta al buzón, tu salón ya dio la cita.</p>
            <ul className="space-y-3 mt-8">
              {salonDay.map((d) => (
                <li key={d.hora} className="card-hard p-4 flex items-start gap-4">
                  <div className="font-stencil text-2xl text-[color:var(--red)] w-20 shrink-0">{d.hora}</div>
                  <div className="flex-1"><div className="font-bold text-sm">{d.canal}</div><p className="text-sm text-black/70 mt-1">{d.text}</p></div>
                </li>
              ))}
            </ul>
            <p className="text-sm text-black/50 mt-6 italic">El sistema se activa por fases: algunas acciones funcionan ya y otras (lista de espera, recordatorios, recaptura) se irán encendiendo durante tu periodo fundador.</p>
          </div>
        </section>

        {/* PRECIO */}
        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-6xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Un sistema, un precio</h2>
            <p className="text-lg max-w-2xl mb-8 text-black/70">No pagas herramientas sueltas: pagas por el sistema completo. Y si no quieres ni revisarlo, súmale la gestión.</p>
            <div className="grid sm:grid-cols-2 gap-5 mt-8 max-w-3xl">
              {salonPacks.map((p) => (
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
                  <a href="#waitlist-salones" className="btn-mustard text-xs text-center block">Solicitar plaza beta</a>
                </article>
              ))}
            </div>
            <p className="text-sm text-black/70 mt-6 border-l-4 border-[color:var(--mustard)] pl-3 max-w-3xl leading-snug">
              <strong>{PRECIO_FUNDADOR}€/mes</strong> (fundador; normal {PRECIO_NORMAL}€): {BETA.mesesGratis} meses gratis, sin permanencia. La Gestión (+{GESTION_PRECIO}€) es opcional → Sistema + Gestión = <strong>{TOTAL_SISTEMA_GESTION}€/mes</strong>.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl text-center mb-12">FAQ Salón</h2>
            <div className="flex flex-col gap-4">
              {salonFAQ.map((f, i) => (
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
          id="waitlist-salones"
          sector="Salón de belleza"
          city=""
          emoji="💇"
          headline="Reserva tu plaza de salón"
          plazas={`${BETA.plazas} plazas · ${BETA.mesesGratis} meses gratis`}
          priceFounder={`${PRECIO_FUNDADOR}€/mes`}
          ctaLabel="salón"
        />
      </main>
      <Footer />
    </>
  );
}
