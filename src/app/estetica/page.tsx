import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EsteticaCTA from "@/components/estetica/EsteticaCTA";

export const metadata = {
  title: "AI-Team — El sistema operativo para tu clínica estética",
  description:
    "Un único sistema integrado que lleva tu clínica: responde el WhatsApp 24/7, sube tu Google, publica en Instagram y reactiva clientes con bonos sin usar. Se adelanta solo. Desde 149€/mes (fundador).",
};

// FUNCIONES del sistema (sin caras, sin nombres). Array local — no se importa `agents`.
const esteticaFunciones: {
  funcion: string;
  emoji: string;
  codename: string;
  color: string;
  titulo: string;
  bullets: string[];
}[] = [
  {
    funcion: "WhatsApp",
    emoji: "💬",
    codename: "ALFA-W1",
    color: "#25D366",
    titulo: "El sistema gestiona consultas y reservas por WhatsApp",
    bullets: [
      "«¿Cuánto cuesta la depilación láser?» a las 22h — respuesta en segundos",
      "Envía menú de tratamientos, precios y disponibilidad sin intervención humana",
      "Agenda citas y envía confirmación + recordatorio automático 24h antes",
    ],
  },
  {
    funcion: "Llamadas",
    emoji: "📞",
    codename: "FOXTROT-C6",
    color: "#A88BE8",
    titulo: "El sistema atiende llamadas mientras estás en cabina",
    bullets: [
      "Conoce todos los tratamientos, precios y contraindicaciones básicas de tu centro",
      "Gestiona reservas, cancela y reagenda sin interrumpirte",
      "Filtra llamadas comerciales y te pasa solo las que requieren tu atención real",
    ],
  },
  {
    funcion: "Reseñas de Google",
    emoji: "⭐",
    codename: "GOLF-R2",
    color: "#FBBF24",
    titulo: "El sistema trabaja tu valoración de Google",
    bullets: [
      "Tras cada sesión, envía WhatsApp personalizado pidiendo reseña",
      "Responde cada nueva reseña con el tono de tu centro en menos de 1 minuto",
      "Te avisa si una reseña negativa necesita tu atención inmediata",
    ],
  },
  {
    funcion: "Correo y agenda",
    emoji: "📬",
    codename: "BRAVO-L4",
    color: "#F5C518",
    titulo: "El sistema gestiona el correo y la administración",
    bullets: [
      "Procesa pedidos a proveedores, facturas y confirmaciones de formaciones",
      "Resume la bandeja cada mañana con solo lo que necesita tu atención",
      "Borradores listos con tu tono para responder a clientes por email",
    ],
  },
  {
    funcion: "Email marketing",
    emoji: "✉️",
    codename: "ECHO-E3",
    color: "#60A5FA",
    titulo: "El sistema reactiva clientes y llena la agenda",
    bullets: [
      "Detecta clientes con bonos sin usar y les manda secuencia de reactivación",
      "Envía newsletter mensual con promociones estacionales y nuevos tratamientos",
      "Te sugiere a qué cliente reescribir antes de que se enfríe",
    ],
  },
  {
    funcion: "Instagram y redes",
    emoji: "📱",
    codename: "DELTA-M5",
    color: "#FF7A59",
    titulo: "El sistema publica antes/después y contenido de valor",
    bullets: [
      "Posts semanales en Instagram y TikTok: resultados, tips de skincare, tendencias",
      "Genera copy con hashtags optimizados para tu zona y sector",
      "Tú apruebas con un click — nunca publica sin verlo antes",
    ],
  },
];

const esteticaPains = [
  { stat: "35%", text: "de clientes con bono comprado que no completan sus sesiones", icon: "🎟️" },
  { stat: "40%", text: "de consultas por WhatsApp llegan fuera de horario sin respuesta", icon: "📱" },
  { stat: "3 meses", text: "tiempo medio que un cliente tarda en volver sin recordatorio", icon: "📅" },
  { stat: "Instagram", text: "sin publicar hace semanas mientras tu competencia crece a diario", icon: "📸" },
  { stat: "Google", text: "estancado en pocas reseñas por falta de solicitud activa tras cada visita", icon: "⭐" },
  { stat: "Recepción", text: "saturada entre llamadas, caja, preparación de cabinas y atención presencial", icon: "📞" },
];

const esteticaDay = [
  { hora: "08:00", funcion: "Correo y agenda 📬", text: "Bandeja procesada: 1 pedido de proveedor pendiente, 3 consultas de clientes, 8 promos archivadas. Solo ves lo urgente." },
  { hora: "08:30", funcion: "El sistema se adelanta ⚡", text: "Te recuerda las citas del día y avisa de 2 leads de la noche que aún esperan respuesta. Antes de que te enteres, ya están contestados." },
  { hora: "09:30", funcion: "WhatsApp 💬", text: "Ha contestado los WhatsApps de la noche: presupuestos de láser, una consulta de botox y varias reservas de facial. Todo agendado." },
  { hora: "11:00", funcion: "Llamadas 📞", text: "Coge la llamada mientras estás en cabina. La clienta pregunta por mesoterapia capilar. El sistema le da precio, disponibilidad y cierra cita." },
  { hora: "13:30", funcion: "Reseñas de Google ⭐", text: "Entra una reseña 5★ tras una sesión de la mañana. El sistema la responde con tu tono en menos de un minuto." },
  { hora: "16:00", funcion: "Email marketing ✉️", text: "Detecta clientes con bonos a punto de caducar y te sugiere a quién reescribir. Lanza la secuencia de reactivación con tu visto bueno." },
  { hora: "18:00", funcion: "Instagram y redes 📱", text: "Publica el Reel de antes/después que aprobaste esta mañana. Tú no has tocado nada." },
  { hora: "22:00", funcion: "WhatsApp 💬", text: "«¿Tenéis hueco mañana para limpieza facial?» — El sistema responde, ofrece dos huecos y confirma reserva. Tú ya estás en casa." },
];

const esteticaPlan = {
  base: {
    name: "Sistema Operativo",
    priceFounder: "149",
    priceRegular: "299",
    tagline: "El sistema completo que lleva tu clínica: un único sistema integrado, no herramientas sueltas.",
    incluye: [
      "WhatsApp que responde y agenda 24/7",
      "Llamadas atendidas mientras estás en cabina",
      "Reseñas de Google: las pide y las responde",
      "Correo y agenda procesados cada mañana",
      "Email marketing que reactiva bonos sin usar",
      "Instagram y redes con tu tono (tú apruebas)",
      "Se adelanta solo: avisa de leads sin responder y de las citas del día",
    ],
    cta: "Pide tu demo",
  },
  addon: {
    name: "Gestión",
    priceMonthly: "249",
    tagline: "Opcional. Nos encargamos nosotros de la puesta a punto y el día a día.",
    incluye: [
      "Configuración y entrenamiento continuo del sistema",
      "Revisión y mejora mensual de campañas y respuestas",
      "Soporte prioritario y supervisión humana",
    ],
    cta: "Pide tu demo",
  },
};

const esteticaFAQ = [
  {
    q: "¿Sustituye a mi recepcionista?",
    a: "No. La complementa. Tu recepcionista deja de contestar WhatsApps a las 22h, perseguir reseñas y publicar en redes para centrarse en la atención presencial y el cierre de tratamientos. El sistema le quita la mayor parte del trabajo digital.",
  },
  {
    q: "¿Es compatible con Timely, Treatwell, Fresha o Booksy?",
    a: "Sí, vivimos al lado, no dentro. El sistema trabaja con tu calendario de Google o Cal.com. Cuando se agenda una cita, tu recepcionista la confirma en tu software de gestión en 30 segundos. Las integraciones directas con los principales softwares de belleza están en desarrollo para Q4 2026.",
  },
  {
    q: "¿Cómo gestiona consultas sobre contraindicaciones o tratamientos médicos?",
    a: "El sistema está entrenado para responder solo lo que tú le indiques. Las preguntas sobre contraindicaciones específicas (embarazo, medicación, patologías) las escala automáticamente: le dice al cliente que una especialista le llama en breve y te avisa a ti. Nunca improvisa sobre salud.",
  },
  {
    q: "¿Puedo publicar antes/después en Instagram sin problemas legales?",
    a: "El sistema genera el contenido pero tú lo apruebas siempre antes de publicar. El consentimiento del cliente para usar su imagen es responsabilidad tuya — te recomendamos un formulario firmado en cabina. El sistema nunca publica sin tu aprobación.",
  },
  {
    q: "¿Qué pasa con la RGPD y los datos de mis clientes?",
    a: "Los datos sensibles de salud (historial, tratamientos, fotos clínicas) nunca salen de tu software de gestión. El sistema gestiona solo el canal de comunicación. Servidores en la UE, cifrado en tránsito, contrato de encargado de tratamiento RGPD firmado al alta.",
  },
  {
    q: "¿Cuánto tiempo tarda en estar operativo?",
    a: "Setup de 15 minutos en videollamada: conectamos tu WhatsApp Business y Gmail. El sistema aprende tu catálogo de tratamientos, precios y tono en ese mismo momento. En 24 horas ya está contestando solo.",
  },
  {
    q: "¿En cuánto tiempo se notan resultados?",
    a: "Semana 1: WhatsApp y llamadas operativos, 0 consultas sin contestar. Semana 2-3: primeras reseñas nuevas. Mes 1: el sistema reactiva los primeros clientes inactivos. Mes 2-3: la agenda se llena con menos huecos vacíos. La activación es por fases, así que cada semana suma una capacidad más.",
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
              <span className="bg-[color:var(--red)] text-white px-2 py-1 font-bold tracking-widest">● ACTIVACIÓN POR FASES</span>
            </div>

            <h1 className="font-stencil text-3xl sm:text-5xl md:text-7xl lg:text-8xl leading-[1.05]">
              <span className="block">UN CENTRO.</span>
              <span className="block">UN</span>
              <span className="block">SISTEMA.</span>
              <span className="inline-block barred mt-4 px-3 py-1">UN SUELDO.</span>
            </h1>

            <p className="mt-8 font-display text-2xl sm:text-3xl md:text-4xl leading-tight">
              El sistema operativo que lleva tu clínica estética<br />
              <span className="text-[color:var(--mustard)]">entero, no a trozos</span>
            </p>

            <p className="mt-8 text-base md:text-lg max-w-2xl mx-auto text-white/80 leading-relaxed">
              No son herramientas sueltas: es un único sistema integrado que lleva el negocio.
              Mientras estás en cabina, contesta el WhatsApp de la clienta que pregunta por láser.
              Mientras cierras el día, reactiva a las clientas con bono sin usar.
              Mientras duermes, responde la reseña nueva de Google.
              <span className="block mt-2 font-bold text-white">Y se adelanta: te avisa de los leads sin responder y te recuerda las citas del día.</span>
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="#waitlist-estetica" className="btn-mustard text-lg">Pide tu demo →</a>
              <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer"
                className="text-sm font-mono border border-white/30 text-white/80 px-8 py-3 hover:border-white hover:text-white transition-all duration-200">
                Ver demo en vivo →
              </a>
            </div>
            <p className="mt-4 text-xs text-white/35 tracking-widest font-mono">
              DESDE 149 €/MES (FUNDADOR) · OPERATIVO EN 24H · 6 MESES SIN TARJETA
            </p>
            <p className="mt-6 font-display text-lg sm:text-xl text-[color:var(--mustard)] max-w-2xl mx-auto leading-tight">
              Mientras otros esperan a que les escribas, tu sistema ya actuó.
            </p>
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-5 pb-12">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 md:gap-3">
              {esteticaFunciones.map((f) => (
                <div key={f.funcion} className="relative border-2 border-white/20 overflow-hidden group hover:border-white/60 transition-all duration-200" style={{ background: f.color }}>
                  <div className="w-full aspect-square flex items-center justify-center text-4xl md:text-5xl">{f.emoji}</div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white px-2 py-1 font-stencil text-[10px] md:text-xs text-center leading-tight">
                    {f.funcion.toUpperCase()}
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
            <p className="text-lg max-w-2xl mb-4 text-black/70">
              6 fricciones operativas que tiene cualquier centro de estética. Cada una tiene un coste directo en ingresos.
            </p>
            <p className="text-base max-w-2xl mb-12 font-bold text-[color:var(--red)]">
              Tus competidores ya están automatizados y tus clientes esperan respuesta al instante. Sin un sistema así hoy, te quedas fuera.
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
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">FUNCIONES DEL SISTEMA</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">
              Un sistema.<br />Todas las funciones.
            </h2>
            <p className="text-lg max-w-2xl mb-14 text-black/70">
              No son herramientas sueltas: es un único sistema integrado, entrenado para centros de estética, que cubre cada canal de forma autónoma. La activación es por fases.
            </p>
            <div className="grid md:grid-cols-2 gap-8">
              {esteticaFunciones.map((f) => (
                <article key={f.funcion} className="dossier pt-12 p-6 relative overflow-hidden">
                  <div className="absolute top-1 left-4 right-4 flex items-center justify-between z-10 text-white text-[11px] font-mono tracking-widest">
                    <span>EXP. {f.codename}</span>
                    <span className="hidden sm:inline">· ESTÉTICA ·</span>
                  </div>
                  <div className="flex items-start gap-5 relative">
                    <div className="relative w-28 h-28 border-[3px] border-black overflow-hidden shrink-0 flex items-center justify-center" style={{ background: f.color }}>
                      <span className="text-6xl">{f.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-stencil text-3xl sm:text-4xl">{f.funcion}</h3>
                      <p className="text-sm uppercase tracking-wider font-semibold text-black/60">Función del sistema</p>
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

        {/* DÍA TIPO */}
        <section className="py-24 border-t-[3px] border-black bg-[color:var(--mustard)]">
          <div className="max-w-4xl mx-auto px-5">
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono mb-6">
              <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">DIARIO DE OPERACIONES</span>
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] bg-white px-2 py-1 font-bold tracking-widest">24H · TURNO COMPLETO</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4 leading-[1]">El sistema<br />en operación</h2>
            <p className="text-lg max-w-2xl mb-12 text-black/70">
              Esto es lo que ocurre en un centro de estética con el sistema activo. Se adelanta solo, sin que toques nada.
            </p>
            <ul className="space-y-3">
              {esteticaDay.map((d) => (
                <li key={d.hora} className="card-hard p-4 flex items-start gap-4">
                  <div className="font-stencil text-2xl text-[color:var(--red)] w-20 shrink-0">{d.hora}</div>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{d.funcion}</div>
                    <p className="text-sm text-black/70 mt-1">{d.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-10 font-display text-2xl md:text-3xl leading-tight text-black">
              Si tu software solo responde cuando le hablas, vive en los 90.
            </p>
          </div>
        </section>

        {/* COMPARATIVA */}
        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-5xl mx-auto px-5">
            <div className="flex items-center gap-2 mb-8 text-[10px] font-mono tracking-[0.2em]">
              <span className="bg-black text-[color:var(--mustard)] px-3 py-1 font-bold">ANÁLISIS COMPARATIVO</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-6xl mb-4 leading-tight">
              El sistema vs<br />equipo interno
            </h2>
            <p className="text-base text-black/40 mb-3 font-mono">Misma capacidad operativa. Fracción del coste. Sin gestión de personas.</p>
            <p className="text-base font-bold text-[color:var(--red)] mb-12">Automatización de verdad, no la de hace diez años.</p>
            <div className="border-[3px] border-black overflow-hidden">
              <div className="grid grid-cols-3 text-xs font-mono tracking-widest bg-black text-white">
                <div className="p-4">CAPACIDAD</div>
                <div className="p-4 text-center bg-[color:var(--mustard)] text-black">AI-TEAM</div>
                <div className="p-4 text-center text-white/50">RECEP. + CM</div>
              </div>
              {[
                ["Coste mensual", "Desde 149 €", "1.400–2.200 €"],
                ["Horario", "24/7 inc. fines de semana", "Lun-Vie 9-18h"],
                ["WhatsApp fuera de horario", "Responde siempre", "Sin cobertura"],
                ["Llamadas en cabina", "El sistema lo gestiona", "Buzón o pérdida"],
                ["Reseñas Google", "Solicita y responde solo", "Nunca hay tiempo"],
                ["Posts Instagram", "Con tu tono, tú apruebas", "1-2/sem genéricos"],
                ["Reactivación bonos sin usar", "Secuencia automática", "No"],
                ["Se adelanta (leads, citas)", "Te avisa solo", "Solo si te acuerdas"],
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
              <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">SOLO 20 PLAZAS</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Un sistema.<br />Un precio.</h2>
            <p className="text-lg max-w-2xl mb-12 text-black/70">
              La misma operación que un equipo de 1.400–2.200 €/mes. Un único sistema integrado, no herramientas sueltas. Sin nóminas, sin contratos, sin fricciones de gestión.
            </p>
            <div className="grid sm:grid-cols-2 gap-5 max-w-3xl">
              {/* PRODUCTO BASE */}
              <article className="card-hard p-6 flex flex-col relative bg-[color:var(--mustard)]">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[color:var(--red)] text-white text-xs font-bold tracking-widest px-3 py-1 border-2 border-black">
                  ★ EL SISTEMA
                </div>
                <div className="font-stencil text-3xl mb-1">{esteticaPlan.base.name}</div>
                <p className="text-xs text-black/60 leading-tight mb-5">{esteticaPlan.base.tagline}</p>
                <div className="mb-5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-stencil text-5xl">{esteticaPlan.base.priceFounder}</span>
                    <span className="text-sm font-bold">€/mes</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-black/50 line-through">{esteticaPlan.base.priceRegular} €</span>
                    <span className="text-[10px] font-bold tracking-widest bg-[color:var(--red)] text-white px-1.5 py-0.5">FUNDADOR · 50%</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-6 text-sm flex-1">
                  {esteticaPlan.base.incluye.map((a) => (
                    <li key={a} className="flex items-start gap-2">
                      <span className="text-[color:var(--red)] font-bold">▸</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
                <a href="#waitlist-estetica" className="btn-mustard text-xs text-center block">{esteticaPlan.base.cta}</a>
              </article>

              {/* ADD-ON OPCIONAL */}
              <article className="card-hard p-6 flex flex-col relative bg-white">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-[color:var(--mustard)] text-xs font-bold tracking-widest px-3 py-1 border-2 border-black">
                  + OPCIONAL
                </div>
                <div className="font-stencil text-3xl mb-1">{esteticaPlan.addon.name}</div>
                <p className="text-xs text-black/60 leading-tight mb-5">{esteticaPlan.addon.tagline}</p>
                <div className="mb-5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-stencil text-5xl">+{esteticaPlan.addon.priceMonthly}</span>
                    <span className="text-sm font-bold">€/mes</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold tracking-widest bg-black text-[color:var(--mustard)] px-1.5 py-0.5">SE SUMA AL SISTEMA</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-6 text-sm flex-1">
                  {esteticaPlan.addon.incluye.map((a) => (
                    <li key={a} className="flex items-start gap-2">
                      <span className="text-[color:var(--red)] font-bold">▸</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
                <a href="#waitlist-estetica" className="btn-mustard text-xs text-center block">{esteticaPlan.addon.cta}</a>
              </article>
            </div>
            <p className="text-center text-xs text-black/50 mt-8 font-mono uppercase tracking-widest">
              6 meses de prueba · cancela en un click · sin permanencia · precio fundador para siempre
            </p>
            <p className="text-center text-sm text-black/60 mt-4">
              ¿Necesitas multiusuario o soporte prioritario?{" "}
              <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-[color:var(--red)]">Hablar con ventas →</a>
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
      <Footer />
    </>
  );
}
