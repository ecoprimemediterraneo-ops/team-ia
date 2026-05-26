export type CiudadData = {
  slug: string;
  nombre: string;
  provincia: string;
  demonym: string; // malagueño, marbellí...
  population: string;
  highlight: string; // dato curioso local
};

export const CIUDADES: CiudadData[] = [
  { slug: "malaga", nombre: "Málaga", provincia: "Málaga", demonym: "malagueño", population: "580.000", highlight: "capital de la Costa del Sol con más de 300 días de sol al año" },
  { slug: "marbella", nombre: "Marbella", provincia: "Málaga", demonym: "marbellí", population: "145.000", highlight: "destino internacional con alta concentración de turistas y expats" },
  { slug: "fuengirola", nombre: "Fuengirola", provincia: "Málaga", demonym: "fuengiroleño", population: "80.000", highlight: "municipio con una de las mayores comunidades de expats del sur de España" },
  { slug: "torremolinos", nombre: "Torremolinos", provincia: "Málaga", demonym: "torremolinense", population: "70.000", highlight: "destino turístico líder de la Costa del Sol occidental" },
  { slug: "benalmadena", nombre: "Benalmádena", provincia: "Málaga", demonym: "benalmadense", population: "67.000", highlight: "municipio en pleno crecimiento residencial y turístico" },
  { slug: "estepona", nombre: "Estepona", provincia: "Málaga", demonym: "esteponero", population: "72.000", highlight: "ciudad de las flores con fuerte crecimiento de negocios locales" },
  { slug: "nerja", nombre: "Nerja", provincia: "Málaga", demonym: "nerjeño", population: "22.000", highlight: "municipio turístico de la Axarquía con alta demanda de servicios" },
  { slug: "sevilla", nombre: "Sevilla", provincia: "Sevilla", demonym: "sevillano", population: "690.000", highlight: "capital andaluza y cuarta ciudad de España" },
  { slug: "granada", nombre: "Granada", provincia: "Granada", demonym: "granadino", population: "230.000", highlight: "ciudad universitaria con gran movimiento comercial" },
  { slug: "almeria", nombre: "Almería", provincia: "Almería", demonym: "almeriense", population: "200.000", highlight: "capital del sureste español en plena expansión" },
  { slug: "madrid", nombre: "Madrid", provincia: "Madrid", demonym: "madrileño", population: "3.300.000", highlight: "capital de España y mayor mercado de PYME del país" },
  { slug: "barcelona", nombre: "Barcelona", provincia: "Barcelona", demonym: "barcelonés", population: "1.600.000", highlight: "capital económica del Mediterráneo con tejido empresarial muy denso" },
  { slug: "valencia", nombre: "Valencia", provincia: "Valencia", demonym: "valenciano", population: "800.000", highlight: "tercera ciudad de España en pleno auge de emprendimiento" },
  { slug: "bilbao", nombre: "Bilbao", provincia: "Vizcaya", demonym: "bilbaíno", population: "350.000", highlight: "referente industrial y gastronómico del norte de España" },
  { slug: "zaragoza", nombre: "Zaragoza", provincia: "Zaragoza", demonym: "zaragozano", population: "680.000", highlight: "nudo logístico central de España con fuerte comercio local" },
  { slug: "murcia", nombre: "Murcia", provincia: "Murcia", demonym: "murciano", population: "460.000", highlight: "región con alta densidad de PYME del sector servicios" },
  { slug: "alicante", nombre: "Alicante", provincia: "Alicante", demonym: "alicantino", population: "330.000", highlight: "destino turístico clave con gran actividad comercial todo el año" },
  { slug: "cordoba", nombre: "Córdoba", provincia: "Córdoba", demonym: "cordobés", population: "320.000", highlight: "ciudad Patrimonio de la Humanidad con fuerte turismo y hostelería" },
  { slug: "valladolid", nombre: "Valladolid", provincia: "Valladolid", demonym: "vallisoletano", population: "295.000", highlight: "capital castellana con importante tejido de pymes y comercio tradicional" },
];

export function getCiudad(slug: string): CiudadData | null {
  return CIUDADES.find((c) => c.slug === slug) ?? null;
}

export type VerticalCiudad = {
  vertical: "dentistas" | "peluquerias" | "restaurantes" | "fisioterapeutas" | "abogados" | "asesorias" | "gimnasios" | "podologos";
  emoji: string;
  sector: string;
  titulo: (ciudad: string) => string;
  descripcion: (ciudad: string, demonym: string) => string;
  pains: string[];
  cta: string;
};

export const VERTICALS: Record<string, VerticalCiudad> = {
  dentistas: {
    vertical: "dentistas",
    emoji: "🦷",
    sector: "Clínica Dental",
    titulo: (ciudad) => `IA para Clínicas Dentales en ${ciudad}`,
    descripcion: (ciudad, demonym) =>
      `El equipo de 8 agentes IA que los clínicas dentales de ${ciudad} necesitan. Reduce no-shows, contesta WhatsApp 24/7 y sube tu Google sin contratar a nadie.`,
    pains: [
      "WhatsApp sin contestar a las 22h un viernes",
      "3 de cada 10 citas se caen sin avisar",
      "Presupuestos que quedan en el aire sin seguimiento",
      "Reseñas Google sin responder desde hace semanas",
    ],
    cta: "Quiero probarlo gratis en mi negocio",
  },
  peluquerias: {
    vertical: "peluquerias",
    emoji: "💇",
    sector: "Peluquería",
    titulo: (ciudad) => `IA para Peluquerías en ${ciudad}`,
    descripcion: (ciudad, demonym) =>
      `Automatiza WhatsApp, Instagram y recordatorios de cita en tu peluquería de ${ciudad}. Sin contratar community manager ni recepcionista extra.`,
    pains: [
      "WhatsApp explotado el sábado por la mañana",
      "Clientas que no confirman y dejan huecos vacíos",
      "Instagram sin actualizar desde hace semanas",
      "Clientas que no vuelven porque nadie las llama",
    ],
    cta: "Quiero automatizar mi salón",
  },
  restaurantes: {
    vertical: "restaurantes",
    emoji: "🍽️",
    sector: "Restaurante",
    titulo: (ciudad) => `IA para Restaurantes en ${ciudad}`,
    descripcion: (ciudad, demonym) =>
      `Gestiona reservas por WhatsApp 24/7, responde en inglés a turistas y sube tus reseñas en TripAdvisor y Google. Para restaurantes de ${ciudad}.`,
    pains: [
      "Turistas que llaman en inglés y nadie les atiende",
      "Reservas que llegan por WhatsApp a las 23h",
      "TripAdvisor sin respuestas desde meses",
      "Instagram con fotos de los platos sin publicar",
    ],
    cta: "Quiero gestionar mejor mis reservas",
  },
  fisioterapeutas: {
    vertical: "fisioterapeutas",
    emoji: "🦴",
    sector: "Negocio de Fisioterapia",
    titulo: (ciudad) => `IA para Negocios de Fisioterapia en ${ciudad}`,
    descripcion: (ciudad) =>
      `Recordatorios automáticos, reseñas Google y WhatsApp 24/7 para negocios de fisioterapia en ${ciudad}. Reduce no-shows del 28% al 8%.`,
    pains: [
      "Pacientes que cancelan a última hora dejando hueco vacío",
      "WhatsApp con dudas sobre dolor lumbar fuera de horario",
      "Sin recordatorios automáticos = no-shows altos",
      "Reseñas Google estancadas mientras tu vecino sube",
    ],
    cta: "Reduce mis no-shows",
  },
  abogados: {
    vertical: "abogados",
    emoji: "⚖️",
    sector: "Despacho de Abogados",
    titulo: (ciudad) => `IA para Despachos de Abogados en ${ciudad}`,
    descripcion: (ciudad) =>
      `Lucía gestiona tu bandeja, Pablo cualifica leads por WhatsApp y Eva envía secuencias a contactos. Despachos en ${ciudad}.`,
    pains: [
      "Bandeja de correo saturada con consultas no cualificadas",
      "Leads que llegan por web sin seguimiento estructurado",
      "Pierdes 5h/semana en filtrar consultas básicas",
      "Sin email marketing = clientes inactivos que olvidan que existes",
    ],
    cta: "Automatizar mi despacho",
  },
  asesorias: {
    vertical: "asesorias",
    emoji: "📊",
    sector: "Asesoría / Gestoría",
    titulo: (ciudad) => `IA para Asesorías y Gestorías en ${ciudad}`,
    descripcion: (ciudad) =>
      `Atención automatizada de dudas frecuentes (modelo 130, autónomos, IVA) por WhatsApp y email. Asesorías en ${ciudad}.`,
    pains: [
      "Mismas 20 preguntas cada trimestre vía WhatsApp",
      "Plazos olvidados por clientes (recordatorios manuales agotadores)",
      "Sin email marketing = no captas nuevos autónomos",
      "Tiempo del titular consumido en consultas básicas",
    ],
    cta: "Automatizar mi gestoría",
  },
  gimnasios: {
    vertical: "gimnasios",
    emoji: "💪",
    sector: "Gimnasio / Centro deportivo",
    titulo: (ciudad) => `IA para Gimnasios y Centros Deportivos en ${ciudad}`,
    descripcion: (ciudad) =>
      `Reservas de clases, reactivación de socios inactivos y reseñas Google automatizadas para gimnasios en ${ciudad}.`,
    pains: [
      "Socios inactivos que no se reactivan (churn alto)",
      "WhatsApp explotado pidiendo reservas de clases",
      "Sin email marketing = no comunicas eventos ni promos",
      "Reseñas Google bajas vs cadenas grandes",
    ],
    cta: "Reactivar a mis socios",
  },
  podologos: {
    vertical: "podologos",
    emoji: "🦶",
    sector: "Negocio de Podología",
    titulo: (ciudad) => `IA para Negocios de Podología en ${ciudad}`,
    descripcion: (ciudad) =>
      `WhatsApp 24/7, reseñas Google y email marketing para negocios de podología en ${ciudad}. Pack desde 79€/mes.`,
    pains: [
      "Pacientes mayores que llaman fuera de horario sin respuesta",
      "Recordatorios manuales agotan a la recepcionista",
      "Sin sistema de captación de plantillas a medida",
      "Reseñas Google estancadas — pierdes ranking local",
    ],
    cta: "Cubrir todos mis canales",
  },
};
