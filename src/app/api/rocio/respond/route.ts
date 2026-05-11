import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { anthropic } from "@/lib/claude";
import { getUser } from "@/lib/store";

const schema = z.object({
  review: z.string().min(5).max(2000),
  rating: z.number().int().min(1).max(5),
  tone: z.enum(["cordial", "disculpa", "profesional", "cercano"]).default("cordial"),
  customerName: z.string().max(60).optional(),
});

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const user = await getUser(email);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const { review, rating, tone, customerName } = parsed.data;

    const businessCtx = user.business
      ? `Negocio: ${user.business.nombre} — ${user.business.sector}. Lo que ofrecemos: ${user.business.ofrece}. Tono general de marca: ${user.business.tono}.`
      : "Negocio sin briefing configurado.";

    const toneInstr: Record<string, string> = {
      cordial: "Tono cordial y agradecido, calidez profesional.",
      disculpa: "Tono de disculpa sincera, sin justificar, y proponiendo arreglarlo (invitar a contactar privadamente).",
      profesional: "Tono formal y profesional, sin emoticonos.",
      cercano: "Tono muy cercano y humano, como hablándole a un vecino.",
    };

    const ai = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: `Eres Rocío, especialista en gestionar reseñas de Google. Redactas respuestas públicas a reseñas en nombre del negocio. ${businessCtx}

Reglas estrictas:
- Máximo 4 frases. Conciso. Las respuestas largas son peor que cortas.
- Empieza por el nombre si lo tienes, si no por "¡Hola!" o "Hola".
- Si la reseña es positiva (4-5★): agradece de forma sincera, menciona algo concreto que dijo el cliente.
- Si la reseña es neutra (3★): agradece + pregunta cómo mejorar.
- Si la reseña es negativa (1-2★): lamenta, NO te justifiques, ofrece contactar en privado para arreglarlo.
- Nunca menciones competidores ni precios.
- Cierra con el nombre del negocio o "El equipo de [negocio]".
- ${toneInstr[tone]}

Devuelve SOLO el texto de la respuesta. Sin comillas, sin explicaciones, sin asunto. Listo para pegar en Google.`,
      messages: [
        {
          role: "user",
          content: `Reseña de ${customerName || "un cliente"} (${rating}★):\n\n"${review}"\n\nRedacta la respuesta pública.`,
        },
      ],
    });

    const text = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    return NextResponse.json({ reply: text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
