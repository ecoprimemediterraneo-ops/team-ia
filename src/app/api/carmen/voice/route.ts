import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { openai } from "@/lib/openai";

const schema = z.object({
  text: z.string().min(3).max(3000),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).default("nova"),
});

export async function POST(req: Request) {
  try {
    await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    // Limpiar marcadores tipo "Carmen dice:" para que solo lea las partes habladas
    const cleanText = parsed.data.text
      .replace(/^Carmen (dice|pregunta|confirma|escucha):\s*/gim, "")
      .replace(/^\s*[-•*]\s*/gm, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/^#{1,6}\s+/gm, "")
      .trim();

    const audio = await openai.audio.speech.create({
      model: "tts-1",
      voice: parsed.data.voice,
      input: cleanText.slice(0, 2500),
      response_format: "mp3",
    });

    const buffer = Buffer.from(await audio.arrayBuffer());
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
