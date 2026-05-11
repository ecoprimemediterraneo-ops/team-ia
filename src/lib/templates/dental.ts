/**
 * Plantillas de mensajes WhatsApp y email para clínicas dentales.
 * El nombre del negocio se sustituye con {{clinica}}, paciente con {{nombre}}, etc.
 */

export type Template = {
  id: string;
  channel: "whatsapp" | "email";
  category: string;
  title: string;
  body: string;
  variables: string[];
};

export const DENTAL_TEMPLATES: Template[] = [
  // RECORDATORIOS
  {
    id: "recordatorio-24h",
    channel: "whatsapp",
    category: "Recordatorios",
    title: "Recordatorio cita 24h antes",
    body: "¡Hola {{nombre}}! 👋 Te recordamos tu cita mañana a las {{hora}} en {{clinica}}. ¿Confirmas que vendrás? Responde SÍ o pídenos cambio. ¡Hasta mañana!",
    variables: ["nombre", "hora", "clinica"],
  },
  {
    id: "recordatorio-2h",
    channel: "whatsapp",
    category: "Recordatorios",
    title: "Recordatorio cita 2h antes",
    body: "¡{{nombre}}! Tu cita es a las {{hora}} en {{clinica}} ({{direccion}}). Trae DNI y tarjeta sanitaria si vienes por seguro. Aparcamiento en {{parking}}. ¡Te esperamos!",
    variables: ["nombre", "hora", "clinica", "direccion", "parking"],
  },
  {
    id: "post-cita-resena",
    channel: "whatsapp",
    category: "Reseñas",
    title: "Pedir reseña tras cita",
    body: "¡{{nombre}}! Esperamos que tu visita en {{clinica}} fuera bien 🦷. Si te tomas 30 segundos para dejarnos una reseña en Google, nos ayudas un montón a seguir ofreciendo este servicio: {{linkResena}}. ¡Gracias!",
    variables: ["nombre", "clinica", "linkResena"],
  },

  // INACTIVOS
  {
    id: "recuperar-inactivo-6m",
    channel: "whatsapp",
    category: "Recuperación pacientes",
    title: "Paciente >6 meses sin venir",
    body: "¡Hola {{nombre}}! 🦷 Hemos visto que hace {{meses}} meses no nos visitas en {{clinica}}, sabemos que la vida se complica. Si quieres ponerte al día, esta semana hacemos revisión gratuita + limpieza por {{precio}}€. ¿Reservamos un hueco?",
    variables: ["nombre", "meses", "clinica", "precio"],
  },
  {
    id: "recuperar-inactivo-email",
    channel: "email",
    category: "Recuperación pacientes",
    title: "Email a paciente inactivo (subject)",
    body: `Asunto: {{nombre}}, ¿cómo va tu sonrisa?

Hola {{nombre}},

Hace {{meses}} meses que no te vemos por {{clinica}} y queríamos saludarte. La vida se complica, lo sabemos.

Si quieres aprovechar para una revisión rápida, esta semana hacemos:
✓ Revisión completa (gratis)
✓ Limpieza ultrasónica ({{precio}}€ en vez de 60€)
✓ Sin compromiso

Si prefieres dejarlo para más adelante, todo bien. Aquí estamos cuando quieras.

Un abrazo,
Equipo {{clinica}}`,
    variables: ["nombre", "meses", "clinica", "precio"],
  },

  // PRESUPUESTOS
  {
    id: "seguimiento-presupuesto-3d",
    channel: "whatsapp",
    category: "Presupuestos",
    title: "Seguimiento presupuesto a los 3 días",
    body: "¡Hola {{nombre}}! 👋 Te escribo solo para preguntarte si pudiste echar un ojo al presupuesto del {{tratamiento}} que te pasamos el {{fecha}}. Si tienes dudas, escríbeme y te lo aclaro sin compromiso. Tranquilo que no hay prisa.",
    variables: ["nombre", "tratamiento", "fecha"],
  },
  {
    id: "presupuesto-financiacion",
    channel: "whatsapp",
    category: "Presupuestos",
    title: "Ofrecer financiación si dice «caro»",
    body: "Lo entendemos perfectamente, {{nombre}}. Es una inversión importante. Te lo dejamos congelado 6 meses por si cambias de idea. Si quieres, también podemos partirlo en 12 meses sin intereses ({{cuota}}€/mes). Cuando quieras retomarlo, aquí estamos.",
    variables: ["nombre", "cuota"],
  },

  // URGENCIAS
  {
    id: "urgencia-real-instrucciones",
    channel: "whatsapp",
    category: "Urgencias",
    title: "Instrucciones urgencia real",
    body: "{{nombre}}, esto suena a algo que necesita atención YA. Toma ibuprofeno 600mg si no eres alérgic@ y aplica frío en la mejilla 15 min cada hora. NO te tumbes ni apliques calor. Te llama el dentista en 5 minutos al móvil.",
    variables: ["nombre"],
  },
  {
    id: "urgencia-menor-cita",
    channel: "whatsapp",
    category: "Urgencias",
    title: "Cita prioritaria urgencia menor",
    body: "Tranquila, {{nombre}}, no es urgencia inmediata. Mientras tanto: evita masticar por ese lado y enjuaga con agua templada con sal después de comer. Te ofrezco hueco mañana a las {{hora1}} o {{hora2}}. ¿Cuál te encaja mejor?",
    variables: ["nombre", "hora1", "hora2"],
  },

  // BIENVENIDA NUEVO PACIENTE
  {
    id: "bienvenida-paciente-nuevo",
    channel: "email",
    category: "Bienvenida",
    title: "Email bienvenida paciente nuevo",
    body: `Asunto: Bienvenido a {{clinica}}, {{nombre}} 🦷

¡Hola {{nombre}}!

Bienvenido a {{clinica}}. Acabamos de agendarte tu primera cita el {{fecha}} a las {{hora}}.

Para que la visita vaya rápida, te dejamos por aquí algunas cosas que conviene saber:

→ Llega 5 min antes para rellenar la ficha del paciente.
→ Trae DNI y, si tienes, tarjeta del seguro privado o cartilla SS.
→ Aparcamiento gratuito en {{parking}}.
→ Si tomas algún medicamento, dínoslo al llegar.

Si necesitas cancelar o cambiar la cita, avísanos con 24h por WhatsApp en {{whatsapp}}.

¡Te esperamos!

Equipo {{clinica}}`,
    variables: ["nombre", "clinica", "fecha", "hora", "parking", "whatsapp"],
  },
];

export function fillTemplate(template: Template, vars: Record<string, string>): string {
  let body = template.body;
  for (const [key, value] of Object.entries(vars)) {
    body = body.replaceAll(`{{${key}}}`, value);
  }
  return body;
}
