import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { openai } from "@/lib/openai";
import { anthropic } from "@/lib/claude";
import { getUser } from "@/lib/store";

const schema = z.object({
  topic: z.string().min(3).max(500),
  platform: z.enum(["instagram", "linkedin", "tiktok", "facebook"]).default("instagram"),
  style: z.enum(["foto", "ilustracion", "minimal", "retro"]).default("foto"),
});

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const user = await getUser(email);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const { topic, platform, style } = parsed.data;

    const businessCtx = user.business
      ? `Negocio: ${user.business.nombre} — ${user.business.sector}.`
      : "";

    // 1. Claude convierte el tema en un prompt visual concreto
    const promptResp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `Eres director de arte. Te dan un tema de post de redes sociales y devuelves un prompt EN INGLÉS para un generador de imágenes (DALL-E). El prompt debe ser visual, concreto, sin texto sobreimpresionado, fotorrealista o ilustrado según se pida. Devuelve SOLO el prompt en inglés, sin explicaciones, sin comillas. ${businessCtx}`,
      messages: [
        {
          role: "user",
          content: `Tema del post: "${topic}". Plataforma: ${platform}. Estilo deseado: ${style === "foto" ? "fotografía profesional, realista, luz natural" : style === "ilustracion" ? "ilustración moderna, colores vivos, estilo flat" : style === "minimal" ? "minimalista, limpio, mucho espacio en blanco" : "estética retro 80s/90s, colores cálidos, grano de película"}.`,
        },
      ],
    });
    const dallePrompt = promptResp.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    // 2. DALL-E genera la imagen
    const sizeMap: Record<string, "1024x1024" | "1024x1792" | "1792x1024"> = {
      instagram: "1024x1024",
      tiktok: "1024x1792",
      linkedin: "1792x1024",
      facebook: "1792x1024",
    };

    const img = await openai.images.generate({
      model: "dall-e-3",
      prompt: dallePrompt,
      n: 1,
      size: sizeMap[platform],
      quality: "standard",
    });
    const url = img.data?.[0]?.url;
    if (!url) return NextResponse.json({ error: "No se pudo generar imagen" }, { status: 500 });

    return NextResponse.json({ url, prompt: dallePrompt });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
