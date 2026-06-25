/**
 * Secuencias de email automáticas (función de email del sistema).
 * Cada secuencia tiene N pasos con delay en días desde el primer contacto.
 * Sin nombres de persona ni métricas/casos inventados: el protagonista es
 * "el sistema". Los enlaces de cal.com llevan el slug personal del fundador
 * (cuenta existente, no se puede cambiar sin recrearla).
 */

export type SequenceStep = {
  step: number;
  delayDays: number;
  subject: string;
  bodyHtml: (vars: Record<string, string>) => string;
};

export type Sequence = {
  id: string;
  name: string;
  sector: string;
  steps: SequenceStep[];
};

const v = (vars: Record<string, string>, key: string, fallback = "") =>
  vars[key] ?? fallback;

const FOOT = `<p style="color:#999;font-size:12px">AI-Team · <a href="{{unsubscribeUrl}}">Cancelar suscripción</a></p>`;
const BTN = "background:#E8B84B;color:#000;padding:10px 20px;font-weight:bold;text-decoration:none;display:inline-block";
const CAL = "https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min";

export const SEQUENCES: Sequence[] = [
  {
    id: "dental-cold",
    name: "Outreach Clínicas Dentales",
    sector: "dentistas",
    steps: [
      {
        step: 1,
        delayDays: 0,
        subject: "{{businessName}}: las citas que se caen tienen solución",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")} 👋</p>
<p>Te escribo desde AI-Team.</p>
<p>Veo que <strong>${v(vars, "businessName")}</strong> tiene ${v(vars, "reviewCount", "buenas")} reseñas en Google — eso es una clínica que cuida a sus pacientes. Por eso me permito escribir.</p>
<p>El problema que vemos en la mayoría de clínicas como la vuestra: <strong>WhatsApp sin contestar por las noches, no-shows que no avisan y presupuestos que se pierden sin seguimiento.</strong></p>
<p>Tenemos un sistema operativo que se ocupa de todo eso a la vez: contesta WhatsApp 24/7, coge las llamadas cuando estáis con un paciente y pide reseñas tras cada visita. Un único sistema, no herramientas sueltas.</p>
<p>¿Tiene sentido hablar 15 minutos esta semana?</p>
<p><a href="${CAL}" style="${BTN}">→ Pide tu demo gratis</a></p>
${FOOT}`,
      },
      {
        step: 2,
        delayDays: 3,
        subject: "Re: {{businessName}} — una pregunta rápida",
        bodyHtml: (vars) => `
<p>Hola de nuevo ${v(vars, "contactName", "equipo")} 👋</p>
<p>Solo quería saber si viste el email anterior.</p>
<p>Una pregunta directa: ¿cuántas citas perdéis al mes por no-shows o porque nadie contestó el WhatsApp a tiempo? En muchas clínicas pequeñas son varias cada mes — dinero en humo.</p>
<p>El sistema lo resuelve con un setup rápido, sin cambiar vuestro software dental.</p>
<p><a href="${CAL}" style="${BTN}">→ Ver cómo funciona (15 min)</a></p>
${FOOT}`,
      },
      {
        step: 3,
        delayDays: 7,
        subject: "Lo que cambia cuando el sistema lleva la clínica",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Cómo cambia el día a día de una clínica con el sistema:</p>
<ul>
<li>✅ Menos no-shows, con recordatorios automáticos</li>
<li>✅ Más reseñas en Google, pedidas tras cada visita</li>
<li>✅ Citas que antes se perdían por WhatsApp, recuperadas</li>
<li>✅ WhatsApp contestado en minutos a cualquier hora</li>
</ul>
<p>Setup rápido, sin tocar tu software dental. <strong>Precio fundador: 149€/mes para siempre.</strong></p>
<p><a href="https://aiteam.marketing/casos" style="${BTN}">→ Ver cómo funciona</a></p>
${FOOT}`,
      },
      {
        step: 4,
        delayDays: 14,
        subject: "Último intento — una idea para {{businessName}}",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Es nuestro último email. No queremos ser pesados.</p>
<p>Solo queríamos ofreceros algo: <strong>6 meses gratis</strong> (20 plazas fundadoras) a cambio de feedback honesto. Sin tarjeta, sin permanencia.</p>
<p>Si al mes no veis valor, lo dejáis y no hay más emails. Promesa.</p>
<p>Si os interesa, respondednos con "quiero probarlo" y os montamos el acceso esta semana.</p>
${FOOT}`,
      },
      {
        step: 5,
        delayDays: 30,
        subject: "{{businessName}} — seguimos por aquí",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Hace un tiempo os escribimos. Imagino que estáis a tope.</p>
<p>Rápido: hemos mejorado la gestión de citas directamente por WhatsApp. Funciona muy bien con clínicas dentales.</p>
<p>Si en algún momento queréis ver cómo lo hacemos, aquí estamos.</p>
<p><a href="${CAL}">Reservar 15 minutos →</a></p>
${FOOT}`,
      },
    ],
  },
  {
    id: "salon-cold",
    name: "Outreach Peluquerías y Salones",
    sector: "peluquerias",
    steps: [
      {
        step: 1,
        delayDays: 0,
        subject: "{{businessName}}: el sábado por la mañana no tiene que ser un caos",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")} 👋</p>
<p>Te escribo desde AI-Team.</p>
<p>El sábado a las 9h: el salón lleno, el teléfono sin parar, el WhatsApp con mensajes sin contestar y tú cortando el pelo. ¿Te suena?</p>
<p>El sistema contesta por ti: confirma citas, da precios y gestiona cancelaciones. 24/7.</p>
<p>Y lleva tu Instagram: publica fotos de tus trabajos cada semana, sin que toques el móvil.</p>
<p>Todo por <strong>149€/mes</strong> (precio fundador para siempre).</p>
<p><a href="${CAL}" style="${BTN}">→ Pide tu demo (15 min)</a></p>
${FOOT}`,
      },
      {
        step: 2,
        delayDays: 4,
        subject: "¿Cuántas clientas no vuelven porque nadie las llama?",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Un patrón habitual en salones como ${v(vars, "businessName")}: muchas clientas no vuelven si nadie les manda un recordatorio a tiempo.</p>
<p>El sistema manda un mensaje automático a las clientas que llevan semanas sin volver y reactiva el contacto sin que hagas nada.</p>
<p>¿Cuánto vale una clienta fija para vosotros?</p>
<p><a href="https://aiteam.marketing/peluquerias">Ver cómo funciona para salones →</a></p>
${FOOT}`,
      },
      {
        step: 3,
        delayDays: 10,
        subject: "Tu Instagram y tu agenda, en piloto automático",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Lo que un salón deja de hacer a mano con el sistema, sin community manager ni recepcionista extra:</p>
<ul>
<li>Instagram publicado cada semana, con fotos de tus trabajos</li>
<li>Clientas que repiten más, gracias a recordatorios automáticos</li>
<li>Horas a la semana que dejas de gastar gestionando mensajes</li>
</ul>
<p>Inversión: 149€/mes.</p>
<p><a href="https://aiteam.marketing/casos" style="${BTN}">→ Ver cómo funciona</a></p>
${FOOT}`,
      },
    ],
  },
  {
    id: "restaurante-cold",
    name: "Outreach Restaurantes",
    sector: "restaurantes",
    steps: [
      {
        step: 1,
        delayDays: 0,
        subject: "{{businessName}}: reservas por WhatsApp que llegan a las 23h",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")} 👋</p>
<p>Te escribo desde AI-Team.</p>
<p>Un turista a las 23h busca restaurante para mañana. Os escribe por WhatsApp. Nadie contesta. Reserva en el de al lado.</p>
<p>El sistema contesta en segundos, en español e inglés. Confirma la reserva, manda recordatorio el día anterior y, si cancelan, libera la mesa automáticamente.</p>
<p>Responde cada reseña de TripAdvisor y Google, y publica fotos de los platos cada semana.</p>
<p><strong>Todo por 149€/mes.</strong></p>
<p><a href="${CAL}" style="${BTN}">→ Pide tu demo (15 min)</a></p>
${FOOT}`,
      },
      {
        step: 2,
        delayDays: 5,
        subject: "Más reservas online, sin cambiar tu forma de trabajar",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Lo que cambia en un restaurante con el sistema:</p>
<ul>
<li>Más reservas online, también fuera de horario</li>
<li>Reseñas de TripAdvisor y Google respondidas</li>
<li>Atención por WhatsApp en español e inglés</li>
</ul>
<p>Sin cambiar vuestra forma de trabajar. Sin contratar a nadie.</p>
<p><a href="https://aiteam.marketing/casos">Ver cómo funciona →</a></p>
${FOOT}`,
      },
    ],
  },
  {
    id: "nurture-30d",
    name: "Re-contacto Leads Fríos (30 días)",
    sector: "all",
    steps: [
      {
        step: 1,
        delayDays: 0,
        subject: "¿Seguís buscando solución para {{businessName}}?",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Hace un tiempo hablamos sobre automatizar el WhatsApp y las reseñas de ${v(vars, "businessName")}.</p>
<p>Hemos mejorado algo: <strong>onboarding en 24h</strong>. El sistema funcionando el mismo día que te das de alta.</p>
<p>¿Sigue siendo algo que os interesa?</p>
<p><a href="${CAL}">Reservar 15 min →</a></p>
${FOOT}`,
      },
    ],
  },
  {
    id: "nurture-60d",
    name: "Re-contacto Leads Fríos (60 días)",
    sector: "all",
    steps: [
      {
        step: 1,
        delayDays: 0,
        subject: "Nueva función para {{sector}}: {{businessName}}",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Hace un tiempo os escribimos. Desde entonces hemos añadido:</p>
<ul>
<li>✅ Gestión de citas directa por WhatsApp</li>
<li>✅ Respuesta automática en inglés (para turistas)</li>
<li>✅ Seguimiento de presupuestos dentales automático</li>
</ul>
<p>Si ahora es mejor momento, encantados de enseñaros en 15 minutos.</p>
<p><a href="${CAL}">Ver demo →</a></p>
${FOOT}`,
      },
    ],
  },
];

export function getSequence(id: string): Sequence | undefined {
  return SEQUENCES.find((s) => s.id === id);
}

export function getSequenceForSector(sector: string): Sequence | undefined {
  return SEQUENCES.find((s) => s.sector === sector && s.id.endsWith("-cold"));
}
