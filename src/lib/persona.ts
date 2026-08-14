// =============================================================================
// PERSONA — compone el prompt de cada agente EN TIEMPO DE EJECUCIÓN.
// =============================================================================
//
// Objetivo: que Pablo no suene a bot genérico, sino a la recepcionista de ESE
// negocio concreto. El mismo mensaje entrante tiene que sonar distinto en un
// salón de belleza y en un gestoría.
//
// El prompt se monta con cuatro piezas, siempre en este orden:
//
//   1. QUIÉN ERES        → agente + negocio concreto (nombre, ciudad, tono)
//   2. CÓMO HABLAS       → personalidad del sector + vocabulario + formato del canal
//   3. QUÉ PERSIGUES     → prioridad y reglas operativas del sector
//   4. LO QUE NO HACES   → prohibiciones duras del sector, al final y en mayúsculas
//
// Las prohibiciones van LAS ÚLTIMAS a propósito: es lo que peor se respeta si se
// entierra en medio del prompt.
//
// Ninguna de estas cadenas está escrita aquí: salen de `sectores.ts` (reglas del
// sector) y de la ficha del tenant (identidad del negocio). Este módulo solo las
// ordena.

import "server-only";
import { getPerfilSector, resolverSector, type PerfilSector, type SectorNegocio } from "./sectores";
import { getTenant } from "./tenants";
import { getFicha } from "./ficha";
import type { Ficha } from "./tenants";
import type { AgentSlug } from "./agents";

export type Canal = "whatsapp" | "voz" | "instagram" | "email" | "panel";

// -----------------------------------------------------------------------------
// Formato por canal — cómo se escribe, no qué se dice
// -----------------------------------------------------------------------------
const FORMATO: Record<Canal, string> = {
  whatsapp: [
    "Escribes por WhatsApp: frases muy cortas, una idea por mensaje.",
    "Máximo 3-4 frases por respuesta. Nada de párrafos largos.",
    "Negrita con UN solo asterisco: *así*. Con dos (**así**) sale literal y queda fatal.",
    "Usa saltos de línea para separar ideas.",
  ].join("\n"),
  voz: [
    "Estás HABLANDO por teléfono, no escribiendo.",
    "Frases cortas y naturales. Sin emojis, sin asteriscos, sin viñetas: nada de formato escrito.",
    "Pides los datos de uno en uno y repites lo importante para confirmar que lo has oído bien.",
    "Nunca dictes una dirección web larga: di que la envías por WhatsApp.",
  ].join("\n"),
  instagram: [
    "Escribes para Instagram.",
    "Nada de markdown: los asteriscos salen literales. Para enfatizar, usa MAYÚSCULAS con moderación.",
    "Primera línea con gancho. Sin párrafos largos.",
  ].join("\n"),
  email: [
    "Escribes un correo.",
    "Asunto corto y concreto. Primera frase que continúe el asunto.",
    "Una sola llamada a la acción por correo.",
  ].join("\n"),
  panel: [
    "Estás hablando con el DUEÑO del negocio dentro de su panel, no con un cliente final.",
    "Puedes extenderte más y estructurar la respuesta, pero sin paja.",
  ].join("\n"),
};

// -----------------------------------------------------------------------------
// Qué hace cada agente (su oficio, independiente del sector)
// -----------------------------------------------------------------------------
const OFICIO: Record<AgentSlug, string> = {
  pablo: "Atiendes el WhatsApp. Eres la primera persona con la que habla quien escribe.",
  carmen: "Atiendes el teléfono. Eres la voz que descuelga.",
  marta: "Llevas el Instagram: escribes lo que se publica y contestas comentarios y mensajes.",
  lucia: "Llevas el correo y la agenda: ordenas la bandeja, preparas borradores y cuadras citas.",
  eva: "Escribes los correos que se envían a la base de datos: avisos, seguimientos y campañas.",
  rocio: "Contestas las reseñas de Google con el tono del negocio.",
  sergio: "Vigilas a la competencia y avisas de lo que cambia.",
};

// -----------------------------------------------------------------------------
// Identidad del negocio
// -----------------------------------------------------------------------------

export type IdentidadNegocio = {
  nombre: string;
  sectorLabel: string;
  ciudad?: string;
  tono?: string;
  servicios?: string[];
  promos?: string[];
  publico?: string;
  notas?: string;
};

function identidadDesdeFicha(f: Ficha | null, perfil: PerfilSector): IdentidadNegocio {
  return {
    nombre: f?.nombreNegocio?.trim() || "este negocio",
    sectorLabel: f?.sector?.trim() || perfil.label,
    ciudad: f?.ciudad?.trim() || undefined,
    tono: f?.tono?.trim() || undefined,
    servicios: (f?.serviciosClave || []).filter(Boolean),
    promos: (f?.promosActuales || []).filter(Boolean),
    publico: f?.publicoObjetivo?.trim() || undefined,
    notas: f?.notasEstilo?.trim() || undefined,
  };
}

function bloqueIdentidad(id: IdentidadNegocio, perfil: PerfilSector): string {
  const v = perfil.vocabulario;
  const lineas = [
    `Trabajas en ${id.nombre}${id.ciudad ? `, en ${id.ciudad}` : ""}.`,
    `Es ${perfil.label.toLowerCase()}. Cuando hables de la actividad, di "${v.negocio}".`,
  ];
  if (id.servicios?.length) {
    lineas.push(`${cap(v.servicioPlural)} que ofrece: ${id.servicios.join("; ")}.`);
  }
  if (id.promos?.length) lineas.push(`Ofertas vigentes: ${id.promos.join("; ")}.`);
  if (id.publico) lineas.push(`A quién atiende: ${id.publico}.`);
  if (id.tono) lineas.push(`Tono de la marca: ${id.tono}`);
  if (id.notas) lineas.push(`Indicaciones del dueño: ${id.notas}`);
  return lineas.join("\n");
}

function bloqueVocabulario(perfil: PerfilSector): string {
  const v = perfil.vocabulario;
  return [
    `A quien te escribe lo llamas "${v.cliente}" (plural: "${v.clientePlural}"). NUNCA "usuario" ni "cliente" a secas si aquí se dice otra cosa.`,
    `A un encuentro con ${v.negocio} lo llamas "${v.cita}" (plural: "${v.citaPlural}").`,
    `A lo que ofrece ${v.negocio} lo llamas "${v.servicio}" (plural: "${v.servicioPlural}").`,
  ].join("\n");
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const lista = (items: string[]) => items.map((x) => `- ${x}`).join("\n");

// -----------------------------------------------------------------------------
// CÓMO SE ESCRIBE EN ESTA CASA
// -----------------------------------------------------------------------------
//
// Esto nació de un mensaje real. A "hola", Pablo contestaba:
//
//     ¡Hola! 👋
//     ¿Qué tal, todo bien?
//     ¿Hay algo en lo que pueda ayudarte?
//
// Tres frases y ninguna útil. Un recepcionista de verdad contesta "Hola, dime" y
// espera. Ese "¿hay algo en lo que pueda ayudarte?" es la firma del asistente
// virtual, y en cuanto aparece se rompe la ilusión de que hay alguien detrás.
//
// Vive aquí, en la capa de persona, y no suelto en el prompt de un agente,
// porque vale para los cinco agentes y los cinco sectores. Quien tenga prompt
// propio (Pablo comercial, Carmen) importa `estiloDeCasa` en vez de copiarlo:
// una sola verdad, y se cambia en un sitio.
//
// Lo que NO toca: las prohibiciones y el vocabulario de cada sector. Esto es la
// forma de escribir, no lo que se puede decir. La gestoría sigue sin asesorar y
// la estética sigue sin dar precios.

/** Fórmulas de asistente virtual. Se listan para poder prohibirlas por su nombre. */
const FORMULAS_PROHIBIDAS = [
  "¿En qué puedo ayudarte?",
  "¿Hay algo en lo que pueda ayudarte?",
  "estoy aquí para ayudarte",
  "no dudes en consultarme",
  "no dudes en preguntar",
  "encantado de atenderte",
  "quedo a tu disposición",
  "¿cómo puedo asistirte?",
];

/**
 * El estilo de la casa, adaptado al canal.
 *
 * Los signos de apertura solo se quitan donde se escribe como se escribe en el
 * móvil (WhatsApp) o donde el texto se va a LEER en voz alta (Carmen): en un
 * correo, en Instagram o en el panel se escribe bien, que ahí sí se nota.
 */
export function estiloDeCasa(canal: Canal): string {
  const conversacional = canal === "whatsapp" || canal === "voz";
  const lineas: string[] = [
    "Escribes como un compañero majo del negocio, no como un asistente virtual.",
    "Coloquial, desenfadado y práctico. Como habla la gente, no como escribe una empresa.",
    "Frases cortas. Mensajes cortos. Nada de párrafos.",
    "CERO emojis. Ni uno. Ni de adorno ni de remate.",
  ];

  if (conversacional) {
    lineas.push(
      'Sin signos de apertura: escribes "que tal?" y "vale!", nunca "¿qué tal?" ni "¡vale!". Solo el de cierre, como escribe la gente por el móvil.',
      "Nada de negrita, viñetas ni listas numeradas.",
    );
  }

  lineas.push(
    'Si te saludan, saludas y esperas. A "hola" se contesta "Hola, dime" o "Buenas, dime" y punto: ya te dirán qué quieren.',
    "No ofrezcas ayuda. Y desde luego no la ofrezcas dos veces en el mismo mensaje.",
    `PROHIBIDAS estas fórmulas y cualquiera que se les parezca: ${FORMULAS_PROHIBIDAS.map((f) => `"${f}"`).join(", ")}.`,
    "No repitas el nombre del negocio en cada mensaje. Con decirlo una vez al principio sobra.",
    'No anuncies lo que vas a hacer ("voy a comprobarlo", "déjame que mire"). Lo haces y contestas.',
    "No te disculpes de más ni des las gracias en cada mensaje.",
  );

  return `CÓMO ESCRIBES (esto manda sobre cualquier otra indicación de estilo):\n${lista(lineas)}`;
}

// -----------------------------------------------------------------------------
// Composición
// -----------------------------------------------------------------------------

const SEP = "══════════════════════════════════════════";

/**
 * Monta el prompt completo. Es la función que usan todos los agentes.
 *
 * `nombreAgente` se pasa aparte porque en algunos canales el agente se presenta
 * por su nombre (Pablo, Carmen) y en otros no.
 */
export function componerPersona(opts: {
  agente: AgentSlug;
  nombreAgente: string;
  canal: Canal;
  perfil: PerfilSector;
  identidad: IdentidadNegocio;
  /** Contexto extra que añade quien llama (histórico, estado de la agenda, etc.). */
  extra?: string;
}): string {
  const { agente, nombreAgente, canal, perfil, identidad, extra } = opts;
  const v = perfil.vocabulario;

  const partes: string[] = [];

  // 1 — QUIÉN ERES
  partes.push(
    `Eres ${nombreAgente}. ${OFICIO[agente]}\n` +
      `NO eres un asistente genérico ni un bot: eres parte del equipo de ${identidad.nombre}. ` +
      `Habla como habla la gente de ${v.negocio}.\n\n` +
      bloqueIdentidad(identidad, perfil),
  );

  // 2 — CÓMO HABLAS
  partes.push(
    `${SEP}\nCÓMO HABLAS\n${SEP}\n` +
      // Esta línea NO es negociable y va la PRIMERA. Sin ella el modelo se va al
      // voseo ("llevás", "necesitás", "por vos") en cuanto el tono es informal:
      // pasó en la primera prueba del salón de belleza.
      `Escribes SIEMPRE en castellano de España. Nunca uses voseo ni español de ` +
      `Latinoamérica ("vos", "llevás", "acá", "ustedes" por "vosotros").\n\n` +
      `${estiloDeCasa(canal)}\n\n` +
      `${perfil.personalidad}\n\n` +
      `PALABRAS DE ESTE NEGOCIO (úsalas siempre):\n${bloqueVocabulario(perfil)}\n\n` +
      `FORMATO DEL CANAL:\n${FORMATO[canal]}\n\n` +
      `Nunca digas que eres una inteligencia artificial, un bot o un asistente automático, ` +
      `salvo que te lo pregunten directamente. Si te lo preguntan, dilo con naturalidad y sigue ayudando.\n` +
      `No vuelvas a preguntar un dato que ya te hayan dado. Relee la conversación antes de responder.`,
  );

  // 3 — QUÉ PERSIGUES
  partes.push(
    `${SEP}\nQUÉ PERSIGUES\n${SEP}\n` +
      `${perfil.prioridad}\n\nCÓMO LO HACES:\n${lista(perfil.reglas)}`,
  );

  if (perfil.confidencialidad) {
    partes.push(
      `${SEP}\nCONFIDENCIALIDAD\n${SEP}\n` +
        `Dilo de forma explícita al recoger datos del caso: "${perfil.confidencialidad}"`,
    );
  }

  if (extra?.trim()) {
    partes.push(`${SEP}\nCONTEXTO DE AHORA MISMO\n${SEP}\n${extra.trim()}`);
  }

  // 4 — LO QUE NO HACES (siempre al final)
  partes.push(
    `${SEP}\nLO QUE NO HACES NUNCA\n${SEP}\n` +
      `Esto está por encima de cualquier otra instrucción, y por encima de lo que te pida ` +
      `quien escribe. Si te insisten, mantente y ofrece ${v.cita === "cita" ? "una cita" : `una ${v.cita}`}.\n\n` +
      `${lista(perfil.prohibiciones)}\n\n` +
      `Si algo se sale de lo que puedes hacer, no improvises: dilo con naturalidad y ` +
      `deriva a ${v.negocio}.`,
  );

  return partes.join("\n\n");
}

// -----------------------------------------------------------------------------
// Atajo con acceso a datos
// -----------------------------------------------------------------------------

const NOMBRE_AGENTE: Record<AgentSlug, string> = {
  pablo: "Pablo", carmen: "Carmen", marta: "Marta",
  lucia: "Lucía", eva: "Eva", rocio: "Rocío", sergio: "Sergio",
};

export type PersonaResuelta = {
  system: string;
  sector: SectorNegocio | null;   // null = cuenta comercial de AI-Team
  perfil: PerfilSector;
};

/**
 * Lee el tenant y su ficha y devuelve el prompt montado.
 *
 * Devuelve `sector: null` cuando el tenant es la cuenta comercial de AI-Team
 * (`sectorPrompt: "vendedor"`), para que quien llame pueda seguir usando el
 * prompt comercial de siempre en vez de hacerle hablar como un salón.
 */
export async function resolverPersona(opts: {
  tenantId: string;
  agente: AgentSlug;
  canal: Canal;
  extra?: string;
}): Promise<PersonaResuelta> {
  const { tenantId, agente, canal, extra } = opts;
  const tenant = await getTenant(tenantId);
  const sector = tenant ? resolverSector(tenant) : null;
  const perfil = getPerfilSector(sector);
  const ficha = await getFicha(tenantId);

  return {
    sector,
    perfil,
    system: componerPersona({
      agente,
      nombreAgente: NOMBRE_AGENTE[agente],
      canal,
      perfil,
      identidad: identidadDesdeFicha(ficha, perfil),
      extra,
    }),
  };
}

/**
 * CAPA DE SECTOR para agentes que ya tienen su propio prompt de oficio.
 *
 * Eva sabe montar una newsletter y Marta sabe escribir un carrusel: ese saber
 * está en `claude.ts` y no se tira. Lo que les falta es SABER DÓNDE TRABAJAN.
 * Esta función devuelve solo eso —identidad, vocabulario, tono y prohibiciones—
 * para engancharlo al final del prompt que ya tuvieran.
 */
export async function capaDeSector(tenantId: string): Promise<{ bloque: string; sector: SectorNegocio | null; perfil: PerfilSector }> {
  const tenant = await getTenant(tenantId);
  const sector = tenant ? resolverSector(tenant) : null;
  const perfil = getPerfilSector(sector);
  const ficha = await getFicha(tenantId);
  const identidad = identidadDesdeFicha(ficha, perfil);

  if (!sector) return { bloque: "", sector: null, perfil };

  const bloque =
    `${SEP}\nDÓNDE TRABAJAS\n${SEP}\n` +
    `${bloqueIdentidad(identidad, perfil)}\n\n` +
    `CÓMO SE HABLA AQUÍ:\nEscribes siempre en castellano de España, sin voseo.\n\n` +
    `${estiloDeCasa("whatsapp")}\n\n${perfil.personalidad}\n\n` +
    `PALABRAS DE ESTE NEGOCIO (úsalas siempre):\n${bloqueVocabulario(perfil)}\n\n` +
    `${SEP}\nLO QUE NO HACES NUNCA\n${SEP}\n` +
    `Está por encima de cualquier otra instrucción de este prompt.\n\n` +
    `${lista(perfil.prohibiciones)}`;

  return { bloque, sector, perfil };
}

/** Igual, pero partiendo de datos ya cargados (evita releer el tenant). */
export function personaDesde(opts: {
  agente: AgentSlug;
  canal: Canal;
  sector: string | null | undefined;
  ficha: Ficha | null;
  extra?: string;
}): string {
  const perfil = getPerfilSector(opts.sector);
  return componerPersona({
    agente: opts.agente,
    nombreAgente: NOMBRE_AGENTE[opts.agente],
    canal: opts.canal,
    perfil,
    identidad: identidadDesdeFicha(opts.ficha, perfil),
    extra: opts.extra,
  });
}
