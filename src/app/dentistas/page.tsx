import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { agents } from "@/lib/agents";
import DentalCTA from "@/components/dental/DentalCTA";
import ROICalc from "@/components/dental/ROICalc";

export const metadata = {
  title: "AI-Team para Clínicas Dentales — Pablo agenda, Carmen llama, Rocío sube tu Google",
  description:
    "El equipo de IA que tu clínica dental necesita y no puedes contratar. Reduce no-shows, contesta WhatsApps 24/7, sube reseñas. Para clínicas de 1-3 dentistas.",
};

const dentalPains = [
  { stat: "30%", text: "no-shows: 3 de cada 10 citas se caen sin avisar", icon: "📅" },
  { stat: "40%", text: "de presupuestos sin cerrar por falta de seguimiento", icon: "💸" },
  { stat: "6 meses", text: "tiempo medio que un paciente lleva sin volver a tu clínica", icon: "👋" },
  { stat: "WhatsApp", text: "saturado: 50+ mensajes sin contestar al final del día", icon: "📱" },
  { stat: "Google", text: "reseñas nuevas sin responder durante semanas", icon: "⭐" },
  { stat: "Recepción", text: "no da abasto entre llamadas, citas y caja", icon: "📞" },
];

const dentalAgents: Record<string, { titulo: string; bullets: string[] }> = {
  pablo: {
    titulo: "Pablo agenda urgencias por WhatsApp",
    bullets: [
      "«Me duele una muela» a las 23h sábado → Pablo responde en 12 segundos",
      "Ofrece 2 huecos disponibles, recoge nombre + síntoma + foto si la mandan",
      "Tu recepcionista lo confirma el lunes en Gesden / Clinic Cloud",
    ],
  },
  carmen: {
    titulo: "Carmen coge llamadas mientras operas",
    bullets: [
      "Habla español e inglés (turismo dental, expats Marbella)",
      "Da horarios, agenda primeras visitas, pasa recados de urgencia",
      "Nunca cuelga de mal humor, nunca tiene un mal día",
    ],
  },
  rocio: {
    titulo: "Rocío sube tu Google a base de reseñas",
    bullets: [
      "Tras cada cita, manda WhatsApp pidiendo reseña al paciente contento",
      "Cuando llega una nueva, redacta respuesta con tu tono en 30 segundos",
      "De 4.2★ a 4.7★ en 3 meses (caso piloto)",
    ],
  },
  lucia: {
    titulo: "Lucía limpia tu correo y agenda",
    bullets: [
      "Cada mañana te resume la bandeja: urgente, importante, ignorable",
      "Borradores listos en tu Gmail para proveedores, presupuestos, reclamaciones",
      "Te recupera 1-2h al día que ya no pierdes en email",
    ],
  },
  eva: {
    titulo: "Eva recupera pacientes inactivos",
    bullets: [
      "Detecta pacientes que llevan +6 meses sin venir",
      "Manda secuencia de email cariñosa: «hola María, ¿cómo va tu sonrisa?»",
      "Convierte 8-15% de inactivos en cita. Recupera 2.000-5.000€/mes.",
    ],
  },
  marta: {
    titulo: "Marta publica antes/después en Instagram",
    bullets: [
      "3 posts/semana: casos de éxito (con consentimiento), mitos, consejos",
      "Carruseles educativos sobre blanqueamiento, ortodoncia, implantes",
      "Genera la imagen y el copy. Tú apruebas con un click.",
    ],
  },
};

const dentalDay = [
  { hora: "08:00", agente: "Lucía", text: "Te resume la bandeja: 1 urgencia (paciente con dolor), 3 presupuestos pendientes, 12 promos archivadas." },
  { hora: "09:00", agente: "Pablo", text: "Contesta 4 WhatsApps de pacientes que escribieron de noche. Agenda 2 limpiezas." },
  { hora: "11:00", agente: "Carmen", text: "Coge llamada de turista británico. Le da horarios en inglés, agenda primera visita." },
  { hora: "13:30", agente: "Rocío", text: "María García te dejó reseña 5★. Rocío la responde con tu tono en 30 segundos." },
  { hora: "16:00", agente: "Eva", text: "Manda email semanal a 12 pacientes inactivos. 2 contestan pidiendo cita." },
  { hora: "18:00", agente: "Marta", text: "Sube post programado: «3 mitos sobre el blanqueamiento». 47 likes en la primera hora." },
  { hora: "21:00", agente: "Pablo", text: "Te llega «me duele mucho», Pablo responde, te avisa al móvil que es urgencia real." },
];

const dentalPacks = [
  {
    name: "Esencial Dental",
    priceFounder: "79",
    priceRegular: "129",
    tagline: "Para clínica de 1 dentista, sin recepcionista",
    agents: ["Pablo (WhatsApp urgencias)", "Carmen (llamadas)", "Rocío (reseñas Google)"],
    cta: "Empezar Esencial",
  },
  {
    name: "Crecimiento",
    priceFounder: "149",
    priceRegular: "249",
    tagline: "Para clínica de 1-2 dentistas con recepcionista saturada",
    agents: ["Los 3 anteriores", "+ Eva (recuperar pacientes inactivos)", "+ Lucía (limpiar correo)"],
    cta: "Quiero crecer",
    featured: true,
  },
  {
    name: "Élite Dental",
    priceFounder: "249",
    priceRegular: "449",
    tagline: "Para clínica 2-3 dentistas que quiere escalar",
    agents: ["Los 6 especialistas", "+ Onboarding personal 1:1", "+ Setup Gesden / Clinic Cloud / Dentalink", "+ WhatsApp directo conmigo"],
    cta: "Hablar conmigo",
  },
];

const dentalFAQ = [
  {
    q: "¿Sustituye a mi recepcionista?",
    a: "No. La complementa. Tu recepcionista deja de hacer las tareas que la queman (contestar WhatsApps a las 22h, perseguir reseñas, responder mil veces lo mismo) y se centra en lo que hace bien: trato cara a cara con el paciente en consulta y cierre de presupuestos en persona. AI-Team le quita el 60-70% del trabajo digital, no su puesto.",
  },
  {
    q: "¿Es compatible con Gesden / Clinic Cloud / Dentalink / Odontonet / Flowww?",
    a: "Sí, vivimos al lado, no dentro. Trabajamos sobre tu calendario (Google Calendar o Cal.com paralelo) y tu WhatsApp Business. Cuando Pablo agenda una cita, tu recepcionista la confirma en tu software dental en 30 segundos. Estamos preparando integraciones nativas con los principales (Gesden y Clinic Cloud primero, llegan Q3 2026).",
  },
  {
    q: "¿Qué pasa con la LOPD y los datos de los pacientes?",
    a: "Los datos sensibles (historial, diagnósticos, radiografías) NUNCA salen de tu software dental. AI-Team solo gestiona el canal de comunicación (WhatsApp, llamadas, email). Servidores en la UE, cifrado en tránsito, contrato de encargado de tratamiento RGPD firmado al alta.",
  },
  {
    q: "¿Cómo gestiona urgencias dentales reales (sangrado, hinchazón, fiebre)?",
    a: "Pablo está entrenado para reconocer urgencias reales. Si detecta palabras clave (sangrado abundante, hinchazón con fiebre, golpe con pieza partida), te avisa al móvil personal con notificación push y mensaje de WhatsApp directo. Y al paciente le dice exactamente qué hacer mientras te localiza.",
  },
  {
    q: "¿Y si el paciente quiere hablar con una persona?",
    a: "Pablo escala automáticamente cuando el paciente lo pide explícitamente o cuando detecta queja, ansiedad o caso complejo. Le dice «un humano del equipo te llama en 1 hora» y te lo deja en bandeja con resumen del caso.",
  },
  {
    q: "¿Necesito tener WhatsApp Business para que funcione Pablo?",
    a: "Sí, gratis (lo descargas en el móvil). Idealmente con un número dedicado a la clínica (no tu personal) — te ayudamos a montarlo en el setup. Para auto-respuesta 24/7 oficial sin riesgo, vamos a verificarte como WhatsApp Business API con Meta (1-3 días de papeleo, lo hacemos juntos).",
  },
  {
    q: "¿En cuánto tiempo veo resultados?",
    a: "Semana 1: Pablo y Carmen ya contestan. Semana 2-3: las primeras reseñas de Rocío empiezan a llegar. Mes 1: 5-15 pacientes inactivos vuelven gracias a Eva. Mes 2-3: tu Google sube 0.3-0.5★ y la agenda se llena con menos hueco. Caso real piloto: clínica en Málaga recuperó 3.200€ el primer mes.",
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
              <span className="block">SEIS</span>
              <span className="block">ESPECIALISTAS.</span>
              <span className="inline-block barred mt-4 px-3 py-1">UN SUELDO.</span>
            </h1>

            <p className="mt-8 font-display text-2xl sm:text-3xl md:text-5xl leading-tight">
              El equipo que tu clínica dental<br />
              <span className="text-[color:var(--mustard)]">necesita y no puedes contratar</span>
            </p>

            <p className="mt-8 text-base md:text-lg max-w-2xl mx-auto text-white/85">
              Mientras tú estás operando, alguien contesta el WhatsApp del paciente con dolor.
              Mientras revisas radiografías, alguien coge la llamada del nuevo paciente.
              Mientras cierras la clínica, alguien recupera al paciente que llevaba 6 meses sin venir.
              <span className="block mt-2 font-bold text-white">Tú vuelves a operar tranquilo. Ellos hacen lo demás.</span>
            </p>

            <div className="mt-10 flex flex-col items-center gap-3">
              <a href="#waitlist-dental" className="btn-mustard text-lg">Quiero una de las 5 plazas</a>
              <p className="text-sm text-white/60">5 plazas gratis 30 días para clínicas dentales de Málaga · Después 79€/mes fundador</p>
            </div>
          </div>

          {/* Avatares al pie */}
          <div className="relative z-10 max-w-6xl mx-auto px-5 pb-12">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 md:gap-4">
              {agents.map((a) => (
                <div
                  key={a.slug}
                  className="relative border-[4px] border-white shadow-[6px_6px_0_#000] overflow-hidden"
                  style={{ background: a.color }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.avatar} alt={a.name} className="w-full aspect-square object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/85 text-white px-2 py-1 font-stencil text-xs md:text-sm text-center leading-tight">
                    {a.name.toUpperCase()}
                  </div>
                </div>
              ))}
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
              Los 6 especialistas<br />de tu clínica
            </h2>
            <p className="text-lg max-w-2xl mb-14 text-black/70">
              Cada uno con su misión, entrenado para clínica dental de 1-3 dentistas. No genérico.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              {agents.map((a) => {
                const dental = dentalAgents[a.slug];
                if (!dental) return null;
                return (
                  <article key={a.slug} className="dossier pt-12 p-6 relative overflow-hidden">
                    <div className="absolute top-1 left-4 right-4 flex items-center justify-between z-10 text-white text-[11px] font-mono tracking-widest">
                      <span>EXP. {a.codename}</span>
                      <span className="hidden sm:inline">· DENTAL ·</span>
                    </div>
                    <div className="flex items-start gap-5 relative">
                      <div
                        className="relative w-28 h-28 border-[3px] border-black overflow-hidden shrink-0"
                        style={{ background: a.color }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                        <span className="absolute -bottom-1 -right-1 bg-white border-[3px] border-black w-9 h-9 flex items-center justify-center text-xl">
                          {a.emoji}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-stencil text-3xl sm:text-4xl">{a.name}</h3>
                        <p className="text-sm uppercase tracking-wider font-semibold text-black/60">
                          {a.role}
                        </p>
                        <p className="text-sm font-bold mt-2">{dental.titulo}</p>
                      </div>
                    </div>
                    <ul className="mt-5 space-y-2 text-sm">
                      {dental.bullets.map((b, i) => (
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
              Esto es lo que pasa en una clínica dental con AI-Team trabajando. Sin que tú toques nada.
            </p>

            <ul className="space-y-3">
              {dentalDay.map((d) => (
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
        <section className="py-24 border-t-[3px] border-black bg-[color:var(--cream)]">
          <div className="max-w-5xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-6 text-xs font-mono">
              <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">COMPARATIVA OPERATIVA</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-12">
              AI-Team vs<br />recepcionista + community manager
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="border-2 border-black p-3 text-left">Capacidad</th>
                    <th className="border-2 border-black p-3 bg-[color:var(--mustard)] text-black">AI-Team</th>
                    <th className="border-2 border-black p-3">Recepcionista (28h/sem)</th>
                    <th className="border-2 border-black p-3">+ Community Manager freelance</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Coste mes", "79-249€", "1.200€", "+400-800€"],
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
                    <td className="border-2 border-black p-3 bg-[color:var(--mustard)] text-black">79 €</td>
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
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-1 font-bold tracking-widest">5 PLAZAS MÁLAGA</span>
            </div>
            <h2 className="font-stencil text-5xl md:text-7xl mb-4">Elige tu pack dental</h2>
            <p className="text-lg max-w-2xl mb-12 text-black/70">
              Una clínica media de Málaga pierde 2.000-5.000€/mes en citas que se caen, presupuestos no cerrados y pacientes que no vuelven. AI-Team cuesta una fracción.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {dentalPacks.map((p) => (
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
                  <a href="#waitlist-dental" className="btn-mustard text-xs text-center block">{p.cta}</a>
                </article>
              ))}
            </div>
            <p className="text-center text-xs text-black/50 mt-8 font-mono uppercase tracking-widest">
              30 días gratis para 5 clínicas piloto · cancelas en un click · sin permanencia
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
