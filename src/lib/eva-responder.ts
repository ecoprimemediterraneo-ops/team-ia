/**
 * Eva · Generador de campañas de email con perfil cliente.
 */

import { anthropic, MODELS } from "@/lib/claude";
import type { EvaProfile } from "./eva-profile";
import type { EvaCampaignType } from "./eva-campaigns";

const TYPE_RULES: Record<EvaCampaignType, string> = {
  newsletter: "Newsletter periódica con un valor + una noticia + un CTA. Tono educativo + cálido.",
  welcome: "Email de bienvenida al suscribirse. Agradece, explica qué van a recibir, ofrece un primer regalo o consejo.",
  promo: "Oferta o promoción puntual. Asunto SIN CAPS, sin 'GRATIS' (anti-spam). Cuerpo corto con CTA claro.",
  reactivacion: "Reactivar suscriptores que no abren hace tiempo. Tono empático: '¿sigues por aquí?'. Oferta para recuperarlos.",
  cumpleanos: "Felicitación cumpleaños con regalo/descuento exclusivo. Cálido, breve, personal.",
  otro: "Email genérico bien estructurado: asunto curioso, cuerpo conciso, CTA único.",
};

const SYSTEM_BUILDER = (p: EvaProfile, tipo: EvaCampaignType) => `Eres Eva, especialista en email marketing de "${p.nombre_marca || 'la marca'}".

CONTEXTO:
- Marca: ${p.nombre_marca || "(sin definir)"}
- Sector: ${p.sector || "negocio local"}
- Remitente que aparece: ${p.remitente_nombre || "el equipo"} <${p.remitente_email || "no-reply@..."}>
- Audiencia objetivo: ${p.audiencia_target || "clientes y suscriptores"}
- CTA principal habitual: ${p.cta_principal || "Reservar / Comprar / Saber más"}
- Tono de marca: ${p.tono_marca || "cercano y profesional"}
- Firma: ${p.firma || "El equipo"}

REGLAS DURAS — INNEGOCIABLES:
1. Idioma SIEMPRE español de España (tú/vosotros).
2. Tono: ${p.tono_marca}. Como una persona, NUNCA "estimado cliente" ni "como modelo de lenguaje".
3. Asunto: 35-50 caracteres. Sin CAPS innecesarios. Sin emojis spam (máx 1 emoji y solo si encaja).
4. Primera frase del cuerpo = continuación natural del asunto (no repetirlo).
5. Una sola CTA clara por email. Sin "saluda aquí, también compra esto, y suscríbete acá".
6. Mobile-first: párrafos cortos (1-3 frases). Máximo 200 palabras en el cuerpo principal.
7. NUNCA prometas precios, descuentos o plazos sin que el usuario los haya validado.
8. Termina con la firma: "${p.firma || "El equipo de " + (p.nombre_marca || "")}"

TIPO DE EMAIL: ${tipo.toUpperCase()}
${TYPE_RULES[tipo]}
${p.reglas_custom ? `\nREGLAS ESPECÍFICAS:\n${p.reglas_custom}\n` : ""}

FORMATO DE SALIDA (JSON estricto, sin texto antes ni después):
{"asunto":"<asunto 35-50 chars>","cuerpo":"<cuerpo del email con saltos de línea reales>"}`;

export async function generateEvaCampaign(
  tipo: EvaCampaignType,
  briefing: string,
  profile: EvaProfile,
): Promise<{ asunto: string; cuerpo: string }> {
  try {
    const completion = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 800,
      temperature: 0.5,
      system: SYSTEM_BUILDER(profile, tipo),
      messages: [{ role: "user", content: `Briefing para el email:\n${briefing}\n\nGenera el JSON.` }],
    });
    const block = completion.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return fallback(profile, briefing);
    const parsed = JSON.parse(m[0]);
    if (typeof parsed.asunto === "string" && typeof parsed.cuerpo === "string") {
      return { asunto: parsed.asunto.slice(0, 80), cuerpo: parsed.cuerpo };
    }
    return fallback(profile, briefing);
  } catch (e) {
    console.error("[eva-responder]", e);
    return fallback(profile, briefing);
  }
}

function fallback(p: EvaProfile, briefing: string): { asunto: string; cuerpo: string } {
  return {
    asunto: briefing.slice(0, 50),
    cuerpo: `Hola,\n\n${briefing}\n\n${p.firma || `Saludos,\nEl equipo de ${p.nombre_marca}`}`,
  };
}
