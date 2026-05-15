import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { agents, agentBySlug, type AgentSlug } from "@/lib/agents";
import type { Metadata } from "next";

type Detail = {
  hook: string;
  capabilities: string[];
  whenToUse: string[];
  integrations: string[];
  metrics: { label: string; value: string }[];
};

const details: Record<AgentSlug, Detail> = {
  pablo: {
    hook: "Tu WhatsApp deja de ser una bandeja a medio leer. Pablo contesta en 8 segundos, agenda citas y captura leads las 24 horas.",
    capabilities: [
      "Responde mensajes con tu tono, catálogo y precios",
      "Agenda citas según tu disponibilidad real",
      "Filtra spam y mensajes irrelevantes",
      "Deriva al humano cuando el caso lo requiere",
    ],
    whenToUse: [
      "Clínicas, peluquerías, restaurantes y comercios con WhatsApp como canal principal",
      "Negocios que pierden citas por no contestar fuera de horario",
      "Equipos pequeños que reciben más de 30 mensajes al día",
    ],
    integrations: ["WhatsApp Business · Meta Cloud API", "Google Calendar", "Calendly / Cal.com"],
    metrics: [
      { label: "Tiempo medio respuesta", value: "8 seg" },
      { label: "Resolución sin humano", value: "85%" },
      { label: "Leads recuperados", value: "+34%" },
    ],
  },
  rocio: {
    hook: "Pide reseñas en el momento exacto, responde el 100% en menos de 24h. Tu ficha de Google deja de estancarse.",
    capabilities: [
      "Solicita reseña 30-60 min después de la visita",
      "Responde con el tono de tu negocio (buenas y malas)",
      "Alerta en menos de 10 min ante reseña <3 estrellas",
      "Genera informes mensuales de reputación",
    ],
    whenToUse: [
      "Negocios con ficha de Google activa y volumen de visitas semanales",
      "Sectores donde la reputación pesa (salud, belleza, hostelería)",
      "Equipos que olvidan pedir reseña o no contestan las nuevas",
    ],
    integrations: ["Google Business Profile", "Doctoralia", "Reservas internas"],
    metrics: [
      { label: "Reseñas/mes (media)", value: "+18-24" },
      { label: "Tasa de respuesta", value: "100%" },
      { label: "Nota Google", value: "+0.3 ★" },
    ],
  },
  eva: {
    hook: "Email marketing sin Mailchimp. Newsletters, secuencias y campañas con entregabilidad de primer nivel desde tu dominio.",
    capabilities: [
      "Configuración SPF/DKIM/DMARC en tu dominio",
      "Secuencias de bienvenida automáticas",
      "Newsletters semanales con copy generado",
      "Segmentación por comportamiento",
    ],
    whenToUse: [
      "Negocios con base de contactos >300",
      "E-commerce, SaaS, clínicas con seguimientos",
      "Equipos que pagan Mailchimp y no usan el 90% de las features",
    ],
    integrations: ["Resend", "Tu propio dominio", "CSV / Google Sheets / Supabase"],
    metrics: [
      { label: "Apertura media", value: "32-41%" },
      { label: "Coste por envío", value: "0,0004€" },
      { label: "Ahorro vs Mailchimp", value: "~85€/mes" },
    ],
  },
  lucia: {
    hook: "A las 8:00 tu bandeja está procesada. Spam fuera, urgentes arriba, borradores listos para aprobar.",
    capabilities: [
      "Lectura y clasificación de bandeja",
      "Borradores de respuesta con tu estilo",
      "Resumen ejecutivo diario por canal",
      "Limpieza automática de promociones",
    ],
    whenToUse: [
      "Profesionales con +50 emails/día",
      "Directivos que pierden 1h al día en bandeja",
      "Asistentes que necesitan amplificar su trabajo",
    ],
    integrations: ["Gmail OAuth", "Google Calendar", "Outlook (próximamente)"],
    metrics: [
      { label: "Tiempo ahorrado/día", value: "47 min" },
      { label: "Precisión clasificación", value: "94%" },
      { label: "Borradores aprobados", value: "78%" },
    ],
  },
  marta: {
    hook: "Tres posts por semana en Instagram y LinkedIn, con tu voz, tu estrategia y tu calendario. Tú apruebas, salen programados.",
    capabilities: [
      "Generación de copy + imagen IA",
      "Calendario editorial mensual",
      "Adaptación por canal (IG, LinkedIn, TikTok)",
      "Análisis post a post de rendimiento",
    ],
    whenToUse: [
      "Negocios sin community manager dedicado",
      "Profesionales que sufren la presión del 'hay que publicar'",
      "Marcas que quieren consistencia sin agencia",
    ],
    integrations: ["Ayrshare (multi-canal)", "Meta Business Suite", "LinkedIn"],
    metrics: [
      { label: "Posts/mes", value: "12-16" },
      { label: "Engagement medio", value: "+62%" },
      { label: "Coste vs agencia", value: "-91%" },
    ],
  },
  carmen: {
    hook: "Recepcionista 24/7 en español. Atiende, agenda, registra y deriva — al segundo tono, con tu catálogo y tu agenda.",
    capabilities: [
      "Llamadas entrantes en español natural",
      "Agendado de citas según disponibilidad",
      "Registro de mensajes con transcripción",
      "Derivación inteligente a humano",
    ],
    whenToUse: [
      "Negocios que pierden llamadas fuera de horario",
      "Equipos que dejan sonar el teléfono en hora punta",
      "Sectores con +30 llamadas/día",
    ],
    integrations: ["Vapi", "Twilio Voice", "Google Calendar"],
    metrics: [
      { label: "Tasa de atención", value: "100%" },
      { label: "Citas cerradas", value: "+41%" },
      { label: "Coste vs recepcionista", value: "-87%" },
    ],
  },
  sergio: {
    hook: "Tus competidores no descansan. Sergio tampoco. Escaneo nocturno de webs, redes y reseñas — informe en tu bandeja a las 7:00.",
    capabilities: [
      "Monitorización de webs de competidores 24/7",
      "Alertas por cambios de precio o promo",
      "Tracking de reseñas y reputación rival",
      "Informe semanal con recomendaciones",
    ],
    whenToUse: [
      "Sectores con competencia activa (clínicas, restaurantes, e-commerce)",
      "Negocios que toman decisiones de precio reactivas",
      "Equipos que quieren anticiparse, no reaccionar",
    ],
    integrations: ["Scraping propietario", "Google Business", "Supabase"],
    metrics: [
      { label: "Webs monitorizadas", value: "Hasta 20" },
      { label: "Alertas/semana (media)", value: "4-7" },
      { label: "Tiempo de detección", value: "<24h" },
    ],
  },
};

export async function generateStaticParams() {
  return agents.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const agent = agentBySlug[slug as AgentSlug];
  if (!agent) return { title: "Agente no encontrado" };
  return {
    title: `${agent.name} — ${agent.role}`,
    description: agent.short,
    alternates: { canonical: `https://aiteam.marketing/agentes/${agent.slug}` },
  };
}

export default async function AgentePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = agentBySlug[slug as AgentSlug];
  if (!agent) notFound();
  const d = details[agent.slug];

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 border-b-[3px] border-black" style={{ backgroundColor: agent.color + "15" }}>
          <div className="max-w-5xl mx-auto px-5 grid md:grid-cols-[1fr_280px] gap-10 items-center">
            <div>
              <div className="flex items-center gap-3 mb-4 text-xs font-mono">
                <span className="bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">{agent.codename}</span>
                <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">{agent.role.toUpperCase()}</span>
              </div>
              <h1 className="font-stencil text-4xl md:text-6xl mb-4">{agent.name}</h1>
              <p className="text-xl text-black/80 mb-6 leading-relaxed">{d.hook}</p>
              <div className="text-xs font-mono text-black/50 uppercase tracking-widest">{agent.statusNote}</div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/reclutar" className="btn-mustard">ACTIVAR {agent.name.toUpperCase()} →</Link>
                <Link href="/demo" className="border-[3px] border-black px-5 py-3 font-bold uppercase tracking-widest text-sm hover:bg-black hover:text-[color:var(--mustard)]">Ver demo</Link>
              </div>
            </div>
            <div className="relative aspect-square border-[3px] border-black shadow-[6px_6px_0_#000] bg-white overflow-hidden">
              <Image src={agent.avatar} alt={agent.name} fill className="object-cover" sizes="280px" priority />
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-5xl mx-auto px-5 grid md:grid-cols-3 gap-5">
            {d.metrics.map((m) => (
              <div key={m.label} className="card-hard p-6 text-center bg-white">
                <div className="font-stencil text-4xl text-[color:var(--red)] mb-2">{m.value}</div>
                <div className="text-xs font-mono uppercase tracking-widest text-black/60">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 border-t-[3px] border-black bg-white">
          <div className="max-w-5xl mx-auto px-5 grid md:grid-cols-2 gap-10">
            <div>
              <h2 className="font-stencil text-3xl mb-5">Qué hace</h2>
              <ul className="space-y-3">
                {d.capabilities.map((c) => (
                  <li key={c} className="flex items-start gap-3">
                    <span className="text-[color:var(--red)] font-bold mt-0.5">▸</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-stencil text-3xl mb-5">Cuándo activarlo</h2>
              <ul className="space-y-3">
                {d.whenToUse.map((c) => (
                  <li key={c} className="flex items-start gap-3">
                    <span className="text-[color:var(--mustard)] font-bold mt-0.5">★</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="py-16 border-t-[3px] border-black">
          <div className="max-w-5xl mx-auto px-5">
            <h2 className="font-stencil text-3xl mb-5">Integraciones</h2>
            <div className="flex flex-wrap gap-3">
              {d.integrations.map((i) => (
                <span key={i} className="border-2 border-black px-3 py-2 text-sm font-bold bg-white">{i}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 border-t-[3px] border-black bg-[color:var(--mustard)]">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl md:text-5xl mb-4">¿Empezamos con {agent.name}?</h2>
            <p className="text-lg mb-8">14 días gratis. Sin tarjeta. Cancela cuando quieras.</p>
            <Link href="/reclutar" className="btn-mustard bg-black text-[color:var(--mustard)] hover:bg-[color:var(--red)] hover:text-white inline-block">
              ACTIVAR MI EQUIPO →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
