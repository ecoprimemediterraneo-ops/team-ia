import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { MOCK_COMPETITORS, filterCompetitors } from "@/lib/sergio";
import { anthropic } from "@/lib/claude";

/**
 * GET — Datos mock de competidores para el showroom del agente.
 * Abierto a cualquier sesión (es contenido demo, no datos privados).
 */
export async function GET(req: Request) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const sector = searchParams.get("sector") || undefined;
    const city = searchParams.get("city") || undefined;

    const competitors = filterCompetitors(MOCK_COMPETITORS, { sector, city });
    const sectors = [...new Set(MOCK_COMPETITORS.map((c) => c.sector))].sort();
    const cities = [...new Set(MOCK_COMPETITORS.map((c) => c.city))].sort();

    return NextResponse.json({ competitors, sectors, cities, total: MOCK_COMPETITORS.length });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireSession();

    const body = await req.json();

    // Análisis libre de competidor desde el dashboard de Sergio
    if (body.competitor && body.reportType) {
      const { competitor, reportType } = body;

      const reportLabels: Record<string, string> = {
        cambios: "cambios recientes detectados en su web, precios y comunicación",
        precios: "estructura de precios, tarifas y comparativa de valor",
        features: "nuevas funcionalidades, servicios o productos lanzados recientemente",
        equipo: "cambios en el equipo, contrataciones o salidas relevantes",
        contenido: "cambios en mensajes de marketing, posicionamiento y contenido",
      };

      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `Eres Sergio, agente de inteligencia competitiva de AI-Team. Analiza el siguiente competidor y genera un informe ejecutivo sobre: ${reportLabels[reportType] || "análisis general"}.

Competidor: ${competitor}

El informe debe:
1. Empezar con un resumen ejecutivo de 2-3 líneas
2. Listar los hallazgos más importantes con bullet points
3. Incluir 2-3 recomendaciones accionables para el negocio del usuario
4. Terminar con un nivel de alerta: 🟢 Bajo / 🟡 Medio / 🔴 Alto

Tono: directo, analítico, en español de España. Máximo 400 palabras.

Nota: Si no tienes datos en tiempo real sobre este competidor específico, genera un análisis basado en patrones típicos del sector y deja claro que es una estimación.`,
        }],
      });

      const report = msg.content[0].type === "text" ? msg.content[0].text : "";
      return NextResponse.json({ report });
    }

    // Pitch desde dataset mock (cualquier sesión)
    await requireSession();
    const { competitorId } = body;
    const competitor = MOCK_COMPETITORS.find((c) => c.id === competitorId);
    if (!competitor) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Analiza este competidor y dame un pitch de ventas de 3 párrafos para convencer a un negocio similar de contratar AI-Team:

Competidor: ${competitor.name}
Sector: ${competitor.sector}
Ciudad: ${competitor.city}
Rating Google: ${competitor.googleRating}★ (${competitor.reviewCount} reseñas)
Velocidad WhatsApp: ${competitor.whatsappSpeed}
Reservas online: ${competitor.hasBookingOnline ? "Sí" : "No"}
Debilidades detectadas: ${competitor.weaknesses.join(", ")}

El pitch debe:
1. Mencionar una debilidad específica del competidor sin nombrarlo
2. Explicar cómo AI-Team lo resuelve con ejemplos concretos
3. Terminar con una llamada a la acción urgente (30 días gratis)

Tono: directo, sin rodeos, en español de España.`,
      }],
    });

    const pitch = msg.content[0].type === "text" ? msg.content[0].text : "";
    return NextResponse.json({ pitch, competitor });
  } catch (e) {
    console.error("[api]", e); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
