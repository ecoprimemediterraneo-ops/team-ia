import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { anthropic } from "@/lib/claude";

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const user = await getUser(email);
    const { weeks = 4 } = await req.json().catch(() => ({}));

    const business = user.business;
    const context = business
      ? `Negocio: ${business.nombre}. Sector: ${business.sector}. Servicios: ${business.ofrece}. Público: ${business.publico}. Tono: ${business.tono}.`
      : "Negocio local general. Tono cercano y profesional.";

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Genera un calendario editorial de ${weeks} semanas para redes sociales.

${context}

Devuelve SOLO un array JSON con este formato exacto, sin explicación:
[
  { "day": 0, "hour": 10, "platform": "instagram", "topic": "Tema del post", "status": "idea" },
  ...
]

Reglas:
- day: 0=lunes, 1=martes, ..., 6=domingo
- platform: "instagram" | "linkedin" | "tiktok" | "facebook"
- hour: número entre 8 y 20
- Distribuye los posts a lo largo de la semana (lunes-viernes principalmente, alguno en fin de semana)
- 4-5 posts por semana. El array total tendrá ${weeks * 4} posts aproximadamente.
- Los temas deben ser concretos y específicos para el negocio, no genéricos.
- Varía plataformas: más Instagram, algo de Facebook, LinkedIn si es B2B.
- Incluye: tips del sector, testimonios, detrás de las cámaras, promos, educativos, interacción.
- Los temas en español.`,
        },
      ],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Respuesta IA inválida");

    const slots = JSON.parse(jsonMatch[0]) as {
      day: number;
      hour: number;
      platform: string;
      topic: string;
      status: string;
    }[];

    const result = slots.map((s, i) => ({
      ...s,
      id: `ai_${Date.now()}_${i}`,
    }));

    return NextResponse.json({ slots: result });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
