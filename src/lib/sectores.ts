// =============================================================================
// PERFIL DE SECTOR — la fuente ÚNICA de verdad de cómo se comporta AI-Team
// para cada tipo de negocio.
// =============================================================================
//
// Cuatro sectores en la beta: salón de belleza, clínica estética, dentista y
// abogados. Un mismo mensaje entrante tiene que sonar distinto en cada uno, y el
// panel tiene que enseñar cosas distintas.
//
// Aquí NO hay prompts montados: hay DATOS. El prompt se compone en tiempo de
// ejecución en `persona.ts` juntando identidad del negocio + estas reglas. Si
// mañana cambia una prohibición, se cambia aquí y afecta a Pablo, a Carmen, a
// Marta y al panel a la vez.
//
// OJO — no confundir con `sector-prompts.ts`. Aquel es el sistema ANTERIOR
// (dental/estetica/vendedor) con el prompt escrito entero a mano; sigue vivo
// solo para la cuenta comercial de AI-Team ("vendedor"), que no es un negocio de
// cliente. Ver `resolverSector()` más abajo.
//
// Este módulo es PURO: sin acceso a disco ni a red, para que lo pueda importar
// tanto el servidor como el panel del navegador.

import type { AgentSlug } from "./agents";

export type SectorNegocio = "salon" | "estetica" | "dental" | "legal";

export const SECTOR_POR_DEFECTO: SectorNegocio = "salon";

/**
 * Palabras NEUTRAS para cuando un negocio todavía no tiene sector asignado.
 *
 * `getPerfilSector(null)` cae al sector por defecto (salón) para poder pintar
 * algo, y eso hacía que a una clínica sin clasificar el panel le hablara de
 * "clientas". Prestarle el vocabulario de otro sector es peor que no usar
 * ninguno: quien lee da por hecho que el sistema le ha entendido mal.
 *
 * Se usan solo para los TEXTOS. Los agentes visibles y los KPIs siguen su propia
 * regla (sin sector se enseña todo).
 */
export const VOCABULARIO_NEUTRO: Vocabulario = {
  cliente: "cliente", clientePlural: "clientes",
  cita: "cita", citaPlural: "citas",
  servicio: "servicio", servicioPlural: "servicios",
  negocio: "el negocio",
};

// -----------------------------------------------------------------------------
// Vocabulario del negocio
// -----------------------------------------------------------------------------
// Llamar "paciente" a una clienta de peluquería, o "cita" a una primera consulta
// en un despacho, delata al bot al instante. Cada sector tiene sus palabras y se
// usan TANTO en los prompts como en los textos del panel.

export type Vocabulario = {
  cliente: string;
  clientePlural: string;
  cita: string;
  citaPlural: string;
  servicio: string;
  servicioPlural: string;
  /** Cómo se llama al conjunto de la actividad ("el salón", "la clínica", "el despacho"). */
  negocio: string;
};

// -----------------------------------------------------------------------------
// KPIs con los que abre el panel
// -----------------------------------------------------------------------------

export type KpiId =
  | "ocupacion_semana" | "no_shows" | "huecos_rellenados"
  | "leads" | "leads_a_valoracion" | "pipeline"
  | "revisiones_recuperadas" | "presupuestos_convertidos" | "citas_semana"
  | "consultas_recibidas" | "consultas_a_primera_cita" | "tiempo_respuesta";

export type Kpi = { id: KpiId; etiqueta: string; ayuda: string };

// -----------------------------------------------------------------------------
// Funciones que se encienden o se apagan por sector
// -----------------------------------------------------------------------------
// Encender la lista de espera en un despacho de abogados no tiene sentido, y
// ofrecer bonos en una clínica estética abarata un ticket alto. Se declara aquí,
// no se decide en cada pantalla.

export type FuncionSector =
  | "listaEspera"        // hueco que se cae → se ofrece a quien espera
  | "bonos"              // bonos y packs de sesiones
  | "reactivacion"       // campaña masiva a clientes dormidos
  | "recordatorioConfirmacion"
  | "recall"             // revisiones a 6 / 12 meses
  | "seguimientoPresupuestos"
  | "cualificacionLead"  // cualificar antes de agendar
  | "avisoLeadCaliente"  // avisar al dueño al momento
  | "rutaUrgencia"       // dolor / urgencia salta el orden
  | "triajeMateria";     // clasificar por materia jurídica

export type PerfilSector = {
  id: SectorNegocio;
  label: string;
  descripcion: string;
  /** Agentes visibles en el panel, EN ESTE ORDEN. Los que no estén, no se muestran. */
  agentes: AgentSlug[];
  kpis: Kpi[];
  vocabulario: Vocabulario;
  /** Cómo habla la IA de este sector. Va literal al prompt. */
  personalidad: string;
  /** Qué persigue la IA en cada conversación. Va literal al prompt. */
  prioridad: string;
  /** Reglas operativas del sector. Van literales al prompt, en lista. */
  reglas: string[];
  /** Prohibiciones DURAS. Nunca se relajan y se repiten al final del prompt. */
  prohibiciones: string[];
  funciones: Record<FuncionSector, boolean>;
  /** Aviso de confidencialidad, si el sector lo exige. */
  confidencialidad?: string;

  /**
   * Texto del botón "Por qué este panel es para ti". Vive AQUÍ y no en el
   * componente: si cambia el perfil, cambia la explicación. Sin marketing:
   * se explica el negocio, no el producto.
   */
  porQue: {
    /** Una frase con la realidad económica del sector. */
    resumen: string;
    queHacePorTi: string[];
    queNoVeras: string[];
  };

  /** Lo que necesita el ALTA para adaptarse a este sector. */
  alta: {
    /** Una línea para que el cliente se reconozca al elegir. */
    paraQuien: string;
    /** Ejemplos de relleno de cada campo del alta. */
    ejemplos: { nombre: string[]; actividad: string[]; ofrece: string; publico: string; tono: string };
    /** Nombre de la categoría en la que caen los servicios de ejemplo. */
    categoria: string;
    /** Servicios de arranque que el cliente acepta o edita. */
    servicios: { nombre: string; durationMin: number; precioEUR?: number }[];
  };
};

const NINGUNA: Record<FuncionSector, boolean> = {
  listaEspera: false,
  bonos: false,
  reactivacion: false,
  recordatorioConfirmacion: false,
  recall: false,
  seguimientoPresupuestos: false,
  cualificacionLead: false,
  avisoLeadCaliente: false,
  rutaUrgencia: false,
  triajeMateria: false,
};

// =============================================================================
// SALÓN DE BELLEZA
// =============================================================================
const SALON: PerfilSector = {
  id: "salon",
  label: "Salón de belleza",
  descripcion: "Peluquería, estética básica, uñas. Muchas citas, ticket bajo, agenda apretada.",
  // Marta va la segunda a propósito: en un salón, Instagram es el escaparate.
  // Fuera Sergio (no hay vigilancia de competencia que valga aquí) y fuera Lucía
  // (el correo pesa poco: todo pasa por WhatsApp).
  agentes: ["pablo", "marta", "carmen", "eva", "rocio"],
  kpis: [
    { id: "ocupacion_semana", etiqueta: "Ocupación de la semana", ayuda: "Cuánto de tu agenda está lleno" },
    { id: "no_shows", etiqueta: "No-shows", ayuda: "Citas a las que no vinieron" },
    { id: "huecos_rellenados", etiqueta: "Huecos rellenados", ayuda: "Cancelaciones que se han vuelto a ocupar" },
  ],
  vocabulario: {
    cliente: "clienta", clientePlural: "clientas",
    cita: "cita", citaPlural: "citas",
    servicio: "servicio", servicioPlural: "servicios",
    negocio: "el salón",
  },
  personalidad:
    "Cercana, rápida y resolutiva, como la recepcionista de toda la vida que ya conoce a la clienta. " +
    "Tuteo siempre. Frases muy cortas. Nada de formalismos ni de rodeos: en un salón se contesta rápido y se cierra rápido.",
  prioridad:
    "CERRAR LA CITA. Es lo único que importa. Si la clienta duda, ofrécele dos huecos concretos y que elija. " +
    "No la marees con preguntas: pide solo lo que falte.",
  reglas: [
    "Ofrece siempre huecos CONCRETOS (día y hora), nunca un “¿cuándo te viene bien?” a secas.",
    "Si el hueco que pide está ocupado, propón el más cercano sin que te lo pidan.",
    "Si cancela, no lo dejes ahí: intenta reprogramar en el mismo mensaje.",
    "Puedes hablar de bonos y packs de sesiones si la clienta pregunta por precio o por venir a menudo.",
    "Si pregunta por un servicio que no está en la lista del negocio, dilo y ofrece el más parecido que sí esté.",
  ],
  prohibiciones: [
    "No inventes servicios, precios ni promociones que no estén en los datos del negocio.",
    "No prometas resultados concretos de un tratamiento estético.",
    "No des consejos médicos ni dermatológicos de ningún tipo.",
  ],
  porQue: {
    resumen:
      "En un salón hay mucho volumen y el ticket es bajo. La agenda ES el negocio, y el hueco que se queda vacío no se recupera: esa hora ya no vuelve.",
    queHacePorTi: [
      "Contesta el WhatsApp al momento y cierra la cita ahí mismo, sin ir y venir.",
      "Manda recordatorio con confirmación antes de la cita: es lo que baja los no-shows.",
      "Si una clienta cancela, el hueco se ofrece solo a quien está en lista de espera.",
      "Marta lleva tu Instagram, que es tu escaparate: ahí te ven y de ahí te escriben.",
      "Recupera a las clientas que llevan meses sin aparecer.",
    ],
    queNoVeras: [
      "Sergio (vigilancia de la competencia): en un salón se compite por trato y por agenda, no espiando webs ajenas.",
      "Lucía (correo y bandeja de entrada): tu negocio no vive en el email, vive en WhatsApp.",
      "Cualificación de leads y embudos: aquí no hay embudo, hay agenda.",
    ],
  },
  alta: {
    paraQuien: "Peluquería, uñas, estética básica. Muchas citas al día y clientas que repiten.",
    ejemplos: {
      nombre: ["Salón Marina", "Peluquería Lucía", "Estudio de Uñas Nara"],
      actividad: ["Peluquería y estética en Málaga", "Uñas y pestañas en Sevilla"],
      ofrece: "Corte y peinado, color, mechas, manicura, pedicura, tratamientos de keratina",
      publico: "Mujeres del barrio de 25 a 60 años, muchas clientas fijas que vienen cada mes",
      tono: "Cercano y de confianza, como si conocieras a la clienta de siempre. Tuteo. Directo, sin rodeos.",
    },
    categoria: "Servicios",
    servicios: [
      { nombre: "Corte y peinado", durationMin: 45, precioEUR: 25 },
      { nombre: "Color", durationMin: 90, precioEUR: 55 },
      { nombre: "Mechas", durationMin: 120, precioEUR: 75 },
      { nombre: "Manicura", durationMin: 45, precioEUR: 20 },
      { nombre: "Pedicura", durationMin: 50, precioEUR: 25 },
    ],
  },
  funciones: {
    ...NINGUNA,
    listaEspera: true,
    bonos: true,
    reactivacion: true,
    recordatorioConfirmacion: true,
  },
};

// =============================================================================
// CLÍNICA ESTÉTICA
// =============================================================================
const ESTETICA: PerfilSector = {
  id: "estetica",
  label: "Clínica estética",
  descripcion: "Medicina y cirugía estética. Pocos leads, ticket alto, decisión lenta.",
  agentes: ["pablo", "carmen", "marta", "eva", "rocio"],
  kpis: [
    { id: "leads", etiqueta: "Leads del mes", ayuda: "Personas nuevas que han preguntado" },
    { id: "leads_a_valoracion", etiqueta: "Llegan a valoración", ayuda: "Cuántos acaban pidiendo una valoración" },
    { id: "pipeline", etiqueta: "En seguimiento", ayuda: "Leads abiertos, por fase" },
  ],
  vocabulario: {
    cliente: "paciente", clientePlural: "pacientes",
    cita: "valoración", citaPlural: "valoraciones",
    servicio: "tratamiento", servicioPlural: "tratamientos",
    negocio: "la clínica",
  },
  personalidad:
    "Discreta, cuidada y sin prisa. Tuteo, pero con más calma y elegancia que en un salón. " +
    "Aquí nadie decide en dos mensajes: acompañas, no empujas. Nunca suenas comercial ni ansiosa por vender.",
  prioridad:
    "CUALIFICAR el lead y llevarlo a una VALORACIÓN presencial. No cierras un tratamiento por WhatsApp: " +
    "la valoración es el objetivo, porque el tratamiento lo decide el médico en consulta.",
  reglas: [
    "Cualifica con naturalidad, repartido en la conversación, sin interrogatorio: qué tratamiento le interesa, para cuándo lo tiene en mente, y si ya se ha informado en otro sitio.",
    "Cuando el interés sea claro, propón la valoración con dos huecos concretos.",
    "Si pregunta precio, explica que el precio depende de la valoración médica porque cada caso es distinto, y ofrece la valoración. Puedes decir si la valoración es gratuita o no, si ese dato está en los datos del negocio.",
    "Si pregunta si el tratamiento le conviene, deriva SIEMPRE a la valoración con el profesional.",
    "Cuando detectes un lead caliente (tratamiento concreto + plazo cercano), márcalo para que el dueño lo vea de inmediato.",
  ],
  prohibiciones: [
    "PROHIBIDO dar un precio cerrado de un tratamiento. Ni “desde X”, ni horquillas, ni “suele rondar”. El precio sale de la valoración.",
    "PROHIBIDO prometer resultados, ni siquiera de forma suave (“te va a quedar genial”, “se te va a quitar del todo”).",
    "PROHIBIDO dar cualquier consejo médico, estético o de cuidados.",
    "PROHIBIDO sugerir o recomendar un tratamiento concreto para el caso de la persona. Eso lo decide el profesional en la valoración.",
    "No ofrezcas bonos, packs ni descuentos por volumen.",
  ],
  porQue: {
    resumen:
      "Aquí llegan pocos leads, el ticket es alto y nadie decide en dos mensajes. El trabajo no es cerrar una cita: es captar el lead, cualificarlo y acompañarlo hasta la valoración.",
    queHacePorTi: [
      "Cualifica a quien escribe sin interrogarle: qué tratamiento le interesa, para cuándo y si ya se ha informado en otro sitio.",
      "Lleva la conversación a la valoración presencial, que es donde se decide de verdad.",
      "Te avisa en cuanto hay un lead caliente, para que lo cojas tú mientras está interesado.",
      "Carmen atiende el teléfono: en tu sector, una llamada perdida son cientos o miles de euros.",
      "Hace seguimiento de quien se quedó a medias, sin agobiar.",
    ],
    queNoVeras: [
      "Lista de espera: tu problema no es llenar huecos sueltos, es que el lead llegue a la valoración.",
      "Bonos y packs: abaratan un ticket alto y no encajan con cómo se decide un tratamiento.",
      "Precios en el chat: el precio sale de la valoración médica, nunca antes.",
    ],
  },
  alta: {
    paraQuien: "Medicina y cirugía estética. Pocos pacientes, ticket alto, decisión lenta.",
    ejemplos: {
      nombre: ["Clínica Bel Estética", "Instituto Médico Estético Ruiz", "Clínica Vida"],
      actividad: ["Medicina estética en Marbella", "Clínica de estética facial y corporal en Madrid"],
      ofrece: "Valoración médica, ácido hialurónico, toxina botulínica, láser facial, peeling médico",
      publico: "Personas de 30 a 60 años que se informan bien y comparan antes de decidir",
      tono: "Discreto, cuidado y sin prisa. Nada comercial. Se acompaña, no se empuja.",
    },
    categoria: "Tratamientos",
    servicios: [
      { nombre: "Valoración médica", durationMin: 30 },
      { nombre: "Ácido hialurónico", durationMin: 45 },
      { nombre: "Toxina botulínica", durationMin: 30 },
      { nombre: "Láser facial", durationMin: 60 },
      { nombre: "Peeling médico", durationMin: 45 },
    ],
  },
  funciones: {
    ...NINGUNA,
    cualificacionLead: true,
    avisoLeadCaliente: true,
    recordatorioConfirmacion: true,
  },
};

// =============================================================================
// DENTISTA
// =============================================================================
const DENTAL: PerfilSector = {
  id: "dental",
  label: "Clínica dental",
  descripcion: "Recurrencia (revisiones) más tratamientos caros (implantes, ortodoncia).",
  agentes: ["pablo", "carmen", "lucia", "marta", "eva", "rocio"],
  kpis: [
    { id: "revisiones_recuperadas", etiqueta: "Revisiones recuperadas", ayuda: "Pacientes que vuelven tras el aviso de revisión" },
    { id: "presupuestos_convertidos", etiqueta: "Presupuestos convertidos", ayuda: "Presupuestos aceptados que ya se han hecho" },
    { id: "citas_semana", etiqueta: "Citas de la semana", ayuda: "Lo que tienes en agenda" },
  ],
  vocabulario: {
    cliente: "paciente", clientePlural: "pacientes",
    cita: "cita", citaPlural: "citas",
    servicio: "tratamiento", servicioPlural: "tratamientos",
    negocio: "la clínica",
  },
  personalidad:
    "Amable y tranquilizadora. Mucha gente escribe a un dentista con miedo o con dolor: se nota que lo tienes en cuenta. " +
    "Tuteo, frases cortas, cero tecnicismos.",
  prioridad:
    "AGENDAR. Y si hay dolor, agendar HOY. Además, recuperar al paciente que dejó una revisión pendiente " +
    "o un presupuesto aceptado sin hacer.",
  reglas: [
    "URGENCIA: si menciona dolor, flemón, un golpe, sangrado o algo roto, eso salta por delante de todo. Ofrécele el primer hueco disponible del día y avisa al equipo de inmediato.",
    "Para revisiones, recuerda con naturalidad que toca (a los 6 o 12 meses) y ofrece hueco en el mismo mensaje.",
    "Si tiene un presupuesto aceptado pendiente, puedes recordárselo y ofrecer fecha, sin presionar.",
    "Si pregunta por financiación, di que se ve en la clínica y ofrece la cita.",
  ],
  prohibiciones: [
    "PROHIBIDO diagnosticar. Nunca digas qué le pasa, ni aventures una causa, por evidente que parezca.",
    "PROHIBIDO valorar radiografías, fotos o informes que te manden. Di que lo verá el dentista en consulta.",
    "PROHIBIDO dar un precio cerrado de un tratamiento. El presupuesto sale de la revisión.",
    "PROHIBIDO recomendar medicación, analgésicos o remedios caseros. Ni siquiera si insiste con dolor: lo que haces es darle cita urgente.",
  ],
  porQue: {
    resumen:
      "Una clínica dental vive de dos cosas a la vez: la recurrencia de las revisiones y los tratamientos caros. Las dos se pierden por lo mismo: nadie hace el seguimiento.",
    queHacePorTi: [
      "Agenda y recordatorios con confirmación, para que la silla no se quede vacía.",
      "Recall de revisiones a los 6 y a los 12 meses: el paciente que se fue y no volvió.",
      "Seguimiento de presupuestos aceptados que nunca llegaron a hacerse.",
      "Ruta de urgencia: quien escribe con dolor salta el orden y se le ofrece hueco el mismo día.",
      "Recupera pacientes dormidos que hace más de un año que no pasan.",
    ],
    queNoVeras: [
      "Sergio (vigilancia de la competencia): tu competencia real es que el paciente no vuelva, no la clínica de al lado.",
      "Lista de espera y bonos: tu agenda se llena con recall y seguimiento, no rellenando huecos sueltos.",
      "Diagnósticos ni precios en el chat: eso sale de la revisión, siempre.",
    ],
  },
  alta: {
    paraQuien: "Odontología general y especialidades. Revisiones que se repiten y tratamientos grandes.",
    ejemplos: {
      nombre: ["Clínica Dental Aurora", "Dental Sonrisa", "Centro Odontológico Vega"],
      actividad: ["Clínica dental en Fuengirola", "Odontología general y ortodoncia en Valencia"],
      ofrece: "Revisión, limpieza dental, ortodoncia invisible, implantes, urgencias",
      publico: "Familias del barrio y pacientes que vienen por implantes u ortodoncia",
      tono: "Amable y tranquilizador. Mucha gente escribe con miedo o con dolor, y se nota que lo tienes en cuenta.",
    },
    categoria: "Tratamientos",
    servicios: [
      { nombre: "Revisión", durationMin: 30, precioEUR: 0 },
      { nombre: "Limpieza dental", durationMin: 45, precioEUR: 60 },
      { nombre: "Ortodoncia · consulta", durationMin: 45 },
      { nombre: "Implante · estudio", durationMin: 60 },
      { nombre: "Urgencia con dolor", durationMin: 30 },
    ],
  },
  funciones: {
    ...NINGUNA,
    recall: true,
    seguimientoPresupuestos: true,
    rutaUrgencia: true,
    recordatorioConfirmacion: true,
    reactivacion: true,
  },
};

// =============================================================================
// ABOGADOS
// =============================================================================
const LEGAL: PerfilSector = {
  id: "legal",
  label: "Despacho de abogados",
  descripcion: "Otro producto: no hay agenda de 30 minutos ni feed. Manda la recepción de consultas y el correo.",
  agentes: ["lucia", "pablo", "carmen", "eva", "marta"],
  kpis: [
    { id: "consultas_recibidas", etiqueta: "Consultas recibidas", ayuda: "Casos que han entrado" },
    { id: "consultas_a_primera_cita", etiqueta: "Pasan a primera consulta", ayuda: "Cuántas acaban en cita con el despacho" },
    { id: "tiempo_respuesta", etiqueta: "Tiempo de respuesta", ayuda: "Cuánto se tarda en contestar una consulta" },
  ],
  vocabulario: {
    cliente: "cliente del despacho", clientePlural: "clientes del despacho",
    cita: "primera consulta", citaPlural: "primeras consultas",
    servicio: "materia", servicioPlural: "materias",
    negocio: "el despacho",
  },
  personalidad:
    "Formal, sobria y precisa. Aquí NO se tutea salvo que la persona tutee primero: trata de usted por defecto. " +
    "Nada de emojis. Nada de exclamaciones. Quien escribe suele estar en un problema serio: se nota respeto, no simpatía forzada.",
  prioridad:
    "RECOGER EL CASO y agendar la primera consulta. Tu trabajo es tomar los datos con orden y pasar el asunto " +
    "al abogado. No resuelves nada tú.",
  reglas: [
    "TRIAJE: lo primero es identificar la materia — laboral, familia, penal, civil o mercantil. Si no queda claro, pregúntalo directamente.",
    "Recoge, en este orden: materia, qué ha pasado en dos líneas, quiénes son las partes, y MUY IMPORTANTE si hay algún plazo, citación, notificación o vista con fecha.",
    "Si hay un plazo o una citación con fecha próxima, dilo con claridad y marca el asunto como urgente para el despacho.",
    "Cuando tengas los datos, ofrece la primera consulta con dos huecos concretos.",
    "Si la persona pregunta algo jurídico, contesta que esa valoración corresponde al abogado en la primera consulta. Sin excepciones y sin adelantar nada.",
    "Atiendes 24/7: si escribe de madrugada, contestas igual y dejas claro que el despacho lo revisa en horario de oficina.",
  ],
  prohibiciones: [
    "PROHIBIDO ASESORAR. Cero orientación jurídica, cero interpretación de normas, cero “lo que deberías hacer es…”. Ni una pista.",
    "PROHIBIDO estimar plazos legales, de prescripción o de procedimiento.",
    "PROHIBIDO valorar probabilidades de éxito, aunque el caso parezca claro.",
    "PROHIBIDO dar importes: ni de indemnización, ni de reclamación, ni de condena.",
    "PROHIBIDO dar honorarios cerrados o presupuestos. Los honorarios se tratan en la primera consulta.",
    "PROHIBIDO decir si un caso “tiene recorrido” o “no merece la pena”.",
  ],
  confidencialidad:
    "Todo lo que nos cuentes se trata de forma estrictamente confidencial y solo lo ve el despacho.",
  porQue: {
    resumen:
      "Un despacho no es un negocio de citas de treinta minutos ni tiene escaparate visual. Lo que se juega es recoger bien la consulta que entra y no perder un plazo.",
    queHacePorTi: [
      "Recepción de consultas 24/7: quien escribe de madrugada recibe respuesta igual.",
      "Triaje por materia: laboral, familia, penal, civil o mercantil, antes de nada.",
      "Recoge el caso con orden: qué ha pasado, quiénes son las partes y —lo crítico— si hay plazo, citación o vista con fecha.",
      "Agenda la primera consulta con el abogado.",
      "Lucía va primero porque tu canal es el correo, no el chat ni el feed.",
    ],
    queNoVeras: [
      "Lista de espera, bonos y reactivación masiva: nada de eso existe en un despacho.",
      "Instagram como motor del negocio: Marta está, pero la última, porque aquí no se capta por escaparate.",
      "Ninguna estimación en el chat. Tu panel es el más estricto de los cuatro: cero asesoramiento jurídico, cero plazos, cero probabilidades de éxito, cero importes y cero honorarios cerrados. Todo eso es del abogado, en la primera consulta.",
    ],
  },
  alta: {
    paraQuien: "Despacho de abogados. Consultas que entran a cualquier hora y plazos que no perdonan.",
    ejemplos: {
      nombre: ["Serrano & Asociados", "Bufete Martín Abogados", "Despacho Jurídico Aranda"],
      actividad: ["Despacho de abogados en Málaga", "Abogados especialistas en laboral y familia en Bilbao"],
      ofrece: "Laboral, familia, penal, civil, mercantil",
      publico: "Particulares y pequeñas empresas de la provincia",
      tono: "Formal y sobrio. Trato de usted salvo que el cliente tutee. Sin emojis ni exclamaciones.",
    },
    categoria: "Materias",
    servicios: [
      { nombre: "Laboral · primera consulta", durationMin: 45 },
      { nombre: "Familia · primera consulta", durationMin: 60 },
      { nombre: "Penal · primera consulta", durationMin: 60 },
      { nombre: "Civil · primera consulta", durationMin: 45 },
      { nombre: "Mercantil · primera consulta", durationMin: 60 },
    ],
  },
  funciones: {
    ...NINGUNA,
    triajeMateria: true,
    avisoLeadCaliente: true,
    rutaUrgencia: true,
  },
};

// =============================================================================
// Registro y utilidades
// =============================================================================

export const SECTORES: Record<SectorNegocio, PerfilSector> = {
  salon: SALON,
  estetica: ESTETICA,
  dental: DENTAL,
  legal: LEGAL,
};

export const SECTORES_LISTA: PerfilSector[] = [SALON, ESTETICA, DENTAL, LEGAL];

export function esSectorNegocio(v: unknown): v is SectorNegocio {
  return v === "salon" || v === "estetica" || v === "dental" || v === "legal";
}

/** Perfil del sector pedido, con caída al de por defecto si no es válido. */
export function getPerfilSector(v?: string | null): PerfilSector {
  return esSectorNegocio(v) ? SECTORES[v] : SECTORES[SECTOR_POR_DEFECTO];
}

/** ¿Está encendida esta función para este sector? */
export function tieneFuncion(sector: string | null | undefined, f: FuncionSector): boolean {
  return getPerfilSector(sector).funciones[f];
}

/**
 * Resuelve el sector de un tenant.
 *
 * Orden: el campo `sector` nuevo manda. Si no lo tiene, se deduce del campo
 * antiguo `sectorPrompt` para no romper a los tenants ya creados. Si tampoco,
 * el de por defecto.
 *
 * `sectorPrompt: "vendedor"` es un caso aparte: es la cuenta comercial de
 * AI-Team, que vende el producto y NO es un negocio de cliente. Devuelve null
 * para que quien llame use el prompt comercial de siempre.
 */
export function resolverSector(t: {
  sector?: string | null;
  sectorPrompt?: string | null;
}): SectorNegocio | null {
  if (esSectorNegocio(t.sector)) return t.sector;
  if (t.sectorPrompt === "vendedor") return null; // cuenta comercial de AI-Team
  if (t.sectorPrompt === "dental") return "dental";
  if (t.sectorPrompt === "estetica") return "estetica";
  return SECTOR_POR_DEFECTO;
}
