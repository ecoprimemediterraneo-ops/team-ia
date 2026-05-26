import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { anthropic } from "@/lib/claude";
import { getUser } from "@/lib/store";

const schema = z.object({
  message: z.string().min(1).max(2000),
  intent: z.enum(["responder", "agendar", "captar_lead", "seguimiento", "info"]).default("responder"),
  customerName: z.string().max(60).optional(),
});

export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const user = await getUser(email);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const { message, intent, customerName } = parsed.data;

    const businessCtx = user.business
      ? `Negocio: ${user.business.nombre} — ${user.business.sector}. Ofrecemos: ${user.business.ofrece}. Tono de marca: ${user.business.tono}. Público: ${user.business.publico}.`
      : "Negocio sin briefing configurado.";

    const intentInstr: Record<string, string> = {
      responder: "Responde la duda del cliente. Conciso. Si falta info, pídela.",
      agendar: "Propón fechas/horarios concretos. Pide confirmación. Solicita datos mínimos (nombre + servicio).",
      captar_lead: "Engancha al posible cliente, ofrécele algo de valor (consulta gratis, info, demo) y pídele datos.",
      seguimiento: "Mensaje de seguimiento educado, no agobiante. Recordatorio amable + pregunta abierta.",
      info: "Da información clara y completa sobre lo que pregunta. Termina con CTA suave.",
    };

    const ai = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `Eres Pablo, asistente de WhatsApp del negocio. Respondes mensajes de WhatsApp en nombre del negocio. ${businessCtx}

Reglas estrictas WhatsApp:
- MÁXIMO 4-5 frases. WhatsApp es corto.
- Tono cercano y humano, NO formal de email.
- Emojis con moderación (1-2 máx, solo si encajan).
- NO uses "Estimado/a". Empieza por nombre o "¡Hola!".
- Si necesitas datos del cliente, pídeselos al final con un solo bullet o frase.
- ${intentInstr[intent]}

Devuelve SOLO el texto del mensaje WhatsApp. Sin meta-comentarios. Listo para enviar.`,
      messages: [
        {
          role: "user",
          content: customerName
            ? `Mensaje recibido de ${customerName}:\n"${message}"`
            : `Mensaje recibido:\n"${message}"`,
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
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
