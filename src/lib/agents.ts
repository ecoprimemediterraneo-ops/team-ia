export type AgentSlug = "lucia" | "marta" | "carmen" | "pablo" | "rocio" | "eva" | "sergio" | "diana";

export type Agent = {
  slug: AgentSlug;
  name: string;
  role: string;
  short: string;
  emoji: string;
  quote: string;
  color: string;
  codename: string;
  status: "ready" | "soon";
  statusNote: string;
  avatar: string;
  /** Si aparece en la rejilla/marquee de la home (`/`). Si false, sigue accesible en `/agentes/[slug]`. */
  showOnHome: boolean;
};

// Avatares ochenteros generados con Gemini (estilo cómic 80s).
// Para regenerar: ver ROADMAP.md sección "Avatares".
const avatar = (slug: string) => `/agentes/${slug}.webp`;

export const agents: Agent[] = [
  {
    slug: "pablo",
    name: "Pablo",
    role: "WhatsApp",
    short: "Gestiona WhatsApp Business de forma autónoma: responde consultas, agenda citas y captura leads las 24 horas.",
    emoji: "💬",
    quote:
      "Un cliente escribe a las 23:00. En 8 segundos tiene respuesta, precio y cita confirmada. Tú ves el resumen por la mañana.",
    color: "#25D366",
    codename: "ALFA-W1",
    status: "ready",
    statusNote: "Operativa · modo manual con IA (auto-respuesta 24/7: en alta Meta Business)",
    avatar: avatar("pablo"),
    showOnHome: true,
  },
  {
    slug: "rocio",
    name: "Rocío",
    role: "Reseñas Google",
    short: "Solicita reseñas automáticamente tras cada visita y responde las nuevas con el tono de tu negocio.",
    emoji: "⭐",
    quote:
      "Cada cliente que sale de tu negocio recibe una solicitud de reseña. Las respuestas llegan. Tú no gestionas nada.",
    color: "#FBBF24",
    codename: "GOLF-R2",
    status: "ready",
    statusNote: "Operativa · modo manual con IA (auto-publicación: en aprobación Google)",
    avatar: avatar("rocio"),
    showOnHome: true,
  },
  {
    slug: "eva",
    name: "Eva",
    role: "Email Marketing",
    short: "Ejecuta secuencias de email marketing, newsletters y campañas automáticas desde tu dominio.",
    emoji: "✉️",
    quote:
      "Cada nuevo contacto entra en una secuencia de bienvenida. Cada semana sale una newsletter. La base de datos trabaja sola.",
    color: "#60A5FA",
    codename: "ECHO-E3",
    status: "ready",
    statusNote: "Operativa · envíos reales desde eva@aiteam.marketing",
    avatar: avatar("eva"),
    showOnHome: true,
  },
  {
    slug: "lucia",
    name: "Lucía",
    role: "Asistente Ejecutiva",
    short: "Procesa la bandeja de entrada, prioriza correos y genera borradores de respuesta con tu estilo.",
    emoji: "📬",
    quote:
      "A las 8:00 tu bandeja está procesada. Spam eliminado, urgentes marcados, borradores listos. Tú revisas y apruebas.",
    color: "#F5C518",
    codename: "BRAVO-L4",
    status: "ready",
    statusNote: "Operativa · Gmail OAuth real (lectura + borradores + limpieza IA)",
    avatar: avatar("lucia"),
    showOnHome: true,
  },
  {
    slug: "marta",
    name: "Marta",
    role: "Community Manager",
    short: "Genera y publica contenido para Instagram, LinkedIn y TikTok con el tono y la estrategia de tu negocio.",
    emoji: "📱",
    quote:
      "Tres posts semanales en Instagram y LinkedIn, con tu voz y tu estrategia. Tú apruebas, salen programados.",
    color: "#FF7A59",
    codename: "DELTA-M5",
    status: "ready",
    statusNote: "Operativa · modo manual con IA (auto-publicación: en aprobación Meta/LinkedIn)",
    avatar: avatar("marta"),
    showOnHome: true,
  },
  {
    slug: "carmen",
    name: "Carmen",
    role: "Recepcionista",
    short: "Atiende llamadas entrantes en español, agenda citas y registra mensajes con precisión.",
    emoji: "📞",
    quote:
      "Contesto al segundo tono. Conozco tu catálogo, tus precios y tu disponibilidad. Citas cerradas, recados registrados.",
    color: "#A88BE8",
    codename: "FOXTROT-C6",
    status: "ready",
    statusNote: "Operativa · guiones manuales con IA (auto-voz: en alta Vapi)",
    avatar: avatar("carmen"),
    showOnHome: true,
  },
  {
    slug: "diana",
    name: "Diana",
    role: "Auditora de Negocios",
    short:
      "Diagnostica el estado digital de tu negocio en 2 minutos. Web, reseñas, WhatsApp, redes, competencia. Encuentra dónde pierdes dinero cada semana.",
    emoji: "🔍",
    quote:
      "Veo lo que tus clientes ven en Google. Veo lo que tu competencia hace mejor. Te digo en euros exactos cuánto te cuesta cada semana sin equipo IA.",
    color: "#14B8A6",
    codename: "HOTEL-D8",
    status: "ready",
    statusNote: "Operativa · diagnóstico gratuito, 2 minutos, sin tarjeta",
    avatar: avatar("diana"),
    showOnHome: false,
  },
  {
    slug: "sergio",
    name: "Sergio",
    role: "Inteligencia Competitiva",
    short: "Monitoriza webs de competidores 24/7 y genera alertas automáticas ante cambios de precios, ofertas o posicionamiento.",
    emoji: "🕵️",
    quote:
      "Escaneo a tus competidores cada noche. Si cambian precios o lanzan una promo, tienes el informe antes de abrir.",
    color: "#3B82F6",
    codename: "SIERRA-S7",
    status: "ready",
    statusNote: "Operativa · monitorización web con IA (alertas en tiempo real)",
    avatar: avatar("sergio"),
    showOnHome: false,
  },
];

export const agentBySlug = Object.fromEntries(agents.map((a) => [a.slug, a])) as Record<AgentSlug, Agent>;
