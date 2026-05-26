/**
 * Matriz de encaje agente ↔ sector.
 *
 * Para cada sector, define:
 *  - top: los 3-4 agentes IMPRESCINDIBLES (mueven la aguja desde día 1)
 *  - util: agentes que aportan pero no son prioritarios
 *  - skip: agentes que de inicio no merecen la inversión en este sector
 *
 * Se usa en:
 *  - landings sectoriales (mostrar top como protagonistas)
 *  - form de /beta (pre-marcar agentes según sector elegido)
 *  - prompt de Diana en /api/diagnostico (recomendación afinada)
 *
 * Edita aquí — es la fuente única de verdad.
 */

import type { AgentSlug } from "./agents";

export type SectorSlug =
  | "dental"
  | "estetica"
  | "fisioterapia"
  | "podologia"
  | "peluqueria"
  | "abogados"
  | "asesoria"
  | "gimnasio"
  | "restaurante"
  | "otro";

export type SectorFit = {
  slug: SectorSlug;
  label: string;
  emoji: string;
  short: string;
  /** Los 3 agentes que más impacto tienen desde el día 1 */
  top: AgentSlug[];
  /** Agentes que aportan valor pero no son prioritarios */
  util: AgentSlug[];
  /** Agentes que de inicio no merecen activarse en este sector */
  skip: AgentSlug[];
  /** Razón concreta de por qué el top funciona */
  porQue: string;
};

export const SECTOR_FIT: Record<SectorSlug, SectorFit> = {
  dental: {
    slug: "dental",
    label: "Clínica dental",
    emoji: "🦷",
    short: "Pacientes que reservan por WhatsApp, reseñas Google = oxígeno, llamadas perdidas = caro.",
    top: ["pablo", "rocio", "carmen"],
    util: ["eva", "diana", "sergio"],
    skip: ["marta", "lucia"],
    porQue:
      "El paciente potencial busca tu clínica en Google, te llama o te escribe por WhatsApp. " +
      "Si no contestas en minutos, va a la de al lado. Pablo (WhatsApp 24/7), Rocío (subir tu Google), " +
      "Carmen (capturar llamadas perdidas) son los que más mueven la aguja en dental.",
  },

  estetica: {
    slug: "estetica",
    label: "Clínica estética / belleza",
    emoji: "✨",
    short: "Instagram es vida, antes/después manda. Reseñas y WhatsApp cierran venta.",
    top: ["marta", "pablo", "rocio"],
    util: ["eva", "carmen", "diana"],
    skip: ["sergio", "lucia"],
    porQue:
      "El cliente entra por Instagram (Marta), pregunta precio por WhatsApp (Pablo) y " +
      "decide al ver tus reseñas (Rocío). Es el orden natural del funnel estético.",
  },

  fisioterapia: {
    slug: "fisioterapia",
    label: "Fisioterapia",
    emoji: "💪",
    short: "Recurrencia y recall de pacientes lesionados antiguos. WhatsApp + reseñas + email.",
    top: ["pablo", "rocio", "eva"],
    util: ["carmen", "diana"],
    skip: ["marta", "sergio", "lucia"],
    porQue:
      "Tu base es paciente recurrente. Eva les recuerda volver a chequeo (recall), " +
      "Pablo coge la cita por WhatsApp y Rocío te sube en Google para los nuevos.",
  },

  podologia: {
    slug: "podologia",
    label: "Podología",
    emoji: "🦶",
    short: "Mismo patrón que fisio: pacientes recurrentes, WhatsApp como canal principal.",
    top: ["pablo", "rocio", "eva"],
    util: ["carmen", "diana"],
    skip: ["marta", "sergio", "lucia"],
    porQue:
      "Pacientes con tratamiento periódico. Eva les avisa cuando toca revisión, " +
      "Pablo confirma cita en segundos, Rocío convierte cada visita feliz en reseña Google.",
  },

  peluqueria: {
    slug: "peluqueria",
    label: "Peluquería / barbería",
    emoji: "💇",
    short: "Instagram para enseñar trabajo, WhatsApp para reservar, reseñas para captar nuevos.",
    top: ["marta", "pablo", "rocio"],
    util: ["carmen", "eva"],
    skip: ["sergio", "lucia", "diana"],
    porQue:
      "El cliente nuevo te descubre por Instagram (Marta sube tus mejores trabajos), " +
      "te escribe por WhatsApp para pedir cita (Pablo), y antes de venir mira tus reseñas (Rocío).",
  },

  abogados: {
    slug: "abogados",
    label: "Despacho de abogados",
    emoji: "⚖️",
    short: "Email es el canal serio. Gmail saturado, leads cualificados, vigilar competencia.",
    top: ["lucia", "pablo", "sergio"],
    util: ["eva", "diana"],
    skip: ["marta", "rocio", "carmen"],
    porQue:
      "Lucía procesa tu Gmail (bandeja saturada con consultas), Pablo responde el WhatsApp " +
      "del cliente fuera de horario, Sergio vigila tarifas y posicionamiento de despachos rivales.",
  },

  asesoria: {
    slug: "asesoria",
    label: "Asesoría fiscal / laboral",
    emoji: "📊",
    short: "Bandeja Gmail saturada, clientes pidiendo aclaraciones por WhatsApp, fidelización email.",
    top: ["lucia", "pablo", "eva"],
    util: ["sergio", "diana"],
    skip: ["marta", "rocio", "carmen"],
    porQue:
      "Lucía limpia tu Gmail y prioriza lo urgente, Pablo coge las consultas WhatsApp " +
      "del cliente que paga, Eva manda newsletter trimestral con cambios fiscales.",
  },

  gimnasio: {
    slug: "gimnasio",
    label: "Gimnasio boutique / coaching",
    emoji: "🏋️",
    short: "Captación por Instagram, retención por email, recuperación por WhatsApp.",
    top: ["marta", "eva", "pablo"],
    util: ["carmen", "diana", "rocio"],
    skip: ["sergio", "lucia"],
    porQue:
      "Tu marketing es Instagram (Marta), tu retención es email recall a los que dejan " +
      "de venir (Eva) y tu captación cierra por WhatsApp (Pablo).",
  },

  restaurante: {
    slug: "restaurante",
    label: "Restaurante (gama media-alta)",
    emoji: "🍽️",
    short: "Reseñas Google = ranking, Instagram = atrae mesa nueva, WhatsApp = reservas fuera de horario.",
    top: ["rocio", "marta", "pablo"],
    util: ["carmen", "eva"],
    skip: ["sergio", "lucia", "diana"],
    porQue:
      "Vives de tus reseñas Google (Rocío las gestiona), de Instagram (Marta " +
      "publica plato del día y eventos) y de coger reservas cuando estás en cocina (Pablo).",
  },

  otro: {
    slug: "otro",
    label: "Otro negocio local",
    emoji: "🏢",
    short: "Combinación universal: el WhatsApp + reseñas + email cubre el 80% de PYMEs locales.",
    top: ["pablo", "rocio", "eva"],
    util: ["marta", "diana", "carmen"],
    skip: ["sergio", "lucia"],
    porQue:
      "El stack base de cualquier PYME local: coger leads por WhatsApp (Pablo), " +
      "subir tu visibilidad en Google (Rocío) y fidelizar clientes por email (Eva).",
  },
};

/** Alias para mapear el `sector` del form de /beta (string libre) al SectorSlug. */
export function matchSector(input: string): SectorSlug {
  const s = input.toLowerCase();
  if (s.includes("dental")) return "dental";
  if (s.includes("estét") || s.includes("estet") || s.includes("belleza")) return "estetica";
  if (s.includes("fisio")) return "fisioterapia";
  if (s.includes("podo")) return "podologia";
  if (s.includes("peluq") || s.includes("barber")) return "peluqueria";
  if (s.includes("abog")) return "abogados";
  if (s.includes("asesor") || s.includes("gestor")) return "asesoria";
  if (s.includes("gimn") || s.includes("fitness") || s.includes("coach")) return "gimnasio";
  if (s.includes("restaurant") || s.includes("bar ")) return "restaurante";
  return "otro";
}

export function getFitForSector(input: string): SectorFit {
  return SECTOR_FIT[matchSector(input)];
}
