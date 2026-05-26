import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { anthropic } from "@/lib/claude";
import { getUser } from "@/lib/store";

const schema = z.object({
  platform: z.enum(["instagram", "linkedin", "tiktok", "facebook"]),
  format: z.enum(["post", "carrusel", "reel", "story"]),
  topic: z.string().min(3).max(500),
  tone: z.enum(["cercano", "profesional", "divertido", "inspirador"]).default("cercano"),
});

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const user = await getUser(email);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const { platform, format, topic, tone } = parsed.data;

    const businessCtx = user.business
      ? `Negocio: ${user.business.nombre} — ${user.business.sector}. Ofrecemos: ${user.business.ofrece}. Público objetivo: ${user.business.publico}. Tono de marca: ${user.business.tono}.`
      : "Negocio sin briefing configurado.";

    const platformRules: Record<string, string> = {
      instagram: "Máx 2200 caracteres. Engaging. Emojis sí, con criterio. 5-10 hashtags al final.",
      linkedin: "Tono profesional sin perder calidez. Sin emojis o muy pocos. 3-5 hashtags. Estructura párrafos cortos con saltos.",
      tiktok: "Caption corto (máx 150 caracteres). Hook directo. 3-5 hashtags virales.",
      facebook: "Tono cercano. Texto largo OK si aporta valor. 2-4 hashtags al final.",
    };
    const formatRules: Record<string, string> = {
      post: "Un post único. Hook + cuerpo + CTA + hashtags.",
      carrusel: "Devuelve 5-7 diapositivas numeradas (DIAPOSITIVA 1, DIAPOSITIVA 2…) con título grande + 1-2 frases por slide. Última slide = CTA fuerte. Después caption del post + hashtags.",
      reel: "Devuelve guion de 30-45 segundos: HOOK (0-3s) + DESARROLLO (4-25s) + CTA (26-30s). Bullet points para grabar. Después caption con hashtags.",
      story: "3-5 stories secuenciales. Cada una con texto corto y sugerencia visual entre paréntesis. Última con sticker de pregunta o CTA.",
    };
    const toneRules: Record<string, string> = {
      cercano: "Cercano, humano, como hablándole a un amigo.",
      profesional: "Profesional sin ser frío. Autoridad amable.",
      divertido: "Divertido, ágil, con gracia. Sin ser ridículo.",
      inspirador: "Inspirador, motivacional, sin caer en clichés.",
    };

    const ai = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: `Eres Marta, community manager. Creas contenido para redes sociales de PYMEs. ${businessCtx}

Plataforma: ${platform.toUpperCase()}.
Formato: ${format.toUpperCase()}.
Tono: ${toneRules[tone]}

Reglas plataforma: ${platformRules[platform]}
Reglas formato: ${formatRules[format]}

Reglas generales:
- NUNCA inventes datos del negocio (precios, premios, certificaciones, fechas) que no estén en el briefing.
- Habla siempre en primera persona del negocio (nosotros/yo).
- Conecta con el público objetivo, no genérico.
- Hashtags relevantes y mezcla nicho + populares.
- Devuelve SOLO el contenido listo para publicar, sin meta-explicaciones tipo "aquí tienes" ni "este post...".`,
      messages: [{ role: "user", content: `Crea ${format} sobre: ${topic}` }],
    });

    const text = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    return NextResponse.json({ content: text, platform, format });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
