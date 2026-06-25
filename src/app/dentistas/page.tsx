import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DentalCTA from "@/components/dental/DentalCTA";
import ROICalc from "@/components/dental/ROICalc";

export const metadata = {
  title: "AI-Team — El sistema operativo para tu clínica dental",
  description:
    "Un único sistema integrado que lleva tu clínica: contesta WhatsApps 24/7, coge llamadas, pide reseñas y se adelanta. No herramientas sueltas, un sistema que opera tu clínica. Para clínicas de 1-3 dentistas.",
};

const dentalPains = [
  { stat: "30%", text: "no-shows: 3 de cada 10 citas se caen sin avisar", icon: "📅" },
  { stat: "40%", text: "de presupuestos sin cerrar por falta de seguimiento", icon: "💸" },
  { stat: "6 meses", text: "tiempo medio que un paciente lleva sin volver a tu clínica", icon: "👋" },
  { stat: "WhatsApp", text: "saturado: 50+ mensajes sin contestar al final del día", icon: "📱" },
  { stat: "Google", text: "reseñas nuevas sin responder durante semanas", icon: "⭐" },
  { stat: "Recepción", text: "no da abasto entre llamadas, citas y caja", icon: "📞" },
];

// Funciones del sistema (sin caras, sin nombres de personaje): el sistema es uno solo,
// integrado, y cada función es una capacidad del mismo sistema.
const dentalSystem: { emoji: string; funcion: string; titulo: string; bullets: string[] }[] = [
  {
    emoji: "💬",
    funcion: "WhatsApp",
    titulo: "El sistema agenda urgencias por WhatsApp",
    bullets: [
      "«Me duele una muela» a las 23h sábado → el sistema responde al instante",
      "Ofrece huecos disponibles, recoge nombre + síntoma + foto si la mandan",
      "Tu recepcionista lo confirma al día siguiente en Gesden / Clinic Cloud",
    ],
  },
  {
    emoji: "📞",
    funcion: "Llamadas",
    titulo: "El sistema coge llamadas mientras operas",
    bullets: [
      "Habla español e inglés (turismo dental, pacientes internacionales)",
      "Da horarios, agenda primeras visitas, pasa recados de urgencia",
      "Nunca cuelga de mal humor, nunca tiene un mal día",
    ],
  },
  {
    emoji: "⭐",
    funcion: "Reseñas de Google",
    titulo: "El sistema sube tu Google a base de reseñas",
    bullets: [
      "Tras cada cita, manda WhatsApp pidiendo reseña al paciente contento",
      "Cuando llega una nueva, redacta respuesta con tu tono al momento",
      "Objetivo: que tu ficha de Google suba mes a mes, sin que tú gestiones nada",
    ],
  },
  {
    emoji: "📬",
    funcion: "Correo y agenda",
    titulo: "El sistema limpia tu correo y agenda",
    bullets: [
      "Cada mañana te resume la bandeja: urgente, importante, ignorable",
      "Borradores listos en tu Gmail para proveedores, presupuestos, reclamaciones",
      "Te recupera tiempo que ya no pierdes en email cada día",
    ],
  },
  {
    emoji: "✉️",
    funcion: "Email marketing",
    titulo: "El sistema recupera pacientes inactivos",
    bullets: [
      "Detecta pacientes que llevan meses sin venir",
      "Manda secuencia de email cariñosa: «hola María, ¿cómo va tu sonrisa?»",
      "Convierte parte de tus inactivos en citas, mes a mes, sin que tú muevas un dedo",
    ],
  },
  {
    emoji: "📱",
    funcion: "Instagram y redes",
    titulo: "El sistema publica antes/después en Instagram",
    bullets: [
      "Posts cada semana: casos de éxito (con consentimiento), mitos, consejos",
      "Carruseles educativos sobre blanqueamiento, ortodoncia, implantes",
      "Genera la imagen y el copy. Tú apruebas con un click.",
    ],
  },
];

const dentalDay = [
  { hora: "08:00", funcion: "Correo y agenda", text: "Te resume la bandeja: 1 urgencia (paciente con dolor), 3 presupuestos pendientes, 12 promos archivadas." },
  { hora: "09:00", funcion: "WhatsApp", text: "Contesta los WhatsApps de pacientes que escribieron de noche y agenda las primeras citas del día." },
  { hora: "11:00", funcion: "Llamadas", text: "Coge la llamada de un turista británico. Le da horarios en inglés, agenda primera visita." },
  { hora: "13:30", funcion: "Reseñas de Google", text: "Un paciente te deja una reseña. El sistema la responde con tu tono al momento." },
  { hora: "16:00", funcion: "Email marketing", text: "Manda el email semanal a tus pacientes inactivos. Algunos contestan pidiendo cita." },
  { hora: "18:00", funcion: "Instagram y redes", text: "Sube por su cuenta el post programado: «3 mitos sobre el blanqueamiento»." },
  { hora: "21:00", funcion: "WhatsApp", text: "Te llega «me duele mucho»: el sistema responde y te avisa al móvil de que es una urgencia real." },
];

const dentalPacks = [
  {
    name: "Sistema Operativo",
    priceFounder: "149",
    priceRegular: "299",
    tagline: "Un único sistema integrado que lleva tu clínica. Todas las funciones, no herramientas sueltas.",
    agents: [
      "WhatsApp 24/7 (urgencias y citas)",
      "Llamadas en español e inglés",
      "Reseñas de Google (pide y responde)",
      "Correo y agenda cada mañana",
      "Email marketing (recupera inactivos)",
      "Instagram y redes con tu tono",
      "Se adelanta: te avisa, recuerda y sugiere (en activación por fases)",
    ],
    cta: "Pide tu demo",
    featured: true,
  },
  {
    name: "Gestión (opcional)",
    priceFounder: "+249",
    priceRegular: "—",
    tagline: "¿Prefieres que lo llevemos por ti? Se suma al Sistema Operativo, no lo incluye.",
    agents: [
      "Lo configuramos y lo operamos por ti",
      "Revisamos resultados y afinamos cada función",
      "Tú solo apruebas; nosotros ejecutamos",
      "Soporte prioritario directo",
    ],
    cta: "Pide tu demo",
  },
];

const dentalFAQ = [
  {
    q: "¿Sustituye a mi recepcionista?",
    a: "No. La complementa. Tu recepcionista deja de hacer las tareas que la queman (contestar WhatsApps a las 22h, perseguir reseñas, responder mil veces lo mismo) y se centra en lo que hace bien: trato cara a cara con el paciente en consulta y cierre de presupuestos en persona. AI-Team le quita el 60-70% del trabajo digital, no su puesto.",
  },
  {
    q: "¿Es compatible con Gesden / Clinic Cloud / Dentalink / Odontonet / Flowww?",
    a: "Sí, vivimos al lado, no dentro. El sistema trabaja sobre tu calendario (Google Calendar o Cal.com paralelo) y tu WhatsApp Business. Cuando el sistema agenda una cita, tu recepcionista la confirma en tu software dental en segundos. Estamos preparando integraciones nativas con los principales (Gesden y Clinic Cloud primero).",
  },
  {
    q: "¿Qué pasa con la LOPD y los datos de los pacientes?",
    a: "Los datos sensibles (historial, diagnósticos, radiografías) NUNCA salen de tu software dental. El sistema solo gestiona el canal de comunicación (WhatsApp, llamadas, email). Servidores en la UE, cifrado en tránsito, contrato de encargado de tratamiento RGPD firmado al alta.",
  },
  {
    q: "¿Cómo gestiona urgencias dentales reales (sangrado, hinchazón, fiebre)?",
    a: "El sistema está entrenado para reconocer urgencias reales. Si detecta palabras clave (sangrado abundante, hinchazón con fiebre, golpe con pieza partida), te avisa al móvil personal con notificación push y mensaje de WhatsApp directo. Y al paciente le dice exactamente qué hacer mientras te localiza.",
  },
  {
    q: "¿Y si el paciente quiere hablar con una persona?",
    a: "El sistema escala automáticamente cuando el paciente lo pide explícitamente o cuando detecta queja, ansiedad o caso complejo. Le dice «un humano del equipo te llama enseguida» y te lo deja en bandeja con resumen del caso.",
  },
  {
    q: "¿Necesito tener WhatsApp Business para que funcione?",
    a: "Sí, gratis (lo descargas en el móvil). Idealmente con un número dedicado a la clínica (no tu personal) — te ayudamos a montarlo en el setup. Para auto-respuesta 24/7 oficial sin riesgo, vamos a verificarte como WhatsApp Business API con Meta (papeleo breve, lo hacemos juntos).",
  },
  {
    q: "¿En cuánto tiempo veo resultados?",
    a: "Desde la primera semana el sistema ya contesta WhatsApps y coge llamadas. En las semanas siguientes empiezan a llegar las primeras reseñas y vuelven los primeros pacientes inactivos. El objetivo es que, mes a mes, tu agenda se llene con menos hueco y tu ficha de Google suba. (Estimación objetivo, no garantía.)",
  },
];

export default function DentistasPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* HERO */}
        <section className="brick relative overflow-hidden border-b-[6px] border-[color:var(--red)]">
          <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-28 z-10 text-center text-white">
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono mb-8">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">EXPEDIENTE M-DENTAL</span>
              <span className="border-2 border-white text-white px-2 py-1 font-bold tracking-widest">CLASIFICADO</span>
              <span className="bg-[color:var(--red)] text-white px-2 py-1 font-bold tracking-widest">MISIÓN ACTIVA</span>
            </div>

            <h1 className="font-stencil text-3xl sm:text-5xl md:text-7xl lg:text-8xl leading-[1.05]">
              <span className="block">UNA CLÍNICA.</span>
              <span className="block">UN</span>
              <span className="block">SISTEMA.</span>
              <span className="inline-block barred mt-4 px-3 py-1">QUE LO LLEVA TODO.</span>
            </h1>

            <p className="mt-8 font-display text-2xl sm:text-3xl md:text-5xl leading-tight">
              El sistema operativo que tu clínica dental<br />
              <span className="text-[color:var(--mustard)]">necesita y no puedes contratar</span>
            </p>

            <p className="mt-8 text-base md:text-lg max-w-2xl mx-auto text-white/85">
              No son herramientas sueltas ni empleados a media jornada: es un único sistema integrado que opera tu clínica.
              Mientras tú estás operando, el sistema contesta el WhatsApp del paciente con dolor.
              Mientras revisas radiografías, coge la llamada del nuevo paciente.
              Mientras cierras la clínica, recupera al paciente que llevaba meses sin venir.
              <span className="block mt-2 font-bold text-white">Tú vuelves a operar tranquilo. El sistema hace lo demás.</span>
            </p>

            <p className="mt-6 inline-block barred font-display text-lg md:text-2xl px-3 py-1">
              Tener web ya no basta: tus pacientes esperan respuesta ya.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3">
              <a href="#waitlist-dental" className="btn-mustard text-lg">Pide tu demo →</a>
              <p className="text-sm text-white/60">20 plazas · 6 meses gratis · sin tarjeta · 149€/mes fundador congelado de por vida</p>
            </div>
          </div>
        </section>

        {/* DOLOR DENTAL */}
        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-6 text-xs font-mono">
              <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">DIAGNÓSTICO</span>
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">DOLORES REALES</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">¿Te suena?</h2>
            <p className="text-lg max-w-2xl mb-12 text-black/70">
              6 cosas que pasan en toda clínica dental de 1-3 dentistas. Cada una te cuesta dinero. Mucho.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {dentalPains.map((p) => (
                <article key={p.text} className="card-hard p-6">
                  <div className="text-4xl mb-3">{p.icon}</div>
                  <div className="font-stencil text-3xl text-[color:var(--red)] mb-1">{p.stat}</div>
                  <p className="text-sm leading-relaxed">{p.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* AGENTES PARA CLÍNICA */}
        <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-6 text-xs font-mono">
              <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">DOSSIER M-DENTAL</span>
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">UNIDAD ASIGNADA</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">
              Un sistema,<br />todas las funciones
            </h2>
            <p className="text-lg max-w-2xl mb-14 text-black/70">
              No son piezas sueltas: es un único sistema integrado, entrenado para clínica dental de 1-3 dentistas. No genérico.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              {dentalSystem.map((f, idx) => (
                <article key={f.funcion} className="dossier pt-12 p-6 relative overflow-hidden">
                  <div className="absolute top-1 left-4 right-4 flex items-center justify-between z-10 text-white text-[11px] font-mono tracking-widest">
                    <span>FUNCIÓN {String(idx + 1).padStart(2, "0")}</span>
                    <span className="hidden sm:inline">· DENTAL ·</span>
                  </div>
                  <div className="flex items-start gap-5 relative">
                    <div className="relative w-28 h-28 border-[3px] border-black overflow-hidden shrink-0 bg-[color:var(--mustard)] flex items-center justify-center">
                      <span className="text-6xl">{f.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-stencil text-3xl sm:text-4xl">{f.funcion}</h3>
                      <p className="text-sm uppercase tracking-wider font-semibold text-black/60">
                        Función del sistema
                      </p>
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

        {/* DÍA DENTAL */}
        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-4xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-6 text-xs font-mono">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">REGISTRO DEL DÍA</span>
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">CLÍNICA TIPO</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">
              Un día en misión
            </h2>
            <p className="text-lg max-w-2xl mb-12 text-black/70">
              Esto es lo que pasa en una clínica dental con el sistema operativo trabajando. Sin que tú toques nada.
            </p>

            <ul className="space-y-3">
              {dentalDay.map((d, i) => (
                <li key={`${d.hora}-${i}`} className="card-hard p-4 flex items-start gap-4">
                  <div className="font-stencil text-2xl text-[color:var(--red)] w-20 shrink-0">{d.hora}</div>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{d.funcion}</div>
                    <p className="text-sm text-black/70 mt-1">{d.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* SISTEMA PROACTIVO (PROMESA · EN ACTIVACIÓN POR FASES) */}
        <section className="py-24 border-t-[3px] border-black bg-black text-[color:var(--cream)]">
          <div className="max-w-4xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-6 text-xs font-mono flex-wrap">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">NO ESPERA ÓRDENES</span>
              <span className="border-2 border-white text-white px-2 py-1 font-bold tracking-widest">EN ACTIVACIÓN POR FASES</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">
              El sistema<br />se adelanta
            </h2>
            <p className="text-lg max-w-2xl mb-12 text-white/70">
              Mientras otros esperan a que les escribas, tu sistema ya actuó. Esto es lo que va a hacer por su cuenta, sin que se lo pidas (lo activamos contigo por fases):
            </p>
            <div className="grid sm:grid-cols-2 gap-5">
              <article className="card-hard p-6 text-black bg-[color:var(--cream)]">
                <div className="text-4xl mb-3">⏱️</div>
                <p className="text-sm leading-relaxed font-semibold">Te avisa de los leads sin responder antes de que se enfríen.</p>
              </article>
              <article className="card-hard p-6 text-black bg-[color:var(--cream)]">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-sm leading-relaxed font-semibold">Te recuerda las citas del día y quién falta por confirmar.</p>
              </article>
              <article className="card-hard p-6 text-black bg-[color:var(--cream)]">
                <div className="text-4xl mb-3">📱</div>
                <p className="text-sm leading-relaxed font-semibold">Publica en Instagram por su cuenta, en los días que toca.</p>
              </article>
              <article className="card-hard p-6 text-black bg-[color:var(--cream)]">
                <div className="text-4xl mb-3">✍️</div>
                <p className="text-sm leading-relaxed font-semibold">Te sugiere a qué paciente reescribir para llenar huecos de agenda.</p>
              </article>
            </div>
            <p className="text-xs text-white/50 mt-6 font-mono uppercase tracking-widest">
              Promesa del sistema · funciones en activación por fases, no todas activas al 100% desde el día uno
            </p>
          </div>
        </section>

        {/* COMPARATIVA */}
        <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-5xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-6 text-xs font-mono">
              <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">COMPARATIVA</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">
              El sistema vs<br />recepcionista + community manager
            </h2>
            <p className="text-lg max-w-2xl mb-12 text-black/70">
              Automatización de verdad, no la de hace diez años. Un sistema que opera tu clínica, no dos contrataciones a media jornada.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="border-2 border-black p-3 text-left">Capacidad</th>
                    <th className="border-2 border-black p-3 bg-[color:var(--mustard)] text-black">El sistema</th>
                    <th className="border-2 border-black p-3">Recepcionista (28h/sem)</th>
                    <th className="border-2 border-black p-3">+ Community Manager freelance</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Coste mes", "149€/mes (fundador)", "1.200€", "+400-800€"],
                    ["Horario", "24/7 incluido sábados y domingos", "Lun-Vie 9-18h", "Solo entregas"],
                    ["WhatsApp en vacaciones", "Contesta igual", "Nadie", "Nada"],
                    ["Llamadas nuevas", "Coge todas", "Si está libre", "No coge"],
                    ["Reseñas Google", "Pide y responde solo", "Nunca le da tiempo", "No es su trabajo"],
                    ["Posts Instagram", "3/sem con tu tono", "No es su trabajo", "1-2/sem genéricos"],
                    ["Recuperar pacientes inactivos", "Email auto cada mes", "No tiene tiempo", "No"],
                    ["Días enfermo / vacaciones", "0 (no se enferma)", "20-30 días/año", "Variables"],
                    ["Setup", "10 min con onboarding", "1-3 meses formación", "1-2 semanas"],
                  ].map(([cap, ai, rec, cm]) => (
                    <tr key={cap} className="bg-white">
                      <td className="border-2 border-black p-3 font-bold">{cap}</td>
                      <td className="border-2 border-black p-3 bg-[color:var(--mustard)]/30 font-bold">{ai}</td>
                      <td className="border-2 border-black p-3">{rec}</td>
                      <td className="border-2 border-black p-3">{cm}</td>
                    </tr>
                  ))}
                  <tr className="bg-[color:var(--red)] text-white font-bold">
                    <td className="border-2 border-black p-3">TOTAL/mes</td>
                    <td className="border-2 border-black p-3 bg-[color:var(--mustard)] text-black">149€/mes (fundador)</td>
                    <td className="border-2 border-black p-3" colSpan={2}>1.600 - 2.000 €</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* PRICING DENTAL */}
        <section className="py-24 border-t-[3px] border-black bg-white">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-6 text-xs font-mono flex-wrap">
              <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">PRECIOS FUNDADORES DENTAL</span>
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">20 PLAZAS · 6 MESES GRATIS</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Un sistema, un precio</h2>
            <p className="text-lg max-w-2xl mb-4 text-black/70">
              Sin un sistema así hoy, te quedas fuera: tus competidores ya están automatizados y los pacientes esperan respuesta al instante. Si no la das, los pierdes.
            </p>
            <p className="text-lg max-w-2xl mb-12 text-black/70">
              Una clínica media pierde dinero cada mes en citas que se caen, presupuestos no cerrados y pacientes que no vuelven. El sistema cuesta una fracción.
            </p>

            <div className="grid sm:grid-cols-2 gap-5 max-w-3xl">
              {dentalPacks.map((p) => (
                <article key={p.name} className={`card-hard p-6 flex flex-col relative ${p.featured ? "bg-[color:var(--mustard)]" : "bg-white"}`}>
                  {p.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[color:var(--red)] text-white text-xs font-bold tracking-widest px-3 py-1 border-2 border-black">
                      ★ EL SISTEMA
                    </div>
                  )}
                  <div className="font-stencil text-3xl mb-1">{p.name}</div>
                  <p className="text-xs text-black/60 leading-tight mb-5">{p.tagline}</p>
                  <div className="mb-5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-stencil text-5xl">{p.priceFounder}</span>
                      <span className="text-sm font-bold">€/mes</span>
                    </div>
                    {p.featured ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-black/50 line-through">{p.priceRegular} €</span>
                        <span className="text-[10px] font-bold tracking-widest bg-[color:var(--red)] text-white px-1.5 py-0.5">FUNDADOR -50% · CONGELADO DE POR VIDA</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold tracking-widest bg-black text-white px-1.5 py-0.5">SE SUMA AL SISTEMA · NO INCLUIDO</span>
                      </div>
                    )}
                  </div>
                  <ul className="space-y-2 mb-6 text-sm flex-1">
                    {p.agents.map((a) => (
                      <li key={a} className="flex items-start gap-2">
                        <span className="text-[color:var(--red)] font-bold">▸</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="#waitlist-dental" className="btn-mustard text-xs text-center block">{p.cta}</a>
                </article>
              ))}
            </div>
            <p className="text-center text-xs text-black/50 mt-8 font-mono uppercase tracking-widest">
              20 plazas fundadoras · 6 meses gratis sin tarjeta · precio fundador congelado de por vida · cancelas en un click
            </p>
            <p className="text-center text-sm text-black/60 mt-4">
              ¿Necesitas multiusuario o soporte prioritario?{" "}
              <a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-[color:var(--red)]">Hablar con ventas →</a>
            </p>
          </div>
        </section>

        {/* FAQ DENTAL */}
        <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="font-stencil text-5xl md:text-7xl text-center mb-12">
              FAQ Dental
            </h2>
            <div className="flex flex-col gap-4">
              {dentalFAQ.map((f, i) => (
                <details key={i} className="card-hard overflow-hidden bg-white group">
                  <summary className="cursor-pointer p-5 font-display text-xl md:text-2xl list-none flex items-center justify-between">
                    <span>{f.q}</span>
                    <span className="text-3xl group-open:rotate-45 transition">+</span>
                  </summary>
                  <div className="px-5 pb-5 border-t-2 border-black pt-4 text-black/80 leading-relaxed">
                    {f.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CALCULADORA ROI */}
        <ROICalc />

        {/* CTA FINAL DENTAL */}
        <DentalCTA />
      </main>
      <Footer />
    </>
  );
}
