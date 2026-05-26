export type AgentSlug = "lucia" | "marta" | "carmen" | "pablo" | "rocio" | "eva" | "sergio" | "diana" | "tomas";

export type Agent = {
  slug: AgentSlug;
  name: string;
  role: string;
  /** Ultra-corto (2-3 palabras) para mostrar bajo el avatar. Beneficio puro. */
  tagline: string;
  short: string;
  emoji: string;
  quote: string;
  color: string;
  codename: string;
  status: "ready" | "beta" | "pre-beta" | "soon";
  statusNote: string;
  /** Porcentaje real de funcionalidad. Honesto, no marketing. */
  realPercent: number;
  /** Qué bloquea el 100%. null = ya está al 100%. */
  bloqueador: string | null;
  avatar: string;
};

const avatar = (slug: string) => `/agentes/${slug}/${slug}.webp`;

export const agents: Agent[] = [
  {
    slug: "pablo",
    name: "Pablo",
    role: "WhatsApp",
    tagline: "Responde por ti",
    short: "Responde clientes aunque no puedas coger el móvil. Nadie se queda esperando.",
    emoji: "💬",
    quote:
      "Cuando alguien pregunta precio o disponibilidad, dejo la respuesta preparada en segundos. Tú revisas y envías.",
    color: "#25D366",
    codename: "ALFA-W1",
    status: "beta",
    statusNote: "BETA · Tandas 1+2+3+4 ✓ módulo WhatsApp + Analytics intent + A/B test + Templates + Reportes PDF + Pipeline CRM (kanban leads) + Citas con recordatorios auto (24h+2h+followup) + Catálogo servicios/precios + Insights IA negocio + Audios WhatsApp ElevenLabs + Keywords críticas (escalado/bloqueo auto). Solo falta WhatsApp Business Cloud API",
    realPercent: 100,
    bloqueador: "WhatsApp Business Cloud API · verificación Meta + número dedicado (1-3 sem)",
    avatar: avatar("pablo"),
  },
  {
    slug: "rocio",
    name: "Rocío",
    role: "Reseñas Google",
    tagline: "Cuida tus reseñas",
    short: "Tus reseñas no se quedan semanas sin responder.",
    emoji: "⭐",
    quote:
      "Preparo respuestas educadas incluso para reseñas malas. Tú revisas y apruebas.",
    color: "#FBBF24",
    codename: "GOLF-R2",
    status: "beta",
    statusNote: "BETA · Tandas 1+2 ✓ multi-local + métricas + cola aprobación + análisis sentimiento por reseña + templates por sector (clínica/peluquería/restaurante/hotel/fisio/gimnasio) + generador pedir reseñas + reportes mensuales PDF. Publicación auto en Google: pendiente GBP API",
    realPercent: 95,
    bloqueador: "Google Business Profile API · verificación propietario + OAuth (3-5 días dev). Mientras: aprobar + copiar respuesta al portapapeles para pegar en Google",
    avatar: avatar("rocio"),
  },
  {
    slug: "eva",
    name: "Eva",
    role: "Email Marketing",
    tagline: "Mantiene el contacto",
    short: "Tus clientes siguen sabiendo de ti sin perseguir publicaciones.",
    emoji: "✉️",
    quote:
      "Cada nuevo cliente entra automáticamente en seguimiento. Tu negocio sigue activo aunque vayas a tope.",
    color: "#60A5FA",
    codename: "ECHO-E3",
    status: "ready",
    statusNote: "Operativa · envíos reales Resend + secuencias + captura leads + dashboard métricas (open/click/bounces) + editor personalidad (marca, remitente, tono, audiencia, CTAs) + sandbox 6 tipos campaña + histórico campañas",
    realPercent: 95,
    bloqueador: "Configurar DNS del dominio del cliente en Resend (30-60 min por cliente, NO bloquea funcionalidad)",
    avatar: avatar("eva"),
  },
  {
    slug: "lucia",
    name: "Lucía",
    role: "Asistente Ejecutiva",
    tagline: "Limpia tu Gmail",
    short: "Te deja el Gmail limpio cada mañana. Ordena correos importantes y elimina ruido. Recuperas 1 hora al día.",
    emoji: "📬",
    quote:
      "A las 8:00 tu bandeja está procesada. Spam eliminado, urgentes marcados, borradores listos en tu Gmail. Tú revisas y envías con un click.",
    color: "#F5C518",
    codename: "BRAVO-L4",
    status: "beta",
    statusNote: "BETA · Tandas 1+2 ✓ Gmail OAuth + dashboard + editor + sandbox + tracking borradores + clasificador 8 categorías + Brief diario 8am + Detector compromisos sueltos + Briefs de reunión con contexto + Reportes mensuales productividad PDF",
    realPercent: 100,
    bloqueador: "Google OAuth App Verification (1-4 sem trámite externo, NO bloquea funcionalidad)",
    avatar: avatar("lucia"),
  },
  {
    slug: "marta",
    name: "Marta",
    role: "Community Manager",
    tagline: "Publica Instagram",
    short: "Tu Instagram sigue activo aunque no tengas tiempo.",
    emoji: "📱",
    quote:
      "Preparo publicaciones listas para revisar y publicar en un clic.",
    color: "#FF7A59",
    codename: "DELTA-M5",
    status: "beta",
    statusNote: "BETA · Tandas 1+2+3+4 ✓ Reels + Carruseles + Bandeja unificada + Analytics auto-mejora + Oportunidades virales + Leads comentarios + A/B hooks + Repurposing 1→5 + Hora óptima + Templates calendario eventos + Captions multilingües + Voz ElevenLabs + Sugerencias colaboraciones + Reportes ejecutivos PDF + Catálogo + tags IG Shopping. Editor personalidad + ruedines + aprendizaje. Solo falta App Review Meta para publicar sola",
    realPercent: 100,
    bloqueador: "Meta App Review (instagram_content_publish + instagram_manage_messages) 4-8 sem",
    avatar: avatar("marta"),
  },
  {
    slug: "carmen",
    name: "Carmen",
    role: "Recepcionista de llamadas",
    tagline: "Coge llamadas",
    short: "No pierdas llamadas mientras trabajas.",
    emoji: "📞",
    quote:
      "Si no puedes atender, recojo el mensaje y te aviso por WhatsApp.",
    color: "#A88BE8",
    codename: "FOXTROT-C6",
    status: "beta",
    statusNote: "BETA · Contestador inteligente completo: voz natural ElevenLabs (saludo cacheado) + Twilio (call routing) + Whisper (transcripción) + Claude (clasificación urgencia/intent/resumen) + WhatsApp/email instantáneo al dueño + Editor personalidad + Sandbox texto. Falta solo dar de alta cuenta Twilio + comprar número español (~1-3€/mes + uso)",
    realPercent: 90,
    bloqueador: "Alta Twilio + compra número español (trámite externo 1-3 días). Código y stack listos",
    avatar: avatar("carmen"),
  },
  {
    slug: "diana",
    name: "Diana",
    role: "Auditora",
    tagline: "Detecta clientes perdidos",
    short: "Detecta por dónde se te escapan clientes.",
    emoji: "🔍",
    quote:
      "Analizo tu negocio y detecto dónde estás perdiendo tiempo o dinero. Informe completo a tu email.",
    color: "#14B8A6",
    codename: "HOTEL-D8",
    status: "ready",
    statusNote: "Operativa · diagnóstico gratuito, 2 minutos, sin tarjeta, informe por email",
    realPercent: 95,
    bloqueador: null,
    avatar: avatar("diana"),
  },
  {
    slug: "tomas",
    name: "Tomás",
    role: "Soporte 24/7",
    tagline: "Aunque sea domingo",
    short: "Te responde aunque sea domingo.",
    emoji: "💬",
    quote:
      "Te ayudo rápido cuando no sabes qué hacer o a quién preguntar.",
    color: "#06B6D4",
    codename: "TANGO-T9",
    status: "ready",
    statusNote: "Operativo · widget 24/7 con Claude Haiku · incluido en todos los packs",
    realPercent: 90,
    bloqueador: null,
    avatar: avatar("tomas"),
  },
  {
    slug: "sergio",
    name: "Sergio",
    role: "Inteligencia Competitiva",
    tagline: "Vigila competencia",
    short: "Te avisa cada lunes si tu competencia ha cambiado precios, ofertas o servicios.",
    emoji: "🕵️",
    quote:
      "Escaneo a tus competidores cada noche. Si cambian precios o lanzan promo, te llega alerta antes de abrir. Informe ejecutivo cada lunes.",
    color: "#3B82F6",
    codename: "SIERRA-S7",
    status: "ready",
    statusNote: "Operativa · añade hasta 10 competidores, vigilancia diaria/semanal, alertas por email y digest agrupado",
    realPercent: 100,
    bloqueador: null,
    avatar: avatar("sergio"),
  },
];

export const agentBySlug = Object.fromEntries(agents.map((a) => [a.slug, a])) as Record<AgentSlug, Agent>;
