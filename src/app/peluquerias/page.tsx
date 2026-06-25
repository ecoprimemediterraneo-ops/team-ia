import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VerticalCTA from "@/components/dental/VerticalCTA";

export const metadata = {
  title: "AI-Team para Peluquerías y Estética — el sistema operativo de tu salón",
  description:
    "El sistema operativo de IA que tu peluquería o centro de estética necesita. Un único sistema integrado que reduce huecos vacíos, contesta WhatsApps 24/7, sube reseñas y publica antes/después. Para salones de 1-3 sillones.",
};

const peluPains = [
  { stat: "25%", text: "huecos vacíos a media mañana o última hora", icon: "💺" },
  { stat: "Sábado", text: "WhatsApp saturado, pierdes citas por no contestar a tiempo", icon: "📱" },
  { stat: "1 ★", text: "una reseña mala sin responder hunde tu Google", icon: "⭐" },
  { stat: "Insta", text: "subes 1 post al mes y la competencia 5 a la semana", icon: "📷" },
  { stat: "3 meses", text: "tiempo medio que un cliente lleva sin volver al salón", icon: "👋" },
  { stat: "Cancelaciones", text: "se caen el 20% de citas a última hora sin avisar", icon: "❌" },
];

const peluFunciones: { emoji: string; codename: string; funcion: string; role: string; titulo: string; bullets: string[] }[] = [
  {
    emoji: "💬",
    codename: "WHATSAPP",
    funcion: "WhatsApp",
    role: "Reservas y citas 24/7",
    titulo: "El sistema agenda y reagenda por WhatsApp",
    bullets: [
      "«¿Hueco mañana para color y corte?» a las 22h domingo → el sistema responde solo, al instante",
      "Ofrece 2-3 huecos disponibles, recoge nombre + servicio + estilista preferido",
      "Confirma 24h antes para reducir cancelaciones de última hora",
    ],
  },
  {
    emoji: "📞",
    codename: "LLAMADAS",
    funcion: "Llamadas",
    role: "Atención telefónica",
    titulo: "El sistema coge llamadas mientras estás cortando",
    bullets: [
      "Habla español e inglés (turistas, expats, capitales internacionales)",
      "Da horarios, agenda primeras citas, pasa recados",
      "Filtra los comerciales que llaman mil veces para venderte productos",
    ],
  },
  {
    emoji: "⭐",
    codename: "RESENAS",
    funcion: "Reseñas de Google",
    role: "Reputación online",
    titulo: "El sistema sube tu Google con reseñas reales",
    bullets: [
      "Tras cada cita, manda WhatsApp pidiendo reseña a la clienta contenta",
      "Cuando llega una nueva, redacta respuesta cariñosa con tu tono",
      "Las negativas las gestiona con disculpa profesional, sin justificarse",
    ],
  },
  {
    emoji: "📬",
    codename: "AGENDA",
    funcion: "Correo y agenda",
    role: "Bandeja y calendario",
    titulo: "El sistema organiza tu correo de proveedores",
    bullets: [
      "Cada mañana resume bandeja: pedidos urgentes, ofertas, basura",
      "Borradores listos para responder a Wella, L'Oréal, Schwarzkopf",
      "Te recupera 1h al día que ya no pierdes en email",
    ],
  },
  {
    emoji: "✉️",
    codename: "EMAIL-MKT",
    funcion: "Email marketing",
    role: "Recuperar clientas",
    titulo: "El sistema recupera clientas que no han vuelto",
    bullets: [
      "Detecta clientas que llevan +3 meses sin venir",
      "Manda email cariñoso: «hola, ¿retocamos el color para esta primavera?»",
      "Reactiva inactivas y las convierte en cita de nuevo",
    ],
  },
  {
    emoji: "📱",
    codename: "INSTAGRAM",
    funcion: "Instagram y redes",
    role: "Contenido y redes",
    titulo: "El sistema publica antes/después en Instagram",
    bullets: [
      "3-4 posts/semana: transformaciones, reels de balayage, tips",
      "Genera la imagen y el copy con tu voz",
      "Los reels los grabas tú con el móvil, el sistema te da guion",
    ],
  },
];

const peluDay = [
  { hora: "08:30", funcion: "Correo y agenda", text: "El sistema te resume el correo: 1 pedido urgente Wella, 2 ofertas, 8 spam." },
  { hora: "10:00", funcion: "WhatsApp", text: "Contesta 6 WhatsApps de clientas que escribieron de noche. Agenda 3 citas." },
  { hora: "12:00", funcion: "Llamadas", text: "Coge llamada de turista francesa. Le da horarios en inglés, agenda mechas." },
  { hora: "14:00", funcion: "Reseñas de Google", text: "Entra una reseña 5★. El sistema responde al instante con cariño." },
  { hora: "16:00", funcion: "Email marketing", text: "Manda email semanal a 8 clientas inactivas. 2 contestan pidiendo cita." },
  { hora: "18:00", funcion: "Instagram y redes", text: "Sube reel programado: «balayage cobrizo para otoño»." },
  { hora: "21:30", funcion: "WhatsApp", text: "Llega cancelación de última hora. El sistema ofrece el hueco a 3 clientas en lista de espera." },
];

const peluPacks = [
  {
    name: "Sistema Operativo",
    priceFounder: "149",
    priceRegular: "299",
    tagline: "El sistema completo de tu salón. Un único sistema integrado.",
    agents: [
      "Reservas y citas 24/7 por WhatsApp",
      "Llamadas, reseñas de Google y recuperación de clientas",
      "Correo, agenda, Instagram y redes",
      "Inteligencia competitiva incluida",
    ],
    cta: "Pide tu demo",
    featured: true,
  },
  {
    name: "Gestión (opcional)",
    priceFounder: "+249",
    priceRegular: "",
    tagline: "Se suma al Sistema Operativo. Lo gestionamos por ti.",
    agents: [
      "Supervisión y ajuste continuo del sistema",
      "Te quitas de encima la operativa del día a día",
      "Reportes y mejoras mes a mes",
    ],
    cta: "Pide tu demo",
  },
];

const peluFAQ = [
  {
    q: "¿Compatible con Treatwell, Booksy, Fresha, Acuity?",
    a: "Sí, el sistema vive al lado, no dentro. Trabaja sobre tu calendario (Google Calendar o Cal.com paralelo) y tu WhatsApp Business. Cuando el sistema agenda, tu recepcionista o tú lo confirmáis en Treatwell/Booksy en 30 segundos. Estamos preparando integración nativa con Treatwell para Q3 2026.",
  },
  {
    q: "¿El sistema entiende los nombres de los servicios (mechas californianas, balayage, etc.)?",
    a: "Sí, el sistema está entrenado con vocabulario de peluquería profesional. Sabe qué es un balayage, una decoloración, mechas baby lights, alisado de keratina, brushing, etc. Si usas nombres propios o técnicas específicas, las añades en tu perfil del negocio y las aprende.",
  },
  {
    q: "¿Las reseñas que escribe el sistema suenan a ti, no a un robot?",
    a: "Sí. Aprende tu tono leyendo las reseñas que ya has respondido tú antes. Y cada vez que corriges una respuesta, la guarda como gold standard para futuras. En 2 semanas suena exactamente como tú.",
  },
  {
    q: "¿Qué pasa si una clienta cancela a última hora?",
    a: "El sistema ofrece automáticamente ese hueco a las clientas en tu lista de espera (las que dijeron «no había hueco esta semana»), para que no se quede vacío.",
  },
  {
    q: "¿Cuánto tiempo me lleva configurar todo?",
    a: "10 minutos de alta + 30 minutos de onboarding por videollamada conmigo donde repasamos: tono, servicios, precios, horarios, estilistas, vocabulario. Después el sistema funciona solo. Tú solo tienes que aprobar las publicaciones de Instagram con un click.",
  },
];

export default function PeluqueriasPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="brick relative overflow-hidden border-b-[6px] border-[color:var(--red)]">
          <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-28 z-10 text-center text-white">
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono mb-8">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">EXPEDIENTE M-PELU</span>
              <span className="border-2 border-white text-white px-2 py-1 font-bold tracking-widest">CLASIFICADO</span>
              <span className="bg-[color:var(--red)] text-white px-2 py-1 font-bold tracking-widest">MISIÓN ACTIVA</span>
            </div>
            <h1 className="font-stencil text-3xl sm:text-5xl md:text-7xl lg:text-8xl leading-[1.05]">
              <span className="block">UN SALÓN.</span>
              <span className="block">UN</span>
              <span className="block">SISTEMA.</span>
              <span className="inline-block barred mt-4 px-3 py-1">UN SUELDO.</span>
            </h1>
            <p className="mt-8 font-display text-2xl sm:text-3xl md:text-5xl leading-tight">
              El sistema operativo que tu peluquería<br />
              <span className="text-[color:var(--mustard)]">necesita y no puedes contratar</span>
            </p>
            <p className="mt-8 text-base md:text-lg max-w-2xl mx-auto text-white/85">
              No son herramientas sueltas ni empleados de IA con nombre: es un único sistema integrado.
              Mientras estás cortando, el sistema contesta el WhatsApp de la clienta del sábado.
              Mientras secas, sube tu reel a Instagram.
              Mientras cierras, recupera a la clienta que llevaba 3 meses sin venir.
              <span className="block mt-2 font-bold text-white">Tú vuelves a la silla. El sistema hace lo demás.</span>
            </p>
            <p className="mt-6 text-sm md:text-base max-w-2xl mx-auto text-[color:var(--mustard)] font-bold">
              Tus competidores ya están automatizados y los clientes esperan respuesta al instante. Sin un sistema así, te quedas fuera.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3">
              <a href="#waitlist-pelu" className="btn-mustard text-lg">Pide tu demo →</a>
              <p className="text-sm text-white/60">20 plazas · 6 meses gratis · sin tarjeta · 149€/mes fundador para siempre</p>
            </div>
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-5 pb-12">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 md:gap-4">
              {peluFunciones.map((f) => (
                <div key={f.codename} className="relative border-[4px] border-white shadow-[6px_6px_0_#000] overflow-hidden bg-black">
                  <div className="w-full aspect-square flex items-center justify-center text-5xl md:text-6xl">{f.emoji}</div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/85 text-white px-2 py-1 font-stencil text-[10px] md:text-xs text-center leading-tight">{f.funcion.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-6 text-xs font-mono">
              <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">DIAGNÓSTICO</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">¿Te suena?</h2>
            <p className="text-lg max-w-2xl mb-12 text-black/70">6 cosas que pasan en toda peluquería de 1-3 sillones. Cada una te cuesta dinero.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {peluPains.map((p) => (
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
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Todo lo que hace<br />tu sistema</h2>
            <p className="text-lg max-w-2xl mb-14 text-black/70">Un único sistema integrado, entrenado para peluquería y estética. No genérico, no herramientas sueltas.</p>
            <div className="grid md:grid-cols-2 gap-8">
              {peluFunciones.map((f) => (
                <article key={f.codename} className="dossier pt-12 p-6 relative overflow-hidden">
                  <div className="absolute top-1 left-4 right-4 flex items-center justify-between z-10 text-white text-[11px] font-mono tracking-widest">
                    <span>FUNCIÓN {f.codename}</span>
                    <span className="hidden sm:inline">· PELU ·</span>
                  </div>
                  <div className="flex items-start gap-5 relative">
                    <div className="relative w-28 h-28 border-[3px] border-black overflow-hidden shrink-0 bg-black flex items-center justify-center">
                      <span className="text-6xl">{f.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-stencil text-3xl sm:text-4xl">{f.funcion}</h3>
                      <p className="text-sm uppercase tracking-wider font-semibold text-black/60">{f.role}</p>
                      <p className="text-sm font-bold mt-2">{f.titulo}</p>
                    </div>
                  </div>
                  <ul className="mt-5 space-y-2 text-sm">
                    {f.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-[color:var(--red)] font-bold mt-0.5">▸</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-black text-white">
          <div className="max-w-5xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-6 text-xs font-mono">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">EN ACTIVACIÓN POR FASES</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">No espera<br />a que le hables</h2>
            <p className="text-lg max-w-2xl mb-12 text-white/70">
              La diferencia de un sistema de verdad: se adelanta. Estamos activando estas capacidades por fases.
            </p>
            <div className="grid sm:grid-cols-2 gap-5">
              <article className="card-hard p-6 bg-white text-black">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-sm leading-relaxed font-bold">Te avisa de los mensajes sin responder antes de que se enfríe la clienta.</p>
              </article>
              <article className="card-hard p-6 bg-white text-black">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-sm leading-relaxed font-bold">Cada mañana te recuerda las reservas del día y los huecos por llenar.</p>
              </article>
              <article className="card-hard p-6 bg-white text-black">
                <div className="text-4xl mb-3">📱</div>
                <p className="text-sm leading-relaxed font-bold">Publica en Instagram solo, sin que tengas que acordarte.</p>
              </article>
              <article className="card-hard p-6 bg-white text-black">
                <div className="text-4xl mb-3">✉️</div>
                <p className="text-sm leading-relaxed font-bold">Te sugiere a qué cliente reescribir para que vuelva al salón.</p>
              </article>
            </div>
            <p className="mt-10 font-display text-2xl md:text-3xl text-[color:var(--mustard)]">
              Mientras otros esperan a que les escribas, tu sistema ya actuó.
            </p>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-4xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Un día con tu sistema</h2>
            <p className="text-lg max-w-2xl mb-12 text-black/70">Esto es lo que pasa en una peluquería con el sistema trabajando solo.</p>
            <ul className="space-y-3">
              {peluDay.map((d, i) => (
                <li key={i} className="card-hard p-4 flex items-start gap-4">
                  <div className="font-stencil text-2xl text-[color:var(--red)] w-20 shrink-0">{d.hora}</div>
                  <div className="flex-1"><div className="font-bold text-sm">{d.funcion}</div><p className="text-sm text-black/70 mt-1">{d.text}</p></div>
                </li>
              ))}
            </ul>
            <p className="mt-10 font-display text-2xl md:text-3xl text-[color:var(--red)]">
              Si tu software solo responde cuando le hablas, vive en los 90.
            </p>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-6xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Tu sistema operativo</h2>
            <p className="text-lg max-w-2xl mb-12 text-black/70">Un único sistema integrado, no herramientas sueltas. Y si quieres, lo gestionamos por ti.</p>
            <div className="grid sm:grid-cols-2 gap-5 max-w-3xl">
              {peluPacks.map((p) => (
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
                        <span className="text-[10px] font-bold tracking-widest bg-[color:var(--red)] text-white px-1.5 py-0.5">FUNDADOR · 50% DTO</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold tracking-widest bg-black text-white px-1.5 py-0.5">SE SUMA AL SISTEMA</span>
                      </div>
                    )}
                  </div>
                  <ul className="space-y-2 mb-6 text-sm flex-1">
                    {p.agents.map((a) => (<li key={a} className="flex items-start gap-2"><span className="text-[color:var(--red)] font-bold">▸</span><span>{a}</span></li>))}
                  </ul>
                  <a href="#waitlist-pelu" className="btn-mustard text-xs text-center block">{p.cta}</a>
                </article>
              ))}
            </div>
            <p className="text-center text-sm text-black/60 mt-6">
              Automatización de verdad, no la de hace diez años.{" "}
              <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-[color:var(--red)]">Hablar con ventas →</a>
            </p>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl text-center mb-12">FAQ Salón</h2>
            <div className="flex flex-col gap-4">
              {peluFAQ.map((f, i) => (
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
          id="waitlist-pelu"
          sector="Peluquería / estética"
          city=""
          emoji="💇‍♀️"
          headline="Pide tu demo y reserva plaza"
          plazas="20 plazas · 6 meses gratis"
          priceFounder="149€/mes"
          ctaLabel="Salón"
        />
      </main>
      <Footer />
    </>
  );
}
