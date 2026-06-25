import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VerticalCTA from "@/components/dental/VerticalCTA";

export const metadata = {
  title: "AI-Team para Restaurantes — el sistema operativo que llena tus mesas",
  description:
    "Un único sistema integrado para tu restaurante. Reservas por WhatsApp 24/7, llamadas en 2 idiomas, reseñas de TripAdvisor/Google y publicación en Instagram. Para restaurantes y bares de 1-50 mesas.",
};

const restoPains = [
  { stat: "Sábado", text: "WhatsApp explotado de reservas que no cabéis a contestar", icon: "📱" },
  { stat: "Turistas", text: "no llaman si no contestáis en inglés", icon: "🌍" },
  { stat: "TripAdvisor", text: "una reseña 1★ sin responder hunde el ranking 2 semanas", icon: "⭐" },
  { stat: "Insta", text: "platos increíbles que nunca se publican porque no tienes tiempo", icon: "🍽️" },
  { stat: "No-show", text: "el 15% de mesas reservadas no aparecen sin avisar", icon: "❌" },
  { stat: "Eventos", text: "comuniones, cumpleaños, comidas empresa que pierdes por no responder", icon: "🎉" },
];

const restoFunciones: { emoji: string; funcion: string; titulo: string; bullets: string[] }[] = [
  {
    emoji: "💬",
    funcion: "WhatsApp",
    titulo: "El sistema gestiona las reservas por WhatsApp",
    bullets: [
      "«Mesa para 4 mañana 14:00» a las 23h sábado → confirma o propone alternativa al instante",
      "Pide datos: nombre, número de comensales, alergias, ocasión especial",
      "Confirma la reserva 24h antes, sin que tú muevas un dedo",
    ],
  },
  {
    emoji: "📞",
    funcion: "Llamadas",
    titulo: "El sistema coge las llamadas en español e inglés",
    bullets: [
      "Esencial en zonas turísticas y de paso",
      "Da menú del día, horarios, gestiona reservas y eventos privados",
      "Filtra los comerciales que llaman para venderte vino o luz",
    ],
  },
  {
    emoji: "⭐",
    funcion: "Reseñas de Google",
    titulo: "El sistema gestiona TripAdvisor y Google",
    bullets: [
      "Tras cada cena, manda WhatsApp pidiendo reseña al cliente contento",
      "Las 5★ las agradece con cariño, las 1★ con disculpa profesional sin justificarse",
      "Te avisa de cualquier reseña nueva antes de que se enquiste",
    ],
  },
  {
    emoji: "📬",
    funcion: "Correo y agenda",
    titulo: "El sistema organiza tu correo de proveedores y eventos",
    bullets: [
      "Cada mañana resume: pedidos urgentes (pescadero, panadero), ofertas, peticiones de eventos",
      "Borradores listos para responder a empresas pidiendo presupuestos de comidas",
      "Detecta correos importantes (Hacienda, ayuntamiento, sanidad)",
    ],
  },
  {
    emoji: "✉️",
    funcion: "Email marketing",
    titulo: "El sistema manda menú del día y promos especiales",
    bullets: [
      "Cada lunes: menú de la semana a tu lista de clientes habituales",
      "Promos: «cena maridaje viernes 25€», «menú San Valentín»",
      "Sugiere a qué clientes que llevan meses sin venir reescribir con un descuento",
    ],
  },
  {
    emoji: "📱",
    funcion: "Instagram y redes",
    titulo: "El sistema publica tus platos en Instagram y redes",
    bullets: [
      "Publica solo: plato del día, behind-the-scenes de cocina, reels",
      "Genera el copy con tu voz (gastronomía local, técnica, etc.)",
      "Elige las mejores horas para subir según tu audiencia",
    ],
  },
];

const restoDay = [
  { hora: "10:00", funcion: "Correo y agenda", text: "El sistema te pasa el resumen de tu correo: pescadero entrega 12h, 3 peticiones de eventos privados, 1 factura proveedor." },
  { hora: "11:30", funcion: "WhatsApp", text: "Contesta las reservas que entraron por WhatsApp esta mañana y confirma la cena de grupo del sábado." },
  { hora: "13:00", funcion: "Llamadas", text: "Coge la llamada de unos turistas. Les explica el menú en inglés y reserva mesa para 4." },
  { hora: "16:00", funcion: "Email marketing", text: "Manda el menú degustación de fin de semana a tus clientes habituales y te sugiere a quién reescribir." },
  { hora: "17:30", funcion: "Instagram y redes", text: "Publica solo el reel programado: «cómo preparamos nuestro arroz negro». Tú no has tenido que tocar nada." },
  { hora: "22:00", funcion: "Reseñas de Google", text: "Entra una reseña nueva. El sistema responde con tono y te avisa al móvil de la que pinta delicada." },
  { hora: "23:30", funcion: "WhatsApp", text: "Se adelanta: envía las confirmaciones de todas las reservas de mañana antes de que se conviertan en no-shows." },
];

const restoPacks = [
  {
    name: "Sistema Operativo",
    priceFounder: "149",
    priceRegular: "299",
    tagline: "Un único sistema integrado para tu restaurante. Todo conectado, no herramientas sueltas.",
    funciones: [
      "Reservas por WhatsApp 24/7",
      "Llamadas en español e inglés",
      "Reseñas de TripAdvisor y Google",
      "Correo, agenda y eventos",
      "Email marketing de menús y promos",
      "Instagram y redes en piloto automático",
    ],
    cta: "Pide tu demo",
    featured: true,
  },
  {
    name: "Gestión (opcional)",
    priceFounder: "+249",
    priceRegular: null,
    tagline: "Si no quieres ni revisar: lo gestionamos por ti. Se suma al Sistema Operativo.",
    funciones: [
      "Supervisión humana del sistema completo",
      "Puesta a punto y ajustes continuos",
      "Reporte mensual de reservas y reseñas",
      "Soporte prioritario",
    ],
    cta: "Pide tu demo",
    featured: false,
  },
];

const restoFAQ = [
  {
    q: "¿Compatible con TheFork, OpenTable, Covermanager?",
    a: "Sí, el sistema vive al lado, no dentro. Gestiona el WhatsApp con el cliente y tu equipo confirma la reserva en TheFork/OpenTable. Estamos preparando integración nativa con Covermanager (Q3 2026), que es el más usado en España.",
  },
  {
    q: "¿Entiende español, inglés y números (mesa para 4)?",
    a: "Sí. El sistema es bilingüe español/inglés nativo. Para alemán, francés e italiano lo tenemos en roadmap (Q4 2026). Entiende «mesa para 4», «4 personas», «somos 4», «cuatro nos», etc.",
  },
  {
    q: "¿Cómo gestiona alergias, intolerancias, dieta vegetariana?",
    a: "El sistema siempre pregunta «¿alguna alergia o restricción alimentaria?» y guarda la respuesta en la reserva. Tu cocina lo ve cuando confirmáis la mesa. Cumple la normativa europea de alérgenos.",
  },
  {
    q: "¿Y si tengo eventos privados (comuniones, empresa, cumpleaños)?",
    a: "El sistema escala automáticamente cuando detecta «evento», «cumpleaños», «empresa», «más de 15 personas». Te llega una notificación al móvil con el resumen y tú llamas para cerrar el presupuesto en persona.",
  },
];

export default function RestaurantesPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="brick relative overflow-hidden border-b-[6px] border-[color:var(--red)]">
          <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-28 z-10 text-center text-white">
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono mb-8">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">EXPEDIENTE M-RESTO</span>
              <span className="border-2 border-white text-white px-2 py-1 font-bold tracking-widest">CLASIFICADO</span>
              <span className="bg-[color:var(--red)] text-white px-2 py-1 font-bold tracking-widest">MISIÓN ACTIVA</span>
            </div>
            <h1 className="font-stencil text-3xl sm:text-5xl md:text-7xl lg:text-8xl leading-[1.05]">
              <span className="block">UN RESTAURANTE.</span>
              <span className="block">UN</span>
              <span className="block">SISTEMA.</span>
              <span className="inline-block barred mt-4 px-3 py-1">TODO INTEGRADO.</span>
            </h1>
            <p className="mt-8 font-display text-2xl sm:text-3xl md:text-5xl leading-tight">
              El sistema operativo que tu restaurante<br />
              <span className="text-[color:var(--mustard)]">necesita para llenar mesas</span>
            </p>
            <p className="mt-8 text-base md:text-lg max-w-2xl mx-auto text-white/85">
              Mientras estás en cocina, el sistema contesta el WhatsApp del sábado.
              Mientras emplatas, coge la llamada de los turistas.
              Mientras cierras, responde la reseña de TripAdvisor y publica en Instagram.
              <span className="block mt-2 font-bold text-white">No son herramientas sueltas: es un solo sistema que se adelanta a lo que viene.</span>
            </p>
            <div className="mt-10 flex flex-col items-center gap-3">
              <a href="#waitlist-resto" className="btn-mustard text-lg">Pide tu demo →</a>
              <p className="text-sm text-white/60">20 plazas · 6 meses gratis · sin tarjeta · 149€/mes fundador para siempre</p>
            </div>
          </div>
          <div className="relative z-10 max-w-6xl mx-auto px-5 pb-12">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 md:gap-4">
              {restoFunciones.map((f) => (
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
            <p className="text-lg max-w-2xl mb-2 text-black/70">6 cosas que pasan en todo restaurante. Cada una te cuesta dinero o reputación.</p>
            <p className="text-lg max-w-2xl mb-12 font-bold text-[color:var(--red)]">Y el cliente de hoy espera respuesta al instante. Tus competidores ya están automatizados: sin un sistema así, te quedas fuera.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {restoPains.map((p) => (
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
            <p className="text-lg max-w-2xl mb-14 text-black/70">Todas las funciones conectadas en un único sistema para hostelería. No las contratas por separado: vienen juntas y trabajan juntas.</p>
            <div className="grid md:grid-cols-2 gap-8">
              {restoFunciones.map((f) => (
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
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-4xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Un día con el sistema</h2>
            <p className="text-lg max-w-2xl mb-2 text-black/70">El sistema no espera a que le hables: se adelanta. Te avisa de los mensajes y reservas sin atender, te recuerda las reservas del día y publica solo.</p>
            <p className="text-base max-w-2xl mb-6 font-bold text-[color:var(--red)]">Mientras otros esperan a que les escribas, tu sistema ya actuó.</p>
            <ul className="space-y-3 mt-8">
              {restoDay.map((d) => (
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
              {restoPacks.map((p) => (
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
                  <a href="#waitlist-resto" className="btn-mustard text-xs text-center block">{p.cta}</a>
                </article>
              ))}
            </div>
            <p className="text-center text-sm text-black/60 mt-6">
              ¿Necesitas multiusuario o soporte prioritario?{" "}
              <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-[color:var(--red)]">Hablar con ventas →</a>
            </p>
            <p className="text-center text-sm font-bold text-[color:var(--red)] mt-8">Si tu software solo responde cuando le hablas, vive en los 90.</p>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl text-center mb-12">FAQ Restaurante</h2>
            <div className="flex flex-col gap-4">
              {restoFAQ.map((f, i) => (
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
          id="waitlist-resto"
          sector="Restaurante / hostelería"
          city=""
          emoji="🍽️"
          headline="Pide tu demo y reserva plaza"
          plazas="20 plazas · 6 meses gratis"
          priceFounder="149€/mes"
          ctaLabel="restaurante"
        />
      </main>
      <Footer />
    </>
  );
}
