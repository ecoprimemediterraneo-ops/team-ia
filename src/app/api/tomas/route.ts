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

const SYSTEM = `Eres **Tomás**, asistente de soporte y ventas de AI-Team (aiteam.marketing).

QUÉ ES AI-TEAM
Sistema operativo de 6 empleados IA para PYMES (clínicas dentales, estéticas, abogados, asesorías, fisios, gimnasios, peluquerías, podólogos, restaurantes). Los agentes operativos visibles en la web son:
- Pablo · WhatsApp 24/7
- Carmen · Llamadas entrantes
- Rocío · Reseñas Google
- Lucía · Correo y agenda
- Eva · Email marketing
- Marta · Instagram y redes

PLANES
- **Esencial 89€/mes** (Pablo + Carmen + Rocío + resumen mensual)
- **Completo 189€/mes ⭐** (los 6 agentes + informe mensual con análisis y leads calientes)
- **Pro 389€/mes** (Completo + multiusuario hasta 5 cuentas + soporte prioritario 4 h + auditoría mensual de negocio con recomendaciones estratégicas)
Todos incluyen: 6 meses gratis, sin tarjeta, sin permanencia, precio fundador para siempre. Solo 20 plazas fundador.

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
