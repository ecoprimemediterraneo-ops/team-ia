// =============================================================================
// PERFIL DE SECTOR — la fuente ÚNICA de verdad de cómo se comporta AI-Team
// para cada tipo de negocio.
// =============================================================================
//
// Cinco sectores: salón de belleza, clínica estética, dentista, gestoría y
// restaurante. Un mismo mensaje entrante tiene que sonar distinto en cada uno, y el
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

export type SectorNegocio = "salon" | "estetica" | "dental" | "gestoria" | "restaurante";

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
// Llamar "paciente" a una clienta de peluquería, o "cita" a un trámite de
// gestoría, delata al bot al instante. Cada sector tiene sus palabras y se
// usan TANTO en los prompts como en los textos del panel.

export type Vocabulario = {
  cliente: string;
  clientePlural: string;
  cita: string;
  citaPlural: string;
  servicio: string;
  servicioPlural: string;
  /** Cómo se llama al conjunto de la actividad ("el salón", "la clínica", "la gestoría"). */
  negocio: string;
};

// -----------------------------------------------------------------------------
// KPIs con los que abre el panel
// -----------------------------------------------------------------------------

export type KpiId =
  | "ocupacion_semana" | "no_shows" | "huecos_rellenados"
  | "leads" | "leads_a_valoracion" | "pipeline"
  | "revisiones_recuperadas" | "presupuestos_convertidos" | "citas_semana"
  | "consultas_recibidas" | "estados_resueltos_solos" | "tiempo_respuesta"
  // Restaurante: lo que se mira antes de abrir es cuánta gente entra hoy.
  | "reservas_hoy" | "comensales_semana";

export type Kpi = { id: KpiId; etiqueta: string; ayuda: string };

// -----------------------------------------------------------------------------
// Funciones que se encienden o se apagan por sector
// -----------------------------------------------------------------------------
// Encender la lista de espera en una gestoría no tiene sentido, y
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
  | "triajeMateria"      // clasificar por materia (del perfil retirado de abogados)
  // --- Gestoría ---
  | "estadoExpediente"   // "¿cómo va lo mío?" contestado sin humano
  | "reclamacionDocs"    // perseguir la documentación que falta
  | "calendarioFiscal"   // avisos de vencimientos por perfil de cliente
  | "clasificacionCorreo" // Lucía ordena el correo por cliente y expediente
  // --- Restauración ---
  | "turnosMesa"         // la reserva ocupa una mesa X tiempo, dentro de un turno
  | "zonaMesa"           // terraza o interior
  | "panelDelDia"        // la pantalla del servicio de hoy
  | "copiarReserva"      // copiar la reserva para pegarla en el software externo
  | "fichaComensal";     // historial del cliente que vuelve, solo para el dueño

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
  estadoExpediente: false,
  reclamacionDocs: false,
  calendarioFiscal: false,
  clasificacionCorreo: false,
  turnosMesa: false,
  zonaMesa: false,
  panelDelDia: false,
  copiarReserva: false,
  fichaComensal: false,
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
// GESTORÍA
// =============================================================================
// Sustituye al perfil de ABOGADOS, que se retiró. El motivo no es de producto,
// es de responsabilidad: la consulta jurídica es única y delicada, y una IA no
// tiene nada que hacer ahí. Una gestoría es el caso contrario — mucho volumen de
// preguntas que se repiten y clientes que vuelven cada trimestre—, que es justo
// donde Pablo rinde.
//
// Se conserva la estructura del perfil anterior (Lucía primero porque el canal
// sigue siendo el correo, horarios de oficina, cancelación con un día) y cambia
// lo que tenía que cambiar: el vocabulario, los trámites y —importante— las
// prohibiciones, porque una gestoría SÍ tiene tarifas cerradas y puede decirlas.
const GESTORIA: PerfilSector = {
  id: "gestoria",
  label: "Gestoría",
  descripcion: "Asesoría fiscal, laboral y contable. Mucha consulta repetida, clientes que vuelven cada trimestre.",
  // Lucía primero: en una gestoría el canal es el correo, igual que en el
  // despacho. Marta NO entra por defecto —aquí Instagram aporta poco—, pero se
  // puede añadir a mano si el cliente la pide.
  agentes: ["lucia", "pablo", "carmen", "eva"],
  kpis: [
    { id: "consultas_recibidas", etiqueta: "Consultas recibidas", ayuda: "Clientes distintos que han preguntado algo" },
    { id: "estados_resueltos_solos", etiqueta: "Estados resueltos solos", ayuda: "Consultas de \u201ccómo va lo mío\u201d contestadas sin que intervenga nadie" },
    { id: "tiempo_respuesta", etiqueta: "Tiempo de respuesta", ayuda: "Cuánto se tarda en contestar" },
  ],
  vocabulario: {
    cliente: "cliente de la gestoría", clientePlural: "clientes de la gestoría",
    cita: "trámite", citaPlural: "trámites",
    servicio: "trámite", servicioPlural: "trámites",
    negocio: "la gestoría",
  },
  personalidad:
    "Clara, práctica y con paciencia. Aquí se pregunta muchas veces lo mismo —qué papeles hacen falta, " +
    "para cuándo es el plazo, cómo va lo mío— y cada persona lo pregunta por primera vez. Tuteo salvo que " +
    "el cliente trate de usted. Sin jerga fiscal: se explica como se lo explicarías a alguien en el mostrador.",
  prioridad:
    "RESOLVER la consulta en el momento si la respuesta está en los datos: el estado de su expediente, qué " +
    "documentación falta, cuándo vence un modelo o cuánto cuesta un trámite. Solo se pasa a una persona lo " +
    "que de verdad necesita a una persona.",
  reglas: [
    "ESTADO DEL EXPEDIENTE: si pregunta \u201ccómo va lo mío\u201d, mira su expediente y dile en qué punto está y qué falta, con fecha si la hay. Es la pregunta más repetida del sector.",
    "DOCUMENTACIÓN: si a su expediente le faltan papeles, dile exactamente cuáles y por dónde mandarlos.",
    "PLAZOS: puedes decir las fechas de los vencimientos generales (trimestrales, renta, modelos) que estén en los datos del negocio.",
    "PRECIOS: esta gestoría tiene tarifas cerradas. Si pregunta por el precio de un trámite y está en la lista, DILO. No lo escondas ni derives a una cita para algo que ya sabes.",
    "Si el trámite no está en la lista del negocio, dilo y ofrece que lo mire el equipo, sin inventar una tarifa.",
    "Cuando haga falta una persona (un caso raro, una inspección, una discrepancia), pásalo al equipo y dilo con claridad, sin dejar al cliente esperando una respuesta que no va a llegar.",
  ],
  prohibiciones: [
    "PROHIBIDO asesorar sobre el fondo de un asunto fiscal o laboral: qué le conviene tributar, cómo estructurar una sociedad, si le sale mejor una cosa u otra. Eso lo dice el gestor.",
    "PROHIBIDO interpretar una notificación, un requerimiento o una sanción de Hacienda o de la Seguridad Social. Se recoge y lo mira el equipo.",
    "PROHIBIDO estimar cuánto le va a salir a pagar, ni de renta ni de un impuesto. La tarifa del TRÁMITE sí; el resultado del impuesto no.",
    "PROHIBIDO dar por presentado o por resuelto un trámite que no conste como tal en su expediente.",
    "No inventes plazos, importes ni requisitos que no estén en los datos del negocio.",
  ],
  confidencialidad:
    "Tus datos fiscales y laborales solo los ve la gestoría, y se tratan de forma confidencial.",
  porQue: {
    resumen:
      "Una gestoría no pierde dinero por no captar: lo pierde en el teléfono. Las mismas tres preguntas —qué papeles hacen falta, cuándo vence, cómo va lo mío— repetidas cien veces al mes, y un cliente que no manda la documentación a tiempo obliga a perseguirlo uno por uno.",
    queHacePorTi: [
      "Contesta \u201ccómo va lo mío\u201d mirando el expediente, sin que nadie coja el teléfono.",
      "Persigue él solo la documentación que falta, y vuelve a insistir a los tres días.",
      "Avisa de los vencimientos —trimestrales, renta, modelos— según lo que tenga contratado cada cliente.",
      "Lucía te ordena el correo por cliente y por expediente, que es donde se te acumula el trabajo.",
      "Dice las tarifas de los trámites que ya tienes cerradas, sin marear al cliente con una cita.",
    ],
    queNoVeras: [
      "Asesoramiento de fondo en el chat: qué te conviene tributar o cómo montar la sociedad lo dice el gestor, no la IA.",
      "Interpretación de requerimientos y sanciones: eso se recoge y lo mira una persona.",
      "Marta (Instagram): en una gestoría el escaparate no trae clientes; los trae el boca a boca y la recomendación. Se puede añadir si la quieres.",
    ],
  },
  alta: {
    paraQuien: "Gestoría o asesoría fiscal, laboral y contable. Clientes que vuelven cada trimestre.",
    ejemplos: {
      nombre: ["Gestoría Márquez", "Asesoría Delgado", "Gestión Integral Peña"],
      actividad: ["Gestoría fiscal y laboral en Málaga", "Asesoría de autónomos y pymes en Sevilla"],
      ofrece: "Renta, nóminas y seguros sociales, altas y bajas de autónomos, impuestos trimestrales, constitución de sociedades",
      publico: "Autónomos y pequeñas empresas de la provincia, muchos de años",
      tono: "Claro y práctico, sin jerga fiscal. Se explica como en el mostrador.",
    },
    categoria: "Trámites",
    // Con TARIFA, al revés que en el perfil anterior: una gestoría las tiene
    // cerradas y esconderlas solo genera una llamada más.
    servicios: [
      { nombre: "Declaración de la renta", durationMin: 45, precioEUR: 60 },
      { nombre: "Nóminas y seguros sociales", durationMin: 30, precioEUR: 45 },
      { nombre: "Alta o baja de autónomo", durationMin: 30, precioEUR: 50 },
      { nombre: "Impuestos trimestrales", durationMin: 30, precioEUR: 75 },
      { nombre: "Constitución de sociedad", durationMin: 60, precioEUR: 350 },
    ],
  },
  funciones: {
    ...NINGUNA,
    // Las cuatro propias del sector.
    estadoExpediente: true,
    reclamacionDocs: true,
    calendarioFiscal: true,
    clasificacionCorreo: true,
    // Heredadas del perfil anterior que siguen teniendo sentido.
    recordatorioConfirmacion: true,
    reactivacion: true,
  },
};

// =============================================================================
// RESTAURANTE
// =============================================================================
// De carta y mantel, con reserva previa. NO menú del día: ahí no se reserva, se
// hace cola. Lo que se vende aquí no es una cita de 30 minutos, es una MESA
// durante dos horas dentro de un turno, y el no-show de un viernes a las 21:30
// es una mesa entera perdida en la única franja del día que da dinero.
const RESTAURANTE: PerfilSector = {
  id: "restaurante",
  label: "Restaurante",
  descripcion: "Carta y mantel con reserva previa. Mucho volumen concentrado en dos turnos y no-shows que duelen.",
  // Carmen la segunda: en restauración el teléfono sigue siendo el canal number
  // uno y una llamada perdida en plena hora punta es una mesa que no entra.
  // Rocío por delante de Eva: aquí se elige restaurante por reseñas de Google.
  agentes: ["pablo", "carmen", "marta", "rocio", "eva"],
  kpis: [
    { id: "reservas_hoy", etiqueta: "Reservas de hoy", ayuda: "Mesas que entran hoy, de los dos turnos" },
    { id: "comensales_semana", etiqueta: "Comensales de la semana", ayuda: "Personas sentadas, no reservas" },
    { id: "no_shows", etiqueta: "No-shows", ayuda: "Reservas que no aparecieron" },
  ],
  vocabulario: {
    cliente: "comensal", clientePlural: "comensales",
    cita: "reserva", citaPlural: "reservas",
    servicio: "turno", servicioPlural: "turnos",
    negocio: "el restaurante",
  },
  personalidad:
    "Amable y muy rápida, con el tono de quien coge el teléfono en plena hora punta: cordial pero sin " +
    "entretenerse. Tuteo. Frases cortas. Nada de florituras gastronómicas ni de vender el sitio: quien " +
    "escribe ya ha decidido que quiere venir, solo falta cerrar la mesa.",
  prioridad:
    "CERRAR LA RESERVA con los cuatro datos que hacen falta: a nombre de quién, cuántas personas, qué día " +
    "y hora, y si prefiere terraza o interior. Nada más. Si falta uno, pídelo; si están los cuatro, cierra.",
  reglas: [
    "Pide SIEMPRE los cuatro datos: nombre, número de personas, día y hora, y preferencia de terraza o interior. Si le da igual la zona, apúntalo como indiferente y sigue.",
    "La mesa se reserva dentro de un TURNO. Si pide una hora que no existe en el turno, ofrécele la hora más cercana que sí exista, sin explicarle cómo funcionan los turnos.",
    "Si no hay hueco a esa hora, ofrece OTRA HORA del mismo turno o del otro turno del día. Dos alternativas concretas, no un “¿qué otra hora te vendría bien?”.",
    "Si ninguna de las dos alternativas le encaja, ofrécele la lista de espera y explícale en una línea que se le avisa por WhatsApp si se libera una mesa.",
    "Por defecto la reserva queda PENDIENTE de que el restaurante la valide. Díselo con naturalidad: que la reserva está tomada y que se le confirma en un momento. No prometas una mesa confirmada si no lo está.",
    "Si el grupo es grande, tómalo igual y avisa de que el restaurante lo confirma: una mesa de doce no se sienta sola.",
    "Si pregunta por la carta o por un plato, responde con lo que haya en los datos del negocio y vuelve a la reserva.",
  ],
  prohibiciones: [
    "No inventes platos, precios, menús ni disponibilidad que no estén en los datos del negocio.",
    "PROHIBIDO dar por confirmada una reserva que está pendiente de que la valide el restaurante.",
    "No garantices una mesa concreta, ni la de la ventana, ni una zona si el restaurante no la tiene.",
    "No des consejos dietéticos ni médicos. Con alergias e intolerancias: apúntalas en la reserva y di que se avisa a cocina, nunca digas tú si un plato es apto.",
    "No ofrezcas descuentos, invitaciones ni promociones que no estén en los datos del negocio.",
  ],
  porQue: {
    resumen:
      "Un restaurante de carta se juega el mes en dos turnos al día. Las reservas entran por teléfono en plena hora punta, por WhatsApp fuera de horario y por Instagram, y quien no coge el teléfono pierde la mesa. El no-show del viernes no se recupera: esa mesa ya no vuelve.",
    queHacePorTi: [
      "Coge las reservas por WhatsApp, Instagram y teléfono, también cuando está lleno y nadie puede atender.",
      "Te las deja todas en un panel del día, ordenadas por hora, con personas, zona y quién es cliente habitual.",
      "Recordatorio el día antes con botón de confirmar o cancelar: es lo único que baja los no-shows de verdad.",
      "Si se llena, apunta a la gente en lista de espera y la avisa cuando se cae una mesa.",
      "Si ya usas otro software de reservas, no hace falta que lo cambies: cada reserva trae un botón para copiarla y pegarla allí.",
    ],
    queNoVeras: [
      "Sergio (vigilancia de la competencia): el restaurante de al lado no te quita mesas, te las quita el teléfono que nadie coge.",
      "Lucía (correo y bandeja): aquí no se reserva por email.",
      "Bonos y packs de sesiones: eso es de un salón, no de una mesa.",
    ],
  },
  alta: {
    paraQuien: "Restaurante de carta con reserva previa. Dos turnos, mesas que rotan y no-shows que duelen.",
    ejemplos: {
      nombre: ["Casa Gutiérrez", "El Rincón de María", "Taberna La Parra"],
      actividad: ["Restaurante de cocina de mercado en Málaga", "Arrocería y carta en Fuengirola"],
      ofrece: "Cocina de mercado, arroces, pescado del día, carta de vinos, terraza",
      publico: "Parejas y familias del barrio entre semana, y mesas grandes de fin de semana",
      tono: "Cercano y rápido, como quien coge el teléfono en plena hora punta. Tuteo, sin florituras.",
    },
    categoria: "Turnos",
    // Los "servicios" de un restaurante son sus TURNOS: lo que se reserva es una
    // mesa dentro de uno, y la duración por defecto es la de la mesa (2 h).
    servicios: [
      { nombre: "Comida · primer turno", durationMin: 120 },
      { nombre: "Comida · segundo turno", durationMin: 120 },
      { nombre: "Cena · primer turno", durationMin: 120 },
      { nombre: "Cena · segundo turno", durationMin: 120 },
    ],
  },
  funciones: {
    ...NINGUNA,
    // Se reutilizan tal cual las tres que ya existen en el sistema.
    listaEspera: true,
    reactivacion: true,
    recordatorioConfirmacion: true,
    // Y las propias de restauración.
    turnosMesa: true,
    zonaMesa: true,
    panelDelDia: true,
    copiarReserva: true,
    fichaComensal: true,
  },
};

// =============================================================================
// Registro y utilidades
// =============================================================================

export const SECTORES: Record<SectorNegocio, PerfilSector> = {
  salon: SALON,
  estetica: ESTETICA,
  dental: DENTAL,
  gestoria: GESTORIA,
  restaurante: RESTAURANTE,
};

export const SECTORES_LISTA: PerfilSector[] = [SALON, ESTETICA, DENTAL, GESTORIA, RESTAURANTE];

export function esSectorNegocio(v: unknown): v is SectorNegocio {
  return v === "salon" || v === "estetica" || v === "dental" || v === "gestoria" || v === "restaurante";
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
  // El sector "legal" (despacho de abogados) se retiró y su perfil pasó a ser
  // GESTORÍA. Los tenants guardados con el valor antiguo se mapean aquí en vez
  // de migrar la base: es una línea y no deja a nadie con el panel roto.
  if (t.sector === "legal") return "gestoria";
  if (t.sectorPrompt === "vendedor") return null; // cuenta comercial de AI-Team
  if (t.sectorPrompt === "dental") return "dental";
  if (t.sectorPrompt === "estetica") return "estetica";
  return SECTOR_POR_DEFECTO;
}
