import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { anthropic } from "@/lib/claude";
import { getUser } from "@/lib/store";

const schema = z.object({
  scenario: z.enum(["saludo", "agendar", "cancelar", "informacion", "queja", "ausencia", "personalizado"]),
  customNote: z.string().max(500).optional(),
  language: z.enum(["es", "en"]).default("es"),
});

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const user = await getUser(email);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const { scenario, customNote, language } = parsed.data;

    const businessCtx = user.business
      ? `Negocio: ${user.business.nombre} — ${user.business.sector}. Ofrecemos: ${user.business.ofrece}. Tono: ${user.business.tono}.`
      : "Negocio sin briefing configurado.";

    const scenarios: Record<string, string> = {
      saludo: "Saludo inicial al descolgar el teléfono. Identificarse, dar la bienvenida, preguntar en qué puede ayudar. 2-3 frases.",
      agendar: "Guion para agendar una cita: pedir nombre, motivo, preferencia de día/hora, datos de contacto. Confirmación final.",
      cancelar: "Guion para gestionar una cancelación con empatía: preguntar motivo (sin presionar), ofrecer reagendar, confirmar.",
      informacion: "Guion para responder a alguien que pide información (precios, servicios, horarios). Dar info clara + invitar a reservar.",
      queja: "Guion para gestionar una queja telefónica: escucha activa, disculpa, propuesta de solución, escalado si necesario.",
      ausencia: "Mensaje de buzón de voz para cuando nadie puede atender (festivos, cerrado, fuera de horario). Profesional + alternativa para contactar.",
      personalizado: "Genera el guion según la nota del usuario.",
    };

    const langInstr = language === "en"
      ? "Responde el guion EN INGLÉS."
      : "Responde el guion EN ESPAÑOL.";

    const ai = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: `Eres Carmen, recepcionista profesional. Generas guiones de llamada para PYMEs. ${businessCtx}

${langInstr}

Reglas:
- Devuelve un guion ESTRUCTURADO con secciones: "Carmen dice:", "Carmen pregunta:", "Carmen confirma:".
- Tono cercano, claro, sin sonar robot.
- Anticipa objeciones comunes y cómo manejarlas.
- Máximo 250 palabras.
- Si es bilingüe, hazlo natural.
- Devuelve SOLO el guion, sin preámbulos.`,
      messages: [
        {
          role: "user",
          content: `Escenario: ${scenarios[scenario]}${customNote ? `\n\nNota adicional: ${customNote}` : ""}`,
        },
      ],
    });

    const text = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    return NextResponse.json({ script: text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
