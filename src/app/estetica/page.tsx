import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AgentsForSector from "@/components/AgentsForSector";
import { agents } from "@/lib/agents";
import EsteticaCTA from "@/components/estetica/EsteticaCTA";

export const metadata = {
  title: "AI-Team para Clínicas Estéticas — Automatiza WhatsApp, reseñas, Instagram y email",
  description:
    "El equipo de IA para centros de estética. Responde consultas 24/7, sube tu Google, publica antes/después y reactiva clientes con bonos sin usar. Desde 79€/mes.",
};

const esteticaPains = [
  { stat: "35%", text: "de clientes con bono comprado que no completan sus sesiones", icon: "🎟️" },
  { stat: "40%", text: "de consultas por WhatsApp llegan fuera de horario sin respuesta", icon: "📱" },
  { stat: "3 meses", text: "tiempo medio que un cliente tarda en volver sin recordatorio", icon: "📅" },
  { stat: "Instagram", text: "sin publicar hace semanas mientras tu competencia crece a diario", icon: "📸" },
  { stat: "Google", text: "con 3.6★ de media por falta de solicitud activa de reseñas", icon: "⭐" },
  { stat: "Recepción", text: "saturada entre llamadas, caja, preparación de cabinas y atención presencial", icon: "📞" },
];

const esteticaAgents: Record<string, { titulo: string; bullets: string[] }> = {
  pablo: {
    titulo: "Pablo gestiona consultas y reservas por WhatsApp",
    bullets: [
      "«¿Cuánto cuesta la depilación láser?» a las 22h — respuesta en 8 segundos",
      "Envía menú de tratamientos, precios y disponibilidad sin intervención humana",
      "Agenda citas y envía confirmación + recordatorio automático 24h antes",
    ],
  },
  carmen: {
    titulo: "Carmen atiende llamadas mientras estás en cabina",
    bullets: [
      "Conoce todos los tratamientos, precios y contraindicaciones básicas de tu centro",
      "Gestiona reservas, cancela y reagenda sin interrumpirte",
      "Filtra llamadas comerciales y te pasa solo las que requieren tu atención real",
    ],
  },
  rocio: {
    titulo: "Rocío sube tu valoración Google sistemáticamente",
    bullets: [
      "Tras cada sesión, envía WhatsApp personalizado pidiendo reseña",
      "Responde cada nueva reseña con el tono de tu centro en menos de 1 minuto",
      "Negocios piloto: de 3.6★ a 4.8★ en 8 semanas con Rocío activa",
    ],
  },
  lucia: {
    titulo: "Lucía gestiona el correo y la administración",
    bullets: [
      "Procesa pedidos a proveedores, facturas y confirmaciones de formaciones",
      "Resume la bandeja cada mañana con solo lo que necesita tu atención",
      "Borradores listos con tu tono para responder a clientes por email",
    ],
  },
  eva: {
    titulo: "Eva reactiva clientes y llena la agenda",
    bullets: [
      "Detecta clientes con bonos sin usar y les manda secuencia de reactivación",
      "Envía newsletter mensual con promociones estacionales y nuevos tratamientos",
      "Recupera de media un 12% de clientes inactivos por campaña",
    ],
  },
  marta: {
    titulo: "Marta publica antes/después y contenido de valor",
    bullets: [
      "3 posts semanales en Instagram y TikTok: resultados, tips de skincare, tendencias",
      "Genera copy con hashtags optimizados para tu zona y sector",
      "Tú apruebas con un click — nunca publicas sin verlo antes",
    ],
  },
};

const esteticaDay = [
  { hora: "08:00", agente: "Lucía", text: "Bandeja procesada: 1 pedido de proveedor pendiente, 3 consultas de clientes, 8 promos archivadas. Solo ves lo urgente." },
  { hora: "09:30", agente: "Pablo", text: "Ha contestado 6 WhatsApps de la noche: 2 presupuestos de láser, 1 consulta de botox, 3 reservas de facial. Todo agendado." },
  { hora: "11:00", agente: "Carmen", text: "Coge llamada mientras estás en cabina. La clienta pregunta por mesoterapia capilar. Carmen le da precio, disponibilidad y cierra cita." },
  { hora: "13:30", agente: "Rocío", text: "Ana Martínez deja reseña 5★ tras su sesión de mañana. Rocío la responde con tu nombre y tono en 40 segundos." },
  { hora: "16:00", agente: "Eva", text: "Envía campaña a 34 clientes con bonos caducados en 30 días. 5 reservan esa misma tarde." },
  { hora: "18:00", agente: "Marta", text: "Publica Reel: antes/después de tratamiento de manchas. 120 reproducciones en la primera hora." },
  { hora: "22:00", agente: "Pablo", text: "«¿Tenéis hueco mañana para limpieza facial?» — Pablo responde, ofrece dos huecos y confirma reserva. Tú ya estás en casa." },
];

const esteticaPacks = [
  {
    name: "Esencial",
    priceFounder: "79",
    priceRegular: "199",
    tagline: "Automatización de canales de atención",
    agents: ["Pablo — WhatsApp 24/7", "Rocío — Reseñas Google", "Diana — Diagnóstico continuo"],
    cta: "Activar Esencial",
  },
  {
    name: "Crecimiento",
    priceFounder: "249",
    priceRegular: "349",
    tagline: "Atención + marketing digital automatizado",
    agents: ["Lucía — Correo y administración", "Marta — Instagram y TikTok", "Eva — Email y reactivación"],
    cta: "Activar Crecimiento",
  },
  {
    name: "Élite",
    priceFounder: "249",
    priceRegular: "549",
    tagline: "Operación completa. Los 6 canales operativos.",
    agents: ["Pablo — WhatsApp 24/7", "Rocío — Reseñas Google", "Diana — Diagnóstico continuo", "Lucía — Correo", "Marta — Redes sociales", "Eva — Email marketing"],
    cta: "Activar Élite",
    featured: true,
  },
  {
    name: "Pro",
    priceFounder: "449",
    priceRegular: "899",
    tagline: "Élite + inteligencia competitiva + soporte directo",
    agents: ["Los 6 agentes operativos", "Sergio — Monitorización de competidores", "Onboarding 1:1 con setup incluido", "Soporte prioritario directo"],
    cta: "Hablar con ventas",
  },
];

const esteticaFAQ = [
  {
    q: "¿Sustituye a mi recepcionista?",
    a: "No. La complementa. Tu recepcionista deja de contestar WhatsApps a las 22h, perseguir reseñas y publicar en redes para centrarse en la atención presencial y el cierre de tratamientos. AI-Team le quita el 60-70% del trabajo digital.",
  },
  {
    q: "¿Es compatible con Timely, Treatwell, Fresha o Booksy?",
    a: "Sí, vivimos al lado, no dentro. Pablo y Carmen trabajan con tu calendario de Google o Cal.com. Cuando se agenda una cita, tu recepcionista la confirma en tu software de gestión en 30 segundos. Las integraciones directas con los principales softwares de belleza están en desarrollo para Q4 2026.",
  },
  {
    q: "¿Cómo gestiona consultas sobre contraindicaciones o tratamientos médicos?",
    a: "Pablo está entrenado para responder solo lo que tú le indiques. Las preguntas sobre contraindicaciones específicas (embarazo, medicación, patologías) las escala automáticamente: le dice al cliente que una especialista le llama en breve y te avisa a ti. Nunca improvisa sobre salud.",
  },
  {
    q: "¿Puedo publicar antes/después en Instagram sin problemas legales?",
    a: "Marta genera el contenido pero tú lo apruebas siempre antes de publicar. El consentimiento del cliente para usar su imagen es responsabilidad tuya — te recomendamos un formulario firmado en cabina. Marta nunca publica sin tu aprobación.",
  },
  {
    q: "¿Qué pasa con la RGPD y los datos de mis clientes?",
    a: "Los datos sensibles de salud (historial, tratamientos, fotos negocios) nunca salen de tu software de gestión. AI-Team gestiona solo el canal de comunicación. Servidores en la UE, cifrado en tránsito, contrato de encargado de tratamiento RGPD firmado al alta.",
  },
  {
    q: "¿Cuánto tiempo tarda en estar operativo?",
    a: "Setup de 15 minutos en videollamada: conectamos tu WhatsApp Business y Gmail. Los agentes aprenden tu catálogo de tratamientos, precios y tono en ese mismo momento. En 24 horas ya están contestando solos.",
  },
  {
    q: "¿En cuánto tiempo se notan resultados?",
    a: "Semana 1: Pablo operativo, 0 WhatsApps sin contestar. Semana 2-3: primeras reseñas nuevas de Rocío. Mes 1: Eva reactiva los primeros clientes inactivos. Mes 2-3: tu Google sube 0.4-0.8★ y la agenda se llena con menos huecos vacíos.",
  },
];

export default function EsteticaPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">

        {/* HERO */}
        <section className="brick relative overflow-hidden border-b-[6px] border-[color:var(--red)]">
          <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-28 z-10 text-center text-white">
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono mb-8">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">EXPEDIENTE E-ESTÉTICA</span>
              <span className="border-2 border-white/30 text-white/60 px-2 py-1 font-bold tracking-widest">INFRAESTRUCTURA IA</span>
              <span className="bg-[color:var(--red)] text-white px-2 py-1 font-bold tracking-widest">● SISTEMA ACTIVO</span>
            </div>

            <h1 className="font-stencil text-3xl sm:text-5xl md:text-7xl lg:text-8xl leading-[1.05]">
              <span className="block">UN CENTRO.</span>
              <span className="block">OCHO</span>
              <span className="block">ESPECIALISTAS.</span>
              <span className="inline-block barred mt-4 px-3 py-1">UN SUELDO.</span>
            </h1>

            <p className="mt-8 font-display text-2xl sm:text-3xl md:text-4xl leading-tight">
              La infraestructura operativa que tu clínica estética<br />
              <span className="text-[color:var(--mustard)]">necesita y no puede contratar</span>
            </p>

            <p className="mt-8 text-base md:text-lg max-w-2xl mx-auto text-white/80 leading-relaxed">
              Mientras estás en cabina, alguien contesta el WhatsApp de la clienta que pregunta por láser.
              Mientras cierras el día, alguien reactiva a las 34 clientas con bono sin usar.
              Mientras duermes, alguien responde la reseña nueva de Google.
              <span className="block mt-2 font-bold text-white">Tú te centras en los tratamientos. Ellos hacen el resto.</span>
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="#waitlist-estetica" className="btn-mustard text-lg">Activar mi equipo IA →</a>
              <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer"
                className="text-sm font-mono border border-white/30 text-white/80 px-8 py-3 hover:border-white hover:text-white transition-all duration-200">
                Ver demo en vivo →
              </a>
            </div>
            <p className="mt-4 text-xs text-white/35 tracking-widest font-mono">
              DESDE 79 €/MES · OPERATIVO EN 24H · 14 DÍAS SIN TARJETA
            </p>
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-5 pb-12">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 md:gap-3">
              {agents.map((a) => (
                <div key={a.slug} className="relative border-2 border-white/20 overflow-hidden group hover:border-white/60 transition-all duration-200" style={{ background: a.color }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.avatar} alt={a.name} className="w-full aspect-square object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white px-2 py-1 font-stencil text-[10px] md:text-xs text-center leading-tight">
                    {a.name.toUpperCase()}
                    <div className="text-[7px] tracking-widest text-white/50 font-sans normal-case">{a.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PROBLEMAS */}
        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-6 text-xs font-mono">
              <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">DIAGNÓSTICO</span>
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">COSTE OPERATIVO REAL</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">¿Te suena?</h2>
            <p className="text-lg max-w-2xl mb-12 text-black/70">
              6 fricciones operativas que tiene cualquier centro de estética. Cada una tiene un coste directo en ingresos.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {esteticaPains.map((p) => (
                <article key={p.text} className="card-hard p-6">
                  <div className="text-4xl mb-3">{p.icon}</div>
                  <div className="font-stencil text-3xl text-[color:var(--red)] mb-1">{p.stat}</div>
                  <p className="text-sm leading-relaxed">{p.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* AGENTES */}
        <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-6 text-xs font-mono">
              <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">MÓDULO 01</span>
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">AGENTES ESPECIALIZADOS</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">
              Nueve agentes.<br />Un sistema.
            </h2>
            <p className="text-lg max-w-2xl mb-14 text-black/70">
              Cada agente gestiona un canal de forma autónoma, entrenado específicamente para centros de estética.
            </p>
            <div className="grid md:grid-cols-2 gap-8">
              {agents.map((a) => {
                const est = esteticaAgents[a.slug];
                if (!est) return null;
                return (
                  <article key={a.slug} className="dossier pt-12 p-6 relative overflow-hidden">
                    <div className="absolute top-1 left-4 right-4 flex items-center justify-between z-10 text-white text-[11px] font-mono tracking-widest">
                      <span>EXP. {a.codename}</span>
                      <span className="hidden sm:inline">· ESTÉTICA ·</span>
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
                        <p className="text-sm font-bold mt-2">{est.titulo}</p>
                      </div>
                    </div>
                    <ul className="mt-5 space-y-2 text-sm">
                      {est.bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-[color:var(--red)] font-bold mt-0.5">▸</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* DÍA TIPO */}
        <section className="py-24 border-t-[3px] border-black bg-[color:var(--mustard)]">
          <div className="max-w-4xl mx-auto px-5">
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono mb-6">
              <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">DIARIO DE OPERACIONES</span>
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] bg-white px-2 py-1 font-bold tracking-widest">24H · TURNO COMPLETO</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4 leading-[1]">El sistema<br />en operación</h2>
            <p className="text-lg max-w-2xl mb-12 text-black/70">
              Esto es lo que ocurre en un centro de estética con AI-Team activo. Sin que toques nada.
            </p>
            <ul className="space-y-3">
              {esteticaDay.map((d) => (
                <li key={d.hora} className="card-hard p-4 flex items-start gap-4">
                  <div className="font-stencil text-2xl text-[color:var(--red)] w-20 shrink-0">{d.hora}</div>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{d.agente}</div>
                    <p className="text-sm text-black/70 mt-1">{d.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* COMPARATIVA */}
        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-5xl mx-auto px-5">
            <div className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-[0.2em]">
              <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">ANÁLISIS COMPARATIVO</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-6xl mb-4 leading-tight">
              AI-Team vs<br />equipo interno
            </h2>
            <p className="text-base text-black/40 mb-12 font-mono">Misma capacidad operativa. Fracción del coste. Sin gestión de personas.</p>
            <div className="border-[3px] border-black overflow-hidden">
              <div className="grid grid-cols-3 text-xs font-mono tracking-widest bg-black text-white">
                <div className="p-4">CAPACIDAD</div>
                <div className="p-4 text-center bg-[color:var(--mustard)] text-black">AI-TEAM</div>
                <div className="p-4 text-center text-white/50">RECEP. + CM</div>
              </div>
              {[
                ["Coste mensual", "79–449 €", "1.400–2.200 €"],
                ["Horario", "24/7 inc. fines de semana", "Lun-Vie 9-18h"],
                ["WhatsApp fuera de horario", "Responde siempre", "Sin cobertura"],
                ["Llamadas en cabina", "Carmen lo gestiona", "Buzón o pérdida"],
                ["Reseñas Google", "Solicita y responde solo", "Nunca hay tiempo"],
                ["Posts Instagram", "3/sem con tu tono", "1-2/sem genéricos"],
                ["Reactivación bonos sin usar", "Secuencia automática", "No"],
                ["Días sin cobertura al año", "0", "20-30 días"],
              ].map(([cap, ai, rec], i) => (
                <div key={cap} className={`grid grid-cols-3 border-t border-black/10 ${i % 2 ? "bg-white" : "bg-[color:var(--cream)]/40"}`}>
                  <div className="p-4 text-sm font-medium">{cap}</div>
                  <div className="p-4 text-center text-sm font-bold bg-[color:var(--mustard)]/20">{ai}</div>
                  <div className="p-4 text-center text-sm text-black/50">{rec}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="packs-estetica" className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-6 text-xs font-mono flex-wrap">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">PRECIOS FUNDADORES</span>
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">PARA SIEMPRE</span>
              <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">SOLO 100 PLAZAS</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Nivel de<br />automatización</h2>
            <p className="text-lg max-w-2xl mb-12 text-black/70">
              La misma operación que un equipo de 1.400–2.200 €/mes. Sin nóminas, sin contratos, sin fricciones de gestión.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {esteticaPacks.map((p) => (
                <article key={p.name} className={`card-hard p-6 flex flex-col relative ${p.featured ? "bg-[color:var(--mustard)]" : "bg-white"}`}>
                  {p.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[color:var(--red)] text-white text-xs font-bold tracking-widest px-3 py-1 border-2 border-black">
                      ★ MÁS VENDIDO
                    </div>
                  )}
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
                    {p.agents.map((a) => (
                      <li key={a} className="flex items-start gap-2">
                        <span className="text-[color:var(--red)] font-bold">▸</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="#waitlist-estetica" className="btn-mustard text-xs text-center block">{p.cta}</a>
                </article>
              ))}
            </div>
            <p className="text-center text-xs text-black/50 mt-8 font-mono uppercase tracking-widest">
              14 días de prueba · cancela en un click · sin permanencia · precio fundador para siempre
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-6xl text-center mb-12">Preguntas frecuentes</h2>
            <div className="flex flex-col divide-y divide-black/10 border-y border-black/10">
              {esteticaFAQ.map((f, i) => (
                <details key={i} className="group">
                  <summary className="cursor-pointer py-5 font-semibold text-base md:text-lg flex items-center justify-between gap-4 list-none">
                    <span>{f.q}</span>
                    <span className="text-black/30 text-xl shrink-0 group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <div className="pb-5 text-sm text-black/60 leading-relaxed">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <EsteticaCTA />
      </main>
      <AgentsForSector sector="estetica" />
      <Footer />
    </>
  );
}
