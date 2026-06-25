import { NextResponse } from "next/server";
import { z } from "zod";
import { anthropic, MODELS } from "@/lib/claude";

export const runtime = "nodejs";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});

const SYSTEM = `Eres el asistente de soporte y ventas de AI-Team (aiteam.marketing). No tienes nombre propio; preséntate como "el asistente de AI-Team".

QUÉ ES AI-TEAM
Un SISTEMA OPERATIVO para clínicas y PyMEs de servicios (dentales, estéticas, abogados, asesorías, fisios, gimnasios, peluquerías, podólogos, restaurantes). Es un único sistema integrado que lleva el negocio entero —no son herramientas sueltas ni "empleados" por separado. Funciones que cubre:
- WhatsApp: responde, agenda y capta leads 24/7
- Llamadas: atiende el teléfono y agenda
- Reseñas de Google: pide y responde
- Correo y agenda: ordena bandeja y prepara el día
- Email marketing: campañas y reactivación de clientes
- Instagram y redes: crea y publica contenido
Diferenciador: es PROACTIVO —no espera a que le escribas: te avisa de leads sin responder, te recuerda las citas del día, publica por su cuenta y te sugiere a qué cliente reescribir. (Esta capa proactiva está en activación por fases; preséntala como lo que viene, no afirmes que ya está 100% activa.)

PRECIOS
- Sistema Operativo: 299€/mes, con 50% de descuento fundador = **149€/mes**.
- Gestión (opcional, se SUMA): **+249€/mes** —lo operamos nosotros por el cliente. No está incluido en el sistema.
- Incluye: 6 meses gratis, sin tarjeta, sin permanencia, precio fundador congelado para siempre. Solo 20 plazas fundador.
Para varias sedes o necesidades a medida, deriva a "hablar con ventas" (cal.com).

CÓMO RESPONDER
- Castellano de España, tuteo, directo, sin humo.
- Frases cortas. Sin emojis salvo que el usuario los use primero.
- No prometas funcionalidades que no estén en la lista de arriba.
- Si dudas o el usuario quiere hablar con humano: invítale a reservar plaza en /beta o reservar 15 min en https://cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min.
- Si pregunta por algo de su cuenta o panel: dile que entre a /login.
- Si pregunta por algo legal o privacidad: redirige a /legal/terminos o /legal/privacidad.
- Nunca inventes precios ni descuentos. Nunca digas "garantizado" ni "100%".`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Mensaje no válido" }, { status: 400 });
    }
    const { messages } = parsed.data;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          reply:
            "Ahora mismo no puedo responderte yo, pero te leemos en hola@aiteam.marketing o reserva 15 min en cal.com/cristobal-serrano-hrj2pu/demo-ai-team-15-min.",
        },
        { status: 200 },
      );
    }

    const res = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 400,
      system: SYSTEM,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    return NextResponse.json({ reply: reply || "Cuéntame un poco más." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error inesperado";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
