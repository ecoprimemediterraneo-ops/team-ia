/**
 * Hiperpersonalización de emails con variables del lead.
 *
 * Variables soportadas:
 *  {{businessName}}  - nombre de la clínica/negocio
 *  {{contactName}}   - nombre del contacto principal
 *  {{firstName}}     - primer nombre del contacto
 *  {{city}}          - ciudad del lead
 *  {{sector}}        - sector (clínica dental, etc.)
 *  {{rating}}        - rating Google (ej: 4.6★)
 *  {{reviewCount}}   - nº de reseñas
 *  {{competitor}}    - nombre de competidor (vacío si no hay)
 *  {{remitente}}     - tu negocio (AI-Team o lo que pongas)
 *  {{currentDate}}   - fecha de hoy
 */

import type { Lead } from "./pipeline";

export function fillLeadVars(template: string, lead: Lead, extra?: Record<string, string>): string {
  const vars: Record<string, string> = {
    businessName: lead.businessName,
    contactName: lead.contactName || "",
    firstName: lead.contactName?.split(" ")[0] || "",
    city: lead.city || "",
    sector: lead.sector,
    rating: lead.rating ? `${lead.rating}★` : "",
    reviewCount: lead.reviewCount ? String(lead.reviewCount) : "",
    competitor: "",
    remitente: "AI-Team",
    currentDate: new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long" }),
    ...extra,
  };

  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }

  // Limpiar saludos huérfanos cuando no hay nombre
  out = out.replace(/Hola\s+,/g, "Hola,");
  out = out.replace(/Hola\s+\./g, "Hola.");
  out = out.replace(/, {2,}/g, ", ");
  out = out.replace(/  +/g, " ");

  return out;
}

/**
 * Plantillas pre-hechas de outreach para captación.
 * Cada una pensada para un escenario específico. Sin nombres de persona ni
 * métricas inventadas: el protagonista es "el sistema".
 */
export const OUTREACH_TEMPLATES: Record<string, { name: string; sequence: { delayHours: number; subject: string; body: string }[] }> = {
  dental_basic: {
    name: "🦷 Outreach básico clínicas dentales",
    sequence: [
      {
        delayHours: 0,
        subject: "{{firstName}}, una idea rápida para {{businessName}}",
        body: `Hola {{firstName}},

He visto que tu clínica {{businessName}} en {{city}} tiene {{rating}} en Google con {{reviewCount}} reseñas — buen punto de partida.

Te escribo porque tenemos un sistema operativo específico para clínicas dentales de tu tamaño: reduce los no-shows, contesta WhatsApp 24/7, coge las llamadas y sube tu Google con campañas de reseñas. Un único sistema, no herramientas sueltas.

Estamos abriendo 20 plazas fundadoras: 6 meses gratis, sin tarjeta, a cambio de feedback.

¿Te enseñamos en 15 min cómo funciona?

Un saludo,
El equipo de AI-Team
https://aiteam.marketing/dentistas`,
      },
      {
        delayHours: 72,
        subject: "Re: idea rápida para {{businessName}}",
        body: `Hola {{firstName}},

¿Has podido ver el email anterior? No te robamos más tiempo, solo confirmamos si te interesa una de las 20 plazas fundadoras antes de cerrarlas.

Si es no, perfecto, no insistimos.
Si es sí, te pasamos enlace para reservar 15 min.

Un saludo,
El equipo de AI-Team`,
      },
      {
        delayHours: 168,
        subject: "Última: cerramos las plazas fundadoras el viernes",
        body: `Hola {{firstName}},

Solo aviso de cierre. El viernes confirmamos las 20 clínicas fundadoras que se llevan 6 meses gratis sin tarjeta, con precio fundador 149€/mes para siempre.

Si te interesa, contesta SÍ y te llamamos.
Si no, te dejamos en paz — palabra.

Un saludo,
El equipo de AI-Team`,
      },
    ],
  },
  pelu_basic: {
    name: "💇 Outreach peluquerías",
    sequence: [
      {
        delayHours: 0,
        subject: "{{firstName}}, ¿WhatsApp del sábado descontrolado?",
        body: `Hola {{firstName}},

He visto {{businessName}} en {{city}}. Te escribo porque trabajamos con peluquerías de tu tamaño que tienen el mismo problema: WhatsApp explotado en sábado y huecos vacíos a media mañana.

Tenemos un sistema operativo que contesta los WhatsApp en segundos, publica en Instagram cada semana y recupera clientas que llevan tiempo sin venir. Todo en uno.

Abrimos 20 plazas fundadoras: 6 meses gratis, sin tarjeta. ¿Te lo enseñamos en 15 min?

Un saludo,
El equipo de AI-Team
https://aiteam.marketing/peluquerias`,
      },
      {
        delayHours: 72,
        subject: "Re: WhatsApp del sábado",
        body: `{{firstName}}, ¿pudimos pillarte? Te dejamos la info sin que tengas que pensar:

• Contesta los WhatsApp 24/7 con tu tono
• Publica en Instagram automáticamente
• Gestiona Google y las reseñas
• 149€/mes precio fundador (después 299€)

¿Llamada de 15 min esta semana?

El equipo de AI-Team`,
      },
    ],
  },
  resto_basic: {
    name: "🍽️ Outreach restaurantes",
    sequence: [
      {
        delayHours: 0,
        subject: "{{firstName}}, ¿reservas de turistas perdidas en {{businessName}}?",
        body: `Hola {{firstName}},

He visto que tu restaurante {{businessName}} en {{city}} tiene {{rating}} en Google. Imagino que en temporada alta el WhatsApp arde y los turistas que llaman en inglés se pierden.

Tenemos un sistema operativo que gestiona las reservas por WhatsApp 24/7, coge llamadas en español e inglés, responde TripAdvisor y publica fotos de tus platos en Instagram. Un único sistema.

Abrimos 20 plazas fundadoras: 6 meses gratis, sin tarjeta. ¿Te enseñamos en 15 min?

Un saludo,
El equipo de AI-Team
https://aiteam.marketing/restaurantes`,
      },
    ],
  },
};
