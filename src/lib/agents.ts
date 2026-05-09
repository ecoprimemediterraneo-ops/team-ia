export type AgentSlug = "lucia" | "marta" | "carmen" | "pablo" | "rocio" | "eva";

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
};

// Avatares ochenteros generados con Gemini (estilo cómic 80s).
// Para regenerar: ver ROADMAP.md sección "Avatares".
const avatar = (slug: string) => `/agentes/${slug}.png`;

export const agents: Agent[] = [
  {
    slug: "pablo",
    name: "Pablo",
    role: "WhatsApp",
    short: "Contesta WhatsApp 24/7, agenda citas y captura leads.",
    emoji: "💬",
    quote:
      "Tu WhatsApp suena a las 23:00 un sábado. Yo contesto, resuelvo dudas, agendo cita y te paso el resumen al lunes.",
    color: "#25D366",
    codename: "ALFA-W1",
    status: "soon",
    statusNote: "Próximamente · activación Q2 2026",
    avatar: avatar("pablo"),
  },
  {
    slug: "rocio",
    name: "Rocío",
    role: "Reseñas Google",
    short: "Pide reseñas a tus clientes y responde a las nuevas.",
    emoji: "⭐",
    quote:
      "Después de cada cita, mando un mensaje pidiendo reseña. Las nuevas las contesto con tu tono. Subes en Google sin mover un dedo.",
    color: "#FBBF24",
    codename: "GOLF-R2",
    status: "soon",
    statusNote: "Próximamente · activación Q2 2026",
    avatar: avatar("rocio"),
  },
  {
    slug: "eva",
    name: "Eva",
    role: "Email Marketing",
    short: "Newsletters, secuencias de bienvenida y promos.",
    emoji: "✉️",
    quote:
      "Cada nuevo cliente recibe 5 correos de bienvenida con tu marca. Cada lunes mando newsletter con un consejo + oferta. Conversión sola.",
    color: "#60A5FA",
    codename: "ECHO-E3",
    status: "soon",
    statusNote: "Operativa · envíos reales desde eva@aiteam.marketing",
    avatar: avatar("eva"),
  },
  {
    slug: "lucia",
    name: "Lucía",
    role: "Asistente Ejecutiva",
    short: "Te organiza el correo, calendario y notas de reuniones.",
    emoji: "📬",
    quote:
      "A las 8:00 tu bandeja ya está limpia. Te he respondido el spam, marcado lo importante y dejado borradores con tu tono. Tú solo dices «sí».",
    color: "#F5C518",
    codename: "BRAVO-L4",
    status: "soon",
    statusNote: "Próximamente · activación Q2 2026 (Gmail OAuth)",
    avatar: avatar("lucia"),
  },
  {
    slug: "marta",
    name: "Marta",
    role: "Community Manager",
    short: "Posts y carruseles para Instagram, LinkedIn y TikTok.",
    emoji: "📱",
    quote:
      "Tres posts a la semana en Instagram y LinkedIn, con tu voz, sin que bailes delante de la cámara. Te los enseño, tú apruebas, salen solos.",
    color: "#FF7A59",
    codename: "DELTA-M5",
    status: "soon",
    statusNote: "Próximamente · activación Q2 2026",
    avatar: avatar("marta"),
  },
  {
    slug: "carmen",
    name: "Carmen",
    role: "Recepcionista",
    short: "Contesta llamadas en español, agenda y toma recados.",
    emoji: "📞",
    quote:
      "Contesto al segundo tono, hablo español e inglés y conozco tu negocio de memoria. Cierro citas, paso recados y nunca cuelgo de mal humor.",
    color: "#A88BE8",
    codename: "FOXTROT-C6",
    status: "soon",
    statusNote: "Próximamente · activación Q3 2026 (Vapi)",
    avatar: avatar("carmen"),
  },
];

export const agentBySlug = Object.fromEntries(agents.map((a) => [a.slug, a])) as Record<AgentSlug, Agent>;
