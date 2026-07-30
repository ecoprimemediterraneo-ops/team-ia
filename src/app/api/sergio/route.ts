// GET  /api/sergio — competidores VIGILADOS DE VERDAD (las fuentes dadas de alta).
// POST /api/sergio — análisis libre de un competidor, o pitch a partir de una fuente real.
//
// Antes el GET devolvía `MOCK_COMPETITORS`: siete competidores inventados en el
// código, con valoraciones y debilidades ficticias. Se han eliminado. Si no hay
// ninguna fuente dada de alta, este endpoint devuelve una lista VACÍA y el panel
// enseña un estado vacío honesto. Nunca se rellena con datos de ejemplo.
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { leerCompetidoresVigilados } from "@/lib/sergio-vigilancia";
import { filtrarCompetidores } from "@/lib/sergio";
import { anthropic } from "@/lib/claude";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
const isFounder = (e: string) => e === FOUNDER_EMAIL || e === "crisasky@gmail.com";

export async function GET(req: Request) {
  try {
    const { email } = await requireSession();
    if (!isFounder(email)) return NextResponse.json({ error: "Solo founder" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const categoria = searchParams.get("categoria") || undefined;
    const soloActivos = searchParams.get("activos") === "1";

    const r = await leerCompetidoresVigilados();
    const competidores = filtrarCompetidores(r.competidores, { categoria, soloActivos });
    return NextResponse.json({
      competidores,
      total: r.competidores.length,
      hayFuentes: r.hayFuentes,
      ...(r.motivo ? { motivo: r.motivo, detalle: r.detalle } : {}),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
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

IMPORTANTE: no tienes acceso en tiempo real a la web de este competidor. Escribe el análisis como una ESTIMACIÓN basada en patrones típicos del sector y DILO EXPLÍCITAMENTE en la primera línea. No inventes cifras concretas (precios, número de reseñas, valoraciones) como si fueran datos verificados.`,
        }],
      });

      const report = msg.content[0].type === "text" ? msg.content[0].text : "";
      return NextResponse.json({ report });
    }

    // Pitch a partir de una fuente REAL dada de alta (antes salía de un competidor
    // inventado con valoraciones y debilidades ficticias).
    const { email } = await requireSession();
    if (!isFounder(email)) return NextResponse.json({ error: "Solo founder" }, { status: 403 });

    const { competitorId } = body;
    const { competidores: todos } = await leerCompetidoresVigilados();
    const c = todos.find((x) => x.id === competitorId);
    if (!c) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Genera un pitch de ventas de 3 párrafos para convencer a un negocio del sector de contratar AI-Team.

Lo único que sabemos de este competidor vigilado:
Nombre: ${c.nombre}
Web: ${c.url}
Categoría: ${c.categoria}
Cambios detectados hasta hoy: ${c.cambiosDetectados}
${c.ultimaRevision ? `Última revisión: ${c.ultimaRevision}` : "Todavía no se ha revisado su web ni una vez."}

El pitch debe:
1. Apoyarse SOLO en los datos de arriba. No inventes valoraciones de Google, número de reseñas, tiempos de respuesta ni debilidades que no aparezcan aquí.
2. Explicar cómo AI-Team ayuda, con ejemplos concretos.
3. Terminar con una llamada a la acción (20 plazas fundadoras · 6 meses gratis).

Tono: directo, sin rodeos, en español de España.`,
      }],
    });

    const pitch = msg.content[0].type === "text" ? msg.content[0].text : "";
    return NextResponse.json({ pitch, competidor: c });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
