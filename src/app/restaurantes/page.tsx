import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AgentsForSector from "@/components/AgentsForSector";
import { agents } from "@/lib/agents";
import VerticalCTA from "@/components/dental/VerticalCTA";

export const metadata = {
  title: "AI-Team para Restaurantes — Pablo gestiona reservas, Marta sube tu Insta",
  description:
    "El equipo de IA que tu restaurante necesita. Reservas WhatsApp 24/7, llamadas en 2 idiomas, reseñas de TripAdvisor/Google, posts del menú. Para restaurantes y bares de 1-50 mesas.",
};

const restoPains = [
  { stat: "Sábado", text: "WhatsApp explotado de reservas que no cabéis a contestar", icon: "📱" },
  { stat: "Turistas", text: "no llaman si no contestáis en inglés", icon: "🌍" },
  { stat: "TripAdvisor", text: "una reseña 1★ sin responder hunde el ranking 2 semanas", icon: "⭐" },
  { stat: "Insta", text: "platos increíbles que nunca se publican porque no tienes tiempo", icon: "🍽️" },
  { stat: "No-show", text: "el 15% de mesas reservadas no aparecen sin avisar", icon: "❌" },
  { stat: "Eventos", text: "comuniones, cumpleaños, comidas empresa que pierdes por no responder", icon: "🎉" },
];

const restoAgents: Record<string, { titulo: string; bullets: string[] }> = {
  pablo: {
    titulo: "Pablo gestiona reservas por WhatsApp",
    bullets: [
      "«Mesa para 4 mañana 14:00» a las 23h sábado → Pablo confirma o propone alternativa",
      "Pide datos: nombre, número de comensales, alergias, ocasión especial",
      "Confirma 24h antes para reducir no-shows del 15% al 5%",
    ],
  },
  carmen: {
    titulo: "Carmen coge llamadas en español e inglés",
    bullets: [
      "Esencial en zonas turísticas (Marbella, Málaga centro, costa)",
      "Da menú del día, horarios, gestiona reservas y eventos privados",
      "Filtra los comerciales que llaman para venderte vino o luz",
    ],
  },
  rocio: {
    titulo: "Rocío gestiona TripAdvisor y Google",
    bullets: [
      "Tras cada cena, manda WhatsApp pidiendo reseña al cliente contento",
      "Las 5★ las agradece con cariño, las 1★ con disculpa profesional sin justificarse",
      "Sube tu Google de 4.0 a 4.5★ en 4 meses (caso piloto Málaga)",
    ],
  },
  lucia: {
    titulo: "Lucía organiza tu correo de proveedores y eventos",
    bullets: [
      "Cada mañana resume: pedidos urgentes (pescadero, panadero), ofertas, peticiones de eventos",
      "Borradores listos para responder a empresas pidiendo presupuestos de comidas",
      "Detecta correos importantes (Hacienda, ayuntamiento, sanidad)",
    ],
  },
  eva: {
    titulo: "Eva manda menú del día y promos especiales",
    bullets: [
      "Cada lunes: menú de la semana a tu lista de clientes habituales",
      "Promos: «cena maridaje viernes 25€», «menú San Valentín»",
      "Recupera clientes que llevan 2-3 meses sin venir con descuento",
    ],
  },
  marta: {
    titulo: "Marta publica platos en Instagram y TikTok",
    bullets: [
      "3-4 posts/semana: plato del día, behind-the-scenes cocina, reels",
      "Genera el copy con tu voz (gastronomía local, técnica, etc.)",
      "Te avisa qué horas son mejores para subir según tu audiencia",
    ],
  },
};

const restoDay = [
  { hora: "10:00", agente: "Lucía", text: "Resumen de tu correo: pescadero entrega 12h, 3 peticiones de eventos privados, 1 factura proveedor." },
  { hora: "11:30", agente: "Pablo", text: "Contesta 12 reservas WhatsApp. Confirma cena de 18 personas para sábado." },
  { hora: "13:00", agente: "Carmen", text: "Coge llamada de turistas alemanes. Les explica el menú en inglés, reserva mesa para 4." },
  { hora: "16:00", agente: "Eva", text: "Manda menú degustación de fin de semana a 200 clientes habituales. 12 reservas en 2h." },
  { hora: "17:30", agente: "Marta", text: "Sube reel programado: «cómo preparamos nuestro arroz negro». 340 likes en primera hora." },
  { hora: "22:00", agente: "Rocío", text: "Cliente deja reseña 5★. Rocío responde con cariño. Otro lo deja 2★. Rocío disculpa profesional." },
  { hora: "23:30", agente: "Pablo", text: "Confirmaciones automáticas para todas las reservas de mañana 14:00." },
];

const restoPacks = [
  {
    name: "Esencial",
    priceFounder: "59",
    priceRegular: "99",
    tagline: "Para bar/restaurante de 1-20 mesas, 1 sala",
    agents: ["Pablo (reservas WhatsApp)", "Rocío (TripAdvisor + Google)", "Carmen (llamadas - add-on opcional)"],
    cta: "Empezar Esencial",
  },
  {
    name: "Crecimiento",
    priceFounder: "129",
    priceRegular: "229",
    tagline: "Para restaurante 20-50 mesas con redes activas",
    agents: ["Los 3 anteriores", "+ Marta (Instagram + reels gastronómicos)", "+ Eva (menús + promos)"],
    cta: "Quiero crecer",
    featured: true,
  },
  {
    name: "Élite",
    priceFounder: "229",
    priceRegular: "399",
    tagline: "Para restaurante con eventos privados, catering, varios locales",
    agents: ["Los 8 especialistas", "+ Onboarding 1:1", "+ Setup con The Fork / OpenTable / Covermanager", "+ WhatsApp directo conmigo"],
    cta: "Hablar conmigo",
  },
];

const restoFAQ = [
  {
    q: "¿Compatible con TheFork, OpenTable, Covermanager?",
    a: "Sí, AI-Team vive al lado, no dentro. Pablo gestiona el WhatsApp con el cliente y tu equipo confirma la reserva en TheFork/OpenTable. Estamos preparando integración nativa con Covermanager (Q3 2026) que es el más usado en España.",
  },
  {
    q: "¿Pablo entiende español, inglés y números (mesa para 4)?",
    a: "Sí. Pablo y Carmen son bilingües español/inglés nativo. Para alemán, francés, italiano lo tenemos en roadmap (Q4 2026). Entiende «mesa para 4», «4 personas», «somos 4», «cuatro nos», etc.",
  },
  {
    q: "¿Cómo gestiona alergias, intolerancias, dieta vegetariana?",
    a: "Pablo siempre pregunta «¿alguna alergia o restricción alimentaria?» y guarda la respuesta en la reserva. Tu cocina lo ve cuando confirmáis la mesa. Cumple normativa europea de alérgenos.",
  },
  {
    q: "¿Y si tengo eventos privados (comuniones, empresa, cumpleaños)?",
    a: "Pablo escala automáticamente cuando detecta «evento», «cumpleaños», «empresa», «más de 15 personas». Te llega notificación al móvil con resumen y tú llamas para cerrar el presupuesto en persona.",
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
              <span className="block">OCHO</span>
              <span className="block">ESPECIALISTAS.</span>
              <span className="inline-block barred mt-4 px-3 py-1">UN SUELDO.</span>
            </h1>
            <p className="mt-8 font-display text-2xl sm:text-3xl md:text-5xl leading-tight">
              El equipo que tu restaurante<br />
              <span className="text-[color:var(--mustard)]">necesita y no puedes contratar</span>
            </p>
            <p className="mt-8 text-base md:text-lg max-w-2xl mx-auto text-white/85">
              Mientras estás en cocina, alguien contesta el WhatsApp del sábado.
              Mientras emplatas, alguien coge la llamada de los turistas alemanes.
              Mientras cierras, alguien responde la reseña de TripAdvisor y publica en Instagram.
              <span className="block mt-2 font-bold text-white">Tú vuelves a la cocina. Ellos hacen lo demás.</span>
            </p>
            <div className="mt-10 flex flex-col items-center gap-3">
              <a href="#waitlist-resto" className="btn-mustard text-lg">Quiero una de las 50 plazas</a>
              <p className="text-sm text-white/60">50 plazas beta · 6 meses gratis · después desde 79€/mes precio fundador</p>
            </div>
          </div>
          <div className="relative z-10 max-w-6xl mx-auto px-5 pb-12">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 md:gap-4">
              {agents.map((a) => (
                <div key={a.slug} className="relative border-[4px] border-white shadow-[6px_6px_0_#000] overflow-hidden" style={{ background: a.color }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.avatar} alt={a.name} className="w-full aspect-square object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/85 text-white px-2 py-1 font-stencil text-xs md:text-sm text-center leading-tight">{a.name.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-6xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">¿Te suena?</h2>
            <p className="text-lg max-w-2xl mb-12 text-black/70">6 cosas que pasan en todo restaurante. Cada una te cuesta dinero o reputación.</p>
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
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Los 6 de tu restaurante</h2>
            <p className="text-lg max-w-2xl mb-14 text-black/70">Cada uno con misión específica para hostelería.</p>
            <div className="grid md:grid-cols-2 gap-8">
              {agents.map((a) => {
                const v = restoAgents[a.slug];
                if (!v) return null;
                return (
                  <article key={a.slug} className="dossier pt-12 p-6 relative overflow-hidden">
                    <div className="absolute top-1 left-4 right-4 flex items-center justify-between z-10 text-white text-[11px] font-mono tracking-widest">
                      <span>EXP. {a.codename}</span>
                      <span className="hidden sm:inline">· RESTO ·</span>
                    </div>
                    <div className="flex items-start gap-5 relative">
                      <div className="relative w-28 h-28 border-[3px] border-black overflow-hidden shrink-0" style={{ background: a.color }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                        <span className="absolute -bottom-1 -right-1 bg-white border-[3px] border-black w-9 h-9 flex items-center justify-center text-xl">{a.emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-stencil text-3xl sm:text-4xl">{a.name}</h3>
                        <p className="text-sm uppercase tracking-wider font-semibold text-black/60">{a.role}</p>
                        <p className="text-sm font-bold mt-2">{v.titulo}</p>
                      </div>
                    </div>
                    <ul className="mt-5 space-y-2 text-sm">
                      {v.bullets.map((b, i) => (<li key={i} className="flex items-start gap-2 leading-relaxed"><span className="text-[color:var(--red)] font-bold mt-0.5">▸</span><span>{b}</span></li>))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-4xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Un día en misión</h2>
            <ul className="space-y-3 mt-8">
              {restoDay.map((d) => (
                <li key={d.hora} className="card-hard p-4 flex items-start gap-4">
                  <div className="font-stencil text-2xl text-[color:var(--red)] w-20 shrink-0">{d.hora}</div>
                  <div className="flex-1"><div className="font-bold text-sm">{d.agente}</div><p className="text-sm text-black/70 mt-1">{d.text}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-6xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Elige tu pack restaurante</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
              {restoPacks.map((p) => (
                <article key={p.name} className={`card-hard p-6 flex flex-col relative ${p.featured ? "bg-[color:var(--mustard)]" : "bg-white"}`}>
                  {p.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[color:var(--red)] text-white text-xs font-bold tracking-widest px-3 py-1 border-2 border-black">★ MÁS VENDIDO</div>}
                  <div className="font-stencil text-3xl mb-1">{p.name}</div>
                  <p className="text-xs text-black/60 leading-tight mb-5">{p.tagline}</p>
                  <div className="mb-5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-stencil text-5xl">{p.priceFounder}</span>
                      <span className="text-sm font-bold">€/mes</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-black/50 line-through">{p.priceRegular} €</span>
                      <span className="text-[10px] font-bold tracking-widest bg-[color:var(--red)] text-white px-1.5 py-0.5">FUNDADOR</span>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6 text-sm flex-1">
                    {p.agents.map((a) => (<li key={a} className="flex items-start gap-2"><span className="text-[color:var(--red)] font-bold">▸</span><span>{a}</span></li>))}
                  </ul>
                  <a href="#waitlist-resto" className="btn-mustard text-xs text-center block">{p.cta}</a>
                </article>
              ))}
            </div>
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
          city="Marbella"
          emoji="🍽️"
          headline="Reserva tu plaza piloto"
          plazas="50 plazas beta · Costa del Sol · 6 meses gratis"
          priceFounder="79€/mes"
          ctaLabel="restaurante"
        />
      </main>
      <AgentsForSector sector="restaurante" />
      <Footer />
    </>
  );
}
