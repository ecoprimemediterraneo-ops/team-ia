/**
 * Sergio · Motor de análisis con Claude.
 * Clasifica cambios por relevancia y genera resumen + recomendación.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Change, Relevance, ChangeType } from "./sergio-db";

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey: key });
}

type AnalysisResult = {
  relevance: Relevance;
  change_type: ChangeType;
  summary: string;
  recommendation: string;
};

const SYSTEM = `Eres Sergio, unidad de reconocimiento de AI-Team.
Analizas cambios detectados en webs de competidores y los clasificas por relevancia para el negocio.
AI-Team es un SaaS de 6 agentes IA para PYME (clínicas dentales, peluquerías, restaurantes). Precio: 99-189€/mes.

Responde SIEMPRE en JSON válido con esta estructura exacta:
{
  "relevance": "critical" | "high" | "medium" | "low",
  "change_type": "price" | "feature" | "pricing_plan" | "team" | "content" | "general",
  "summary": "1-2 frases en español explicando qué cambió",
  "recommendation": "1 frase de acción concreta para AI-Team o null"
}

Criterios de relevancia:
- critical: bajada de precio >20%, nuevo producto similar, ronda de financiación, adquisición
- high: nueva funcionalidad relevante, cambio de pricing, contratación clave
- medium: cambio de contenido, nuevo blog post, anuncio menor
- low: cambios visuales, textos menores, metadata`;

export async function analyzeChange(
  competitorName: string,
  url: string,
  diff: { added: string[]; removed: string[] }
): Promise<AnalysisResult> {
  const client = getClient();

  const prompt = `Competidor: ${competitorName}
URL: ${url}

Líneas AÑADIDAS en la web:
${diff.added.slice(0, 30).join("\n") || "(ninguna)"}

Líneas ELIMINADAS de la web:
${diff.removed.slice(0, 30).join("\n") || "(ninguna)"}

Analiza este cambio y clasifícalo.`;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const clean = text.replace(/```json\n?|\n?```/g, "").trim();

  try {
    return JSON.parse(clean) as AnalysisResult;
  } catch {
    return {
      relevance: "medium",
      change_type: "general",
      summary: `Cambio detectado en ${competitorName}.`,
      recommendation: null as unknown as string,
    };
  }
}

export async function generateWeeklyReport(
  changes: Change[],
  competitorNames: Record<string, string>
): Promise<{ content: string; highlights: string[]; recommendations: string[] }> {
  const client = getClient();

  const changesSummary = changes
    .slice(0, 30)
    .map((c) => `- [${c.relevance.toUpperCase()}] ${competitorNames[c.source_id] ?? c.source_id}: ${c.summary}`)
    .join("\n");

  const prompt = `Genera el informe semanal de inteligencia competitiva de Sergio para AI-Team.

Cambios detectados esta semana:
${changesSummary || "Sin cambios detectados."}

Responde en JSON:
{
  "content": "informe completo en markdown (400-600 palabras)",
  "highlights": ["bullet 1", "bullet 2", "bullet 3"],
  "recommendations": ["acción 1", "acción 2", "acción 3"]
}`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: "Eres Sergio, unidad de reconocimiento de AI-Team. Escribes informes de inteligencia competitiva concisos y accionables en español.",
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const clean = text.replace(/```json\n?|\n?```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch {
    return {
      content: text,
      highlights: ["Ver informe completo"],
      recommendations: [],
    };
  }
}
