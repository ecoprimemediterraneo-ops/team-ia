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
 * Plantillas pre-hechas de outreach para SDR.
 * Cada una pensada para un escenario específico.
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

Te escribo porque he montado un equipo de 6 asistentes IA específico para clínicas dentales de tu tamaño. Reducen no-shows un 50%, contestan WhatsApps 24/7 y suben tu Google con campañas automáticas de reseñas.

Estoy regalando 30 días a 5 clínicas dentales de {{city}} a cambio de feedback.

¿Te enseño en 15 min cómo funciona?

Un saludo,
Cristóbal — AI-Team
https://aiteam.marketing/dentistas`,
      },
      {
        delayHours: 72,
        subject: "Re: idea rápida para {{businessName}}",
        body: `Hola {{firstName}},

¿Has podido ver el email del lunes? No te robo más tiempo, solo confirmo si te interesa una de las 5 plazas piloto antes de que las cierre.

Si es no, perfecto, no insisto más.
Si es sí, te paso enlace para reservar 15 min.

Un saludo,
Cristóbal`,
      },
      {
        delayHours: 168,
        subject: "Última: cerramos las plazas piloto el viernes",
        body: `Hola {{firstName}},

Solo aviso de cierre. El viernes confirmo las 5 clínicas piloto que se llevan 30 días gratis con precio fundador 89€/mes después.

Si te interesa, contesta SÍ y te llamo personalmente.
Si no, te dejo en paz — palabra.

Un saludo,
Cristóbal`,
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

He visto {{businessName}} en {{city}}. Te escribo porque trabajo con peluquerías de tu tamaño que tienen el mismo problema: WhatsApp explotado en sábado y huecos vacíos a media mañana.

Tengo un equipo de 6 asistentes IA que te contesta los WhatsApps en 12 segundos, te sube Instagram con reels semanales y recupera clientas que llevan 3 meses sin venir.

Regalo 30 días a 5 salones de {{city}}. ¿Te lo enseño en 15 min?

Un saludo,
Cristóbal — AI-Team
https://aiteam.marketing/peluquerias`,
      },
      {
        delayHours: 72,
        subject: "Re: WhatsApp del sábado",
        body: `{{firstName}}, ¿pude pillarte? Te dejo la info sin que tengas que pensar:

• Pablo contesta WhatsApps 24/7 con tu tono
• Marta sube 3 reels/semana automáticos
• Rocío gestiona Google y reseñas
• 59€/mes precio fundador (después 99€)

¿Llamada de 15 min esta semana?

Cristóbal`,
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

He visto que tu restaurante {{businessName}} en {{city}} tiene {{rating}} en Google. Imagino que en temporada alta el WhatsApp arde y los turistas que llaman en inglés/alemán se pierden.

He montado un equipo de 6 IAs que gestiona reservas WhatsApp 24/7, coge llamadas en español + inglés, responde TripAdvisor y publica fotos de tus platos en Instagram.

Regalo 30 días a 5 restaurantes. ¿Te enseño en 15 min?

Un saludo,
Cristóbal — AI-Team
https://aiteam.marketing/restaurantes`,
      },
    ],
  },
};
