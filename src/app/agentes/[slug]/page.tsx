import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { notFound } from "next/navigation";
import { agents, agentBySlug, type AgentSlug } from "@/lib/agents";
import type { Metadata } from "next";

// Reorientación: cada slug describe una FUNCIÓN del sistema, no un personaje.
// La ruta y el plumbing de datos (generateStaticParams, agentBySlug) no cambian.
// El protagonista es "el sistema"; esta función vive dentro de él.
type Detail = {
  fn: string;
  emoji: string;
  hook: string;
  proactive: string;
  capabilities: string[];
  whenToUse: string[];
  integrations: string[];
};

// Estado de activación honesto: el modo proactivo es una PROMESA en activación
// por fases, no algo 100% activo hoy.
const PROACTIVE_NOTE = "En activación por fases. El modo proactivo se enciende a medida que el sistema aprende tu negocio; hoy funciona en modo asistido y avanza hacia lo automático.";

const details: Record<AgentSlug, Detail> = {
  pablo: {
    fn: "WhatsApp",
    emoji: "💬",
    hook: "Tu WhatsApp deja de ser una bandeja a medio leer. El sistema contesta cuando tú no puedes, agenda citas y captura leads las 24 horas.",
    proactive: "No espera a que abras la app: detecta el lead que escribió y nadie respondió, y te avisa antes de que se enfríe.",
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
  },
  rocio: {
    fn: "Reseñas de Google",
    emoji: "⭐",
    hook: "El sistema pide reseñas en el momento exacto y prepara respuestas listas para publicar. Tu ficha de Google deja de estancarse.",
    proactive: "No espera a que entres a mirar: te avisa al instante de una reseña baja y te llega lista para responder.",
    capabilities: [
      "Solicita reseña 30-60 min después de la visita",
      "Genera respuestas con el tono de tu negocio (buenas y malas)",
      "Alerta inmediata ante reseña <3 estrellas",
      "Informe mensual de reputación",
    ],
    whenToUse: [
      "Negocios con ficha de Google activa y volumen de visitas semanales",
      "Sectores donde la reputación pesa (salud, belleza, hostelería)",
      "Equipos que olvidan pedir reseña o no contestan las nuevas",
    ],
    integrations: ["Google Business Profile", "Doctoralia", "Reservas internas"],
  },
  eva: {
    fn: "Email marketing",
    emoji: "✉️",
    hook: "Email marketing desde tu dominio. Newsletters, secuencias y campañas con buena entregabilidad y sin lock-in.",
    proactive: "No espera a que decidas a quién escribir: revisa tu base y sugiere a quién conviene reactivar antes de que se pierda.",
    capabilities: [
      "Configuración SPF/DKIM/DMARC en tu dominio",
      "Secuencias de bienvenida automáticas",
      "Newsletters periódicas con copy generado",
      "Segmentación por comportamiento",
    ],
    whenToUse: [
      "Negocios con base de contactos en crecimiento",
      "E-commerce, SaaS, clínicas con seguimientos",
      "Equipos que pagan herramientas caras y no usan la mayoría de features",
    ],
    integrations: ["Resend", "Tu propio dominio", "CSV / Google Sheets / Supabase"],
  },
  lucia: {
    fn: "Correo y agenda",
    emoji: "📬",
    hook: "A primera hora tu bandeja está procesada. Spam fuera, urgentes arriba, borradores listos para aprobar.",
    proactive: "No espera a que repases la agenda: te recuerda las citas del día y los correos urgentes que aún no has tocado.",
    capabilities: [
      "Lectura y clasificación de bandeja",
      "Borradores de respuesta con tu estilo",
      "Resumen ejecutivo diario por canal",
      "Limpieza automática de promociones",
    ],
    whenToUse: [
      "Profesionales con bandeja saturada de emails al día",
      "Directivos que pierden tiempo cada mañana revisando correo",
      "Asistentes que necesitan amplificar su trabajo",
    ],
    integrations: ["Gmail OAuth", "Google Calendar", "Outlook (próximamente)"],
  },
  marta: {
    fn: "Instagram y redes",
    emoji: "📱",
    hook: "Posts semanales en Instagram con tu voz, tu estrategia y tu calendario. Tú apruebas, salen programados.",
    proactive: "No espera a que te acuerdes de publicar: prepara y publica solo en Instagram según el calendario que has aprobado.",
    capabilities: [
      "Generación de copy + imagen IA",
      "Calendario editorial mensual",
      "Adaptación por canal y formato",
      "Análisis post a post de rendimiento",
    ],
    whenToUse: [
      "Negocios sin community manager dedicado",
      "Profesionales que sufren la presión del 'hay que publicar'",
      "Marcas que quieren consistencia sin agencia",
    ],
    integrations: ["Meta Business Suite", "Instagram", "LinkedIn (próximamente)"],
  },
  carmen: {
    fn: "Llamadas",
    emoji: "📞",
    hook: "Recepción telefónica 24/7 en español. El sistema atiende, agenda, registra y deriva — con tu catálogo y tu agenda.",
    proactive: "No espera a que devuelvas la llamada perdida: registra cada recado con transcripción y te avisa de lo que no puede esperar.",
    capabilities: [
      "Llamadas entrantes en español natural",
      "Agendado de citas según disponibilidad",
      "Registro de mensajes con transcripción",
      "Derivación inteligente a humano",
    ],
    whenToUse: [
      "Negocios que pierden llamadas fuera de horario",
      "Equipos que dejan sonar el teléfono en hora punta",
      "Sectores con alto volumen de llamadas diarias",
    ],
    integrations: ["Vapi", "Twilio Voice", "Google Calendar"],
  },
  sergio: {
    fn: "Inteligencia competitiva",
    emoji: "🕵️",
    hook: "Tus competidores no descansan, el sistema tampoco. Escaneo nocturno de webs, redes y reseñas — informe en tu bandeja a primera hora.",
    proactive: "No espera a que investigues a mano: vigila por su cuenta y te avisa en cuanto un rival mueve precios o lanza una promo.",
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
  },
};

export async function generateStaticParams() {
  return agents.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const agent = agentBySlug[slug as AgentSlug];
  if (!agent) return { title: "Función no encontrada" };
  const d = details[agent.slug];
  return {
    title: `${d.fn} — una función del sistema`,
    description: d.hook,
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
                <span className="bg-[color:var(--mustard)] text-black px-2 py-1 font-bold tracking-widest">FUNCIÓN DEL SISTEMA</span>
              </div>
              <h1 className="font-stencil text-4xl md:text-6xl mb-4">{d.fn}</h1>
              <p className="text-xl text-black/80 mb-6 leading-relaxed">{d.hook}</p>
              <div className="text-xs font-mono text-black/50 uppercase tracking-widest">{agent.statusNote}</div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/beta" className="btn-mustard">Pide tu demo →</Link>
                <Link href="/demo" className="border-[3px] border-black px-5 py-3 font-bold uppercase tracking-widest text-sm hover:bg-black hover:text-[color:var(--mustard)]">Ver demo</Link>
              </div>
            </div>
            <div className="relative aspect-square border-[3px] border-black shadow-[6px_6px_0_#000] bg-white overflow-hidden flex items-center justify-center" style={{ backgroundColor: agent.color + "20" }}>
              <span className="text-[120px] leading-none" aria-hidden="true">{d.emoji}</span>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-5xl mx-auto px-5">
            <div className="dossier card-hard p-8 bg-[color:var(--mustard)]">
              <div className="text-xs font-mono uppercase tracking-widest text-black/70 mb-3">El sistema se adelanta</div>
              <h2 className="font-stencil text-3xl mb-3">Modo proactivo</h2>
              <p className="text-lg text-black/80 leading-relaxed mb-4">{d.proactive}</p>
              <p className="text-sm font-mono text-black/60">{PROACTIVE_NOTE}</p>
            </div>
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
              <h2 className="font-stencil text-3xl mb-5">Cuándo encaja</h2>
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

        <section className="py-16 border-t-[3px] border-black bg-white">
          <div className="max-w-5xl mx-auto px-5">
            <div className="card-hard p-8 bg-black text-white">
              <p className="font-stencil text-2xl md:text-3xl text-[color:var(--mustard)]">
                Automatización de verdad, no la de hace diez años.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 border-t-[3px] border-black bg-[color:var(--mustard)]">
          <div className="max-w-3xl mx-auto px-5 text-center">
            <h2 className="font-stencil text-3xl md:text-5xl mb-4">Un sistema, todas las funciones</h2>
            <p className="text-lg mb-2">
              Sistema Operativo: <span className="line-through opacity-60">299€/mes</span>{" "}
              <span className="font-stencil text-[color:var(--red)]">149€/mes</span> precio fundador.
            </p>
            <p className="text-base mb-8 text-black/70">Gestión opcional: +249€/mes.</p>
            <Link href="/beta" className="btn-mustard bg-black text-[color:var(--mustard)] hover:bg-[color:var(--red)] hover:text-white inline-block">
              Pide tu demo →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
