import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { briefingDelPanel, contextoEnUnaLinea } from "@/lib/briefing-panel";
import { anthropic } from "@/lib/claude";
import { resolverPersona } from "@/lib/persona";

const schema = z.object({
  scenario: z.enum(["saludo", "agendar", "cancelar", "informacion", "queja", "ausencia", "personalizado"]),
  customNote: z.string().max(500).optional(),
  language: z.enum(["es", "en"]).default("es"),
});

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const { scenario, customNote, language } = parsed.data;

    // DE QUÉ NEGOCIO HABLA ESTE GUION
    // -------------------------------
    // Antes el contexto era una sola línea con el briefing guardado en el panel
    // y NADA más: ni las reglas de casa, ni las prohibiciones del sector. Con un
    // briefing viejo pegado al prompt y sin un solo freno, Carmen se inventaba
    // precios —llegó a citar maquinaria de estética de 18.000 a 22.000 €— en un
    // guion que no iba de eso.
    //
    // Ahora manda la persona del sector (identidad, vocabulario, tono y lo que
    // NO se puede decir), igual que en el chat del panel. El briefing se sigue
    // usando, pero como dato de apoyo, no como toda la verdad.
    // El negocio sale de `briefing-panel.ts`: manda la FICHA del tenant y el
    // briefing del panel solo tapa huecos. Antes se leía el briefing a secas, y
    // en la cuenta de AI-Team ese briefing era una demo de clínica dental.
    const { business: negocio, tenantId } = await briefingDelPanel(email);
    const businessCtx = contextoEnUnaLinea(negocio);

    const persona = await resolverPersona({
      tenantId,
      agente: "carmen",
      canal: "voz",
      extra: businessCtx,
    });

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
      system: `${persona.sector ? persona.system : `Eres Carmen, recepcionista profesional. Generas guiones de llamada para PYMEs. ${businessCtx}`}

${langInstr}

Reglas del GUION (esto es un guion escrito, no una llamada en curso):
- NO te inventes precios, marcas, aparatos ni plazos. Si el guion necesita una
  cifra que no está en los datos del negocio, deja un hueco entre corchetes
  ([precio], [duración]) para que lo rellene el dueño.
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
