import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { briefingDelPanel, contextoEnUnaLinea } from "@/lib/briefing-panel";
import { capaDeSector } from "@/lib/persona";
import { fetchMessageBody, getRedirectUri } from "@/lib/gmail";
import { anthropic } from "@/lib/claude";

const schema = z.object({
  messageId: z.string().min(1),
  instruction: z.string().optional(),
});

// PREVIEW: genera el borrador con IA pero NO lo guarda en Gmail
export async function POST(req: Request) {
  try {
    const { email } = await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const redirect = getRedirectUri(host, proto);

    const original = await fetchMessageBody(email, redirect, parsed.data.messageId);
    if (!original) return NextResponse.json({ error: "Correo no encontrado o Gmail no conectado" }, { status: 404 });

    const fromMatch = original.from.match(/<([^>]+)>/);
    const senderEmail = fromMatch ? fromMatch[1] : original.from;
    const senderName = original.from.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || senderEmail;

    // El negocio sale de `briefing-panel.ts`: manda la FICHA del tenant y el
    // briefing del panel solo tapa huecos. Antes se leía el briefing a secas, y
    // en la cuenta de AI-Team ese briefing era una demo de clínica dental.
    const { business: negocio, tenantId } = await briefingDelPanel(email);
    const businessCtx = contextoEnUnaLinea(negocio);

    // Capa de sector: identidad, vocabulario, tono y —sobre todo— lo que este
    // negocio NO puede decir. El prompt de oficio sabe redactar un correo, pero
    // no sabía dónde trabaja.
    const { bloque: bloqueSector } = await capaDeSector(tenantId).catch(() => ({ bloque: "" }));

    const aiResp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: `Eres Lucía, asistente ejecutiva. Redactas respuestas de email en nombre del jefe. ${businessCtx} Devuelve SOLO el cuerpo del correo (saludo + cuerpo + despedida). Tono cercano y profesional. Conciso.${bloqueSector ? `\n\n${bloqueSector}` : ""}`,
      messages: [
        {
          role: "user",
          content: `Correo recibido de ${senderName} <${senderEmail}>:\n\nAsunto: ${original.subject}\n\n${original.body}\n\n${parsed.data.instruction ? `Instrucción del jefe: ${parsed.data.instruction}` : "Redacta una respuesta apropiada."}`,
        },
      ],
    });

    const replyBody = aiResp.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    const subject = original.subject.toLowerCase().startsWith("re:") ? original.subject : `Re: ${original.subject}`;

    return NextResponse.json({
      preview: replyBody,
      to: senderEmail,
      subject,
      messageId: parsed.data.messageId,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
