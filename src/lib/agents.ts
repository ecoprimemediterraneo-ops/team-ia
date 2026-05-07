export type Agent = {
  slug: string;
  name: string;
  role: string;
  emoji: string;
  quote: string;
  color: string;
  avatar: string;
};

// Estilo "personas" de DiceBear: vector flat con líneas marcadas, paleta limitada.
// Lo más cercano a la estética de Archer sin generar imágenes con IA.
// Para cambiar de estilo, sustituye "personas" por: micah, lorelei, open-peeps, avataaars.
const avatar = (seed: string, bg: string) =>
  `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg.replace("#", "")}&radius=0&scale=100`;

export const agents: Agent[] = [
  {
    slug: "lucia",
    name: "Lucía",
    role: "Asistente Ejecutiva",
    emoji: "📬",
    quote:
      "A las 8:00 tu bandeja ya está limpia. Te he respondido el spam, marcado lo importante y dejado borradores con tu tono. Tú solo dices «sí».",
    color: "#F5C518",
    avatar: avatar("Lucia Tropa", "F5C518"),
  },
  {
    slug: "marta",
    name: "Marta",
    role: "Community Manager",
    emoji: "📱",
    quote:
      "Tres posts a la semana en Instagram y LinkedIn, con tu voz, sin que bailes delante de la cámara. Te los enseño, tú apruebas, salen solos.",
    color: "#FF7A59",
    avatar: avatar("Marta Tropa Social", "FF7A59"),
  },
  {
    slug: "diego",
    name: "Diego",
    role: "Generación de Leads",
    emoji: "🎯",
    quote:
      "Encuentro a 50 clientes potenciales cada semana, les escribo en frío y persigo a los que no contestan. Tú solo te ocupas de cerrar.",
    color: "#7AC4A4",
    avatar: avatar("Diego Tropa Sales", "7AC4A4"),
  },
  {
    slug: "carmen",
    name: "Carmen",
    role: "Recepcionista IA",
    emoji: "📞",
    quote:
      "Contesto al segundo tono, hablo español e inglés y conozco tu negocio de memoria. Cierro citas, paso recados y nunca cuelgo de mal humor.",
    color: "#A88BE8",
    avatar: avatar("Carmen Tropa Phone", "A88BE8"),
  },
];
