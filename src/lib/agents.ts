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

const avatar = (seed: string, bg: string) =>
  `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg.replace("#", "")}&radius=0&scale=110`;

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
    statusNote: "Activable con Twilio / 360dialog",
    avatar: avatar("Pablo Whatsapp", "25D366"),
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
    statusNote: "Activable con Google My Business API",
    avatar: avatar("Rocio Resenas", "FBBF24"),
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
    statusNote: "Activable con Resend (gratis hasta 3.000 emails/mes)",
    avatar: avatar("Eva Email", "60A5FA"),
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
    status: "ready",
    statusNote: "Demo activa · Gmail real próximamente",
    avatar: avatar("Lucia Tropa", "F5C518"),
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
    status: "ready",
    statusNote: "Demo activa · Publicación real con Ayrshare",
    avatar: avatar("Marta Tropa Social", "FF7A59"),
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
    statusNote: "Demo activa · Teléfono real con Vapi",
    avatar: avatar("Carmen Tropa Phone", "A88BE8"),
  },
];

export const agentBySlug = Object.fromEntries(agents.map((a) => [a.slug, a])) as Record<AgentSlug, Agent>;
