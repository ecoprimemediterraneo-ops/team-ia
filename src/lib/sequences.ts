/**
 * Secuencias de email automáticas para Eva.
 * Cada secuencia tiene N pasos con delay en días desde el primer contacto.
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

export const SEQUENCES: Sequence[] = [
  {
    id: "dental-cold",
    name: "Outreach Clínicas Dentales",
    sector: "dentistas",
    steps: [
      {
        step: 1,
        delayDays: 0,
        subject: "{{businessName}}: 3 de cada 10 citas se caen (y hay solución)",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")} 👋</p>
<p>Soy Eva, del equipo de AI-Team.</p>
<p>Veo que <strong>${v(vars, "businessName")}</strong> tiene ${v(vars, "reviewCount", "buenas")} reseñas en Google — eso es una clínica que cuida a sus pacientes. Por eso me permito escribir.</p>
<p>El problema que veo en la mayoría de clínicas como la vuestra: <strong>WhatsApp sin contestar por las noches, no-shows que no avisan, y presupuestos que se pierden sin seguimiento.</strong></p>
<p>Nosotros tenemos 8 agentes IA que se ocupan de todo eso: Pablo contesta WhatsApp 24/7, Carmen coge las llamadas cuando el dentista está con un paciente, Rocío pide reseñas tras cada visita.</p>
<p>¿Tiene sentido hablar 15 minutos esta semana?</p>
<p><a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" style="background:#E8B84B;color:#000;padding:10px 20px;font-weight:bold;text-decoration:none;display:inline-block">→ Reservar demo gratis</a></p>
<p style="color:#999;font-size:12px">Eva · AI-Team · <a href="{{unsubscribeUrl}}">Cancelar suscripción</a></p>`,
      },
      {
        step: 2,
        delayDays: 3,
        subject: "Re: {{businessName}} — una pregunta rápida",
        bodyHtml: (vars) => `
<p>Hola de nuevo ${v(vars, "contactName", "equipo")} 👋</p>
<p>Solo quería saber si viste mi email anterior.</p>
<p>Una pregunta directa: ¿cuántas citas perdéis al mes por no-shows o porque nadie contestó el WhatsApp a tiempo?</p>
<p>La media en clínicas de 1-3 dentistas es <strong>8-12 citas/mes</strong>. A 80€ de media, son 640-960€/mes en humo.</p>
<p>Pablo (nuestro agente de WhatsApp) lo resuelve en 48h de setup. Sin cambiar vuestro software dental.</p>
<p><a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" style="background:#E8B84B;color:#000;padding:10px 20px;font-weight:bold;text-decoration:none;display:inline-block">→ Ver cómo funciona (15 min)</a></p>
<p style="color:#999;font-size:12px">Eva · AI-Team · <a href="{{unsubscribeUrl}}">Cancelar suscripción</a></p>`,
      },
      {
        step: 3,
        delayDays: 7,
        subject: "Caso real: Clínica en Málaga +22 citas/mes",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Hace 4 meses una clínica en Málaga (similar a ${v(vars, "businessName")}) empezó con AI-Team.</p>
<p>Resultados a los 90 días:</p>
<ul>
<li>✅ No-shows reducidos del 30% al 8%</li>
<li>✅ +47 reseñas Google (de 4.1★ a 4.8★)</li>
<li>✅ +22 citas recuperadas al mes</li>
<li>✅ WhatsApp contestado en &lt;2 min a cualquier hora</li>
</ul>
<p>Setup en 48h. Sin tocar Gesden ni Clinic Cloud. <strong>Precio fundador: 79€/mes para siempre.</strong></p>
<p><a href="https://aiteam.marketing/casos" style="background:#E8B84B;color:#000;padding:10px 20px;font-weight:bold;text-decoration:none;display:inline-block">→ Ver caso completo</a></p>
<p style="color:#999;font-size:12px">Eva · AI-Team · <a href="{{unsubscribeUrl}}">Cancelar suscripción</a></p>`,
      },
      {
        step: 4,
        delayDays: 14,
        subject: "Último intento — regalo para {{businessName}}",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Es mi último email. No quiero ser pesado.</p>
<p>Solo quería ofreceros algo: <strong>30 días gratis de AI-Team</strong> a cambio de feedback honesto. Sin tarjeta, sin permanencia.</p>
<p>Si al mes no veis valor, lo dejáis y no hay más emails. Promesa.</p>
<p>Si les interesa, respondedme con "quiero probarlo" y os monto el acceso esta semana.</p>
<p style="color:#999;font-size:12px">Eva · AI-Team · <a href="{{unsubscribeUrl}}">Cancelar suscripción</a></p>`,
      },
      {
        step: 5,
        delayDays: 30,
        subject: "{{businessName}} — check-in de mayo",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Hace un mes os escribí. Imagino que estáis a tope.</p>
<p>Rápido: este mes hemos añadido integración con Cal.com para gestionar las citas directamente por WhatsApp. Funciona muy bien con clínicas dentales.</p>
<p>Si en algún momento queréis ver cómo lo hacemos, aquí estamos.</p>
<p><a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min">Reservar 15 minutos →</a></p>
<p style="color:#999;font-size:12px">Eva · AI-Team · <a href="{{unsubscribeUrl}}">Cancelar suscripción</a></p>`,
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
<p>Soy Eva, de AI-Team.</p>
<p>El sábado a las 9h: el salón lleno, el teléfono sin parar, el WhatsApp con 20 mensajes sin contestar y tú cortando el pelo. ¿Te suena?</p>
<p>Pablo (nuestro agente de WhatsApp) contesta por ti. Confirma citas, da precios, gestiona cancelaciones. 24/7.</p>
<p>Marta lleva el Instagram: 3 posts semanales con fotos de tus trabajos, sin que toques el móvil.</p>
<p>Todo por <strong>39,90€/mes</strong> (precio fundador para siempre).</p>
<p><a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" style="background:#E8B84B;color:#000;padding:10px 20px;font-weight:bold;text-decoration:none;display:inline-block">→ Ver demo (15 min)</a></p>
<p style="color:#999;font-size:12px">Eva · AI-Team · <a href="{{unsubscribeUrl}}">Cancelar suscripción</a></p>`,
      },
      {
        step: 2,
        delayDays: 4,
        subject: "¿Cuántas clientas no vuelven porque nadie las llama?",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Un dato que calculamos con salones similares a ${v(vars, "businessName")}: el 35% de clientas no vuelven después de 8 semanas si nadie les manda un recordatorio.</p>
<p>Eva (nuestra agente de email) manda un mensaje automático a las clientas que no han vuelto en 6 semanas. Recuperamos entre 3-5 clientas al mes sin hacer nada.</p>
<p>¿Cuánto vale una clienta fija para vosotros?</p>
<p><a href="https://aiteam.marketing/peluquerias">Ver cómo funciona para salones →</a></p>
<p style="color:#999;font-size:12px">Eva · AI-Team · <a href="{{unsubscribeUrl}}">Cancelar suscripción</a></p>`,
      },
      {
        step: 3,
        delayDays: 10,
        subject: "Salón en Marbella: +340 seguidores y +28% retención en 3 meses",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Salón Aura (Marbella) lleva 3 meses con AI-Team. Sin community manager, sin recepcionista extra.</p>
<ul>
<li>+340 seguidores reales en Instagram</li>
<li>+28% clientas que repiten vs trimestre anterior</li>
<li>8 horas/semana ahorradas en gestión de mensajes</li>
</ul>
<p>Inversión: 39,90€/mes.</p>
<p><a href="https://aiteam.marketing/casos" style="background:#E8B84B;color:#000;padding:10px 20px;font-weight:bold;text-decoration:none;display:inline-block">→ Ver caso completo</a></p>
<p style="color:#999;font-size:12px">Eva · AI-Team · <a href="{{unsubscribeUrl}}">Cancelar suscripción</a></p>`,
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
<p>Soy Eva, de AI-Team.</p>
<p>Un turista a las 23h busca restaurante para mañana. Os escribe por WhatsApp. Nadie contesta. Reserva en el de al lado.</p>
<p>Pablo contesta en segundos, en español e inglés. Confirma la reserva, manda recordatorio el día anterior, y si cancelan, libera la mesa automáticamente.</p>
<p>Rocío responde cada reseña de TripAdvisor y Google en 24h. Marta publica fotos de los platos cada semana.</p>
<p><strong>Todo por 39,90€/mes.</strong></p>
<p><a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min" style="background:#E8B84B;color:#000;padding:10px 20px;font-weight:bold;text-decoration:none;display:inline-block">→ Demo gratis (15 min)</a></p>
<p style="color:#999;font-size:12px">Eva · AI-Team · <a href="{{unsubscribeUrl}}">Cancelar suscripción</a></p>`,
      },
      {
        step: 2,
        delayDays: 5,
        subject: "+35% reservas online en 2 meses (caso Fuengirola)",
        bodyHtml: (vars) => `
<p>Hola ${v(vars, "contactName", "equipo")},</p>
<p>Taberna El Puerto (Fuengirola) lleva 2 meses con AI-Team:</p>
<ul>
<li>+35% reservas online vs mismo período año anterior</li>
<li>100% reseñas respondidas (TripAdvisor + Google)</li>
<li>Pablo atiende en inglés, alemán y francés</li>
<li>Rating TripAdvisor: 4.7★</li>
</ul>
<p>Sin cambiar vuestra forma de trabajar. Sin contratar a nadie.</p>
<p><a href="https://aiteam.marketing/casos">Ver caso completo →</a></p>
<p style="color:#999;font-size:12px">Eva · AI-Team · <a href="{{unsubscribeUrl}}">Cancelar suscripción</a></p>`,
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
<p>Hace un mes hablamos sobre automatizar el WhatsApp y las reseñas de ${v(vars, "businessName")}.</p>
<p>Hemos lanzado algo nuevo: <strong>onboarding en 24h</strong>. Pablo funcionando el mismo día que te das de alta.</p>
<p>¿Sigue siendo algo que os interesa?</p>
<p><a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min">Reservar 15 min →</a></p>
<p style="color:#999;font-size:12px">Eva · AI-Team · <a href="{{unsubscribeUrl}}">Cancelar suscripción</a></p>`,
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
<p>Hace 2 meses os escribí. Desde entonces hemos añadido:</p>
<ul>
<li>✅ Integración Cal.com (citas directas por WhatsApp)</li>
<li>✅ Respuesta automática en inglés y alemán (para turistas)</li>
<li>✅ Seguimiento de presupuestos dentales automático</li>
</ul>
<p>Si ahora es mejor momento, encantado de enseñaros en 15 minutos.</p>
<p><a href="https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min">Ver demo →</a></p>
<p style="color:#999;font-size:12px">Eva · AI-Team · <a href="{{unsubscribeUrl}}">Cancelar suscripción</a></p>`,
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
