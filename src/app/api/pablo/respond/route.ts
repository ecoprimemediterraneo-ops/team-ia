import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { anthropic, MODELS } from "@/lib/claude";
import { PABLO_SYSTEM } from "@/lib/pablo-prompt";

const schema = z.object({
  message: z.string().min(1).max(2000),
  customerName: z.string().max(60).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .max(20)
    .optional(),
});

export async function POST(req: Request) {
  try {
    await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { message, customerName, history } = parsed.data;

    // Construir conversación con historial (si lo manda el dashboard)
    const messages = [
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user" as const,
        content: customerName
          ? `Mensaje de ${customerName}:\n"${message}"`
          : `Mensaje recibido:\n"${message}"`,
      },
    ];

    const ai = await anthropic.messages.create({
      model: MODELS.fast, // Claude Haiku 4.5
      max_tokens: 400,
      system: PABLO_SYSTEM,
      messages,
    });

    const text = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    return NextResponse.json({ reply: text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 },
    );
  }
}
