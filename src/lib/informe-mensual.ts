// Informe mensual por tenant — capa de datos + narrativa.
//
// Tier ESENCIAL: lo construye `generarInformeEsencial`. Es media página con
// valor económico, tiempo ahorrado y los 5 números clave (conversaciones,
// mensajes, leads, citas, ventas) + un texto humano generado por Haiku.
//
// Diseño MODULAR: los bloques opcionales (Completo, Pro) se irán sumando aquí
// como funciones generarInformeCompleto / generarInformePro que reutilizan
// computeMetricas y añaden datos extra. La página /admin/informe renderiza
// solo los bloques que reciba.

import { anthropic, MODELS } from "./claude";
import { getMonthEvents, type AnalyticsEvent } from "./event-log";
import { listLeads } from "./pipeline";
import { getTenant, type Tenant } from "./tenants";

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------

export type MetricasEsencial = {
  conversacionesUnicas: number;     // distinct senderId con message_in
  mensajesAtendidos: number;        // message_out totales
  tiempoAhorradoHoras: number;      // mensajesAtendidos × minutesPerInteraction / 60
  leads: number;                    // lead_captured
  citas: number;                    // appointment_set
  ventas: number;                   // sale
  tasaConversion: number;           // ventas / leads (0..1)
  valorEconomicoEUR: number;        // ventas × conversionValueEUR
};

export type BloqueEsencial = {
  kind: "esencial";
  tenant: Pick<Tenant, "id" | "name" | "plan" | "minutesPerInteraction" | "conversionValueEUR">;
  periodo: { mes: string; etiqueta: string };
  metricas: MetricasEsencial;
  narrativa: string;                // texto humano redactado por Claude
  hayDatos: boolean;
};

export type InformeMensual = {
  generadoEn: string;               // ISO
  tenantId: string;
  mes: string;                      // "YYYY-MM"
  bloques: BloqueEsencial[];        // futuro: BloqueCompleto, BloquePro
};

// -----------------------------------------------------------------------------
// Cálculo de métricas (puro, reutilizable por Completo/Pro)
// -----------------------------------------------------------------------------

export async function computeMetricasEsencial(
  tenantId: string,
  mes: string,
  tenant: Tenant,
): Promise<MetricasEsencial> {
  const events: AnalyticsEvent[] = await getMonthEvents(tenantId, mes);
  const allLeads = await listLeads();
  // Filtrar leads de este tenant (los antiguos sin tenantId se asumen del fundador).
  const tenantLeads = allLeads.filter(
    (l) => (l.tenantId || "tenant_aiteam") === tenantId,
  );

  const sendersIn = new Set<string>();
  let mensajesAtendidos = 0;
  let leads = 0;
  let citas = 0;
  let ventas = 0;
  let valorEconomicoEUR = 0;

  for (const e of events) {
    if (e.type === "message_in" && e.senderId) sendersIn.add(e.senderId);
    if (e.type === "message_out") mensajesAtendidos++;
    if (e.type === "lead_captured") leads++;
    if (e.type === "appointment_set") citas++;
    if (e.type === "sale") {
      ventas++;
      valorEconomicoEUR += (e.meta?.valueEUR as number | undefined) ?? tenant.conversionValueEUR;
    }
  }

  // Cruce con pipeline: si por lo que sea no hay eventos pero sí hay leads
  // del tenant creados/movidos en el mes, los contamos también para no quedar
  // a cero en clientes que aún no tienen el log activo.
  if (leads === 0 || citas === 0 || ventas === 0) {
    for (const l of tenantLeads) {
      const updated = l.updatedAt || l.createdAt;
      if (!updated || !updated.startsWith(mes)) continue;
      if (l.stage === "demo_booked" || l.stage === "demo_done") citas++;
      if (l.stage === "client") {
        ventas++;
        valorEconomicoEUR += tenant.conversionValueEUR;
      }
    }
  }

  const tiempoAhorradoHoras = Math.round(
    (mensajesAtendidos * tenant.minutesPerInteraction) / 60 * 10,
  ) / 10;

  return {
    conversacionesUnicas: sendersIn.size,
    mensajesAtendidos,
    tiempoAhorradoHoras,
    leads,
    citas,
    ventas,
    tasaConversion: leads > 0 ? ventas / leads : 0,
    valorEconomicoEUR,
  };
}

// -----------------------------------------------------------------------------
// Narrativa (Claude Haiku)
// -----------------------------------------------------------------------------

function etiquetaMes(mes: string): string {
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const [y, m] = mes.split("-").map((n) => parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return mes;
  return `${meses[m - 1]} ${y}`;
}

async function redactarNarrativaEsencial(
  tenant: Tenant,
  periodoEtiqueta: string,
  m: MetricasEsencial,
  hayDatos: boolean,
): Promise<string> {
  if (!hayDatos) {
    return `En ${periodoEtiqueta} aún no hay datos suficientes para generar un informe. En cuanto tu equipo IA empiece a atender mensajes y leads, verás aquí tu resumen automático: cuánto valor estás ganando, cuántas horas te ahorras y dónde están las oportunidades del mes.`;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    // Fallback determinista — sin IA pero usable.
    return (
      `En ${periodoEtiqueta}, tu equipo de AI-Team atendió ${m.mensajesAtendidos} mensajes ` +
      `de ${m.conversacionesUnicas} conversaciones únicas, ahorrándote ${m.tiempoAhorradoHoras} horas. ` +
      `Detectamos ${m.leads} leads, ${m.citas} citas agendadas y ${m.ventas} ventas cerradas ` +
      `(valor estimado: ${m.valorEconomicoEUR}€). ` +
      `Recuerda: AI-Team te trae el lead, cerrarlo es tu gestión.`
    );
  }

  const prompt = `Eres el redactor del informe mensual de AI-Team para ${tenant.name}.

Datos del periodo ${periodoEtiqueta}:
- Conversaciones únicas: ${m.conversacionesUnicas}
- Mensajes atendidos por la IA: ${m.mensajesAtendidos}
- Tiempo ahorrado estimado: ${m.tiempoAhorradoHoras} horas (a ${tenant.minutesPerInteraction} min/interacción)
- Leads captados: ${m.leads}
- Citas agendadas: ${m.citas}
- Ventas cerradas: ${m.ventas}
- Tasa de conversión lead→venta: ${(m.tasaConversion * 100).toFixed(0)}%
- Valor económico generado (estimado): ${m.valorEconomicoEUR}€

Redacta un resumen de MEDIA PÁGINA, en español de España, tono cercano y profesional (tuteo), pensado para que el dueño del negocio lo lea en 30 segundos.

Estructura:
1. Primera frase: el resultado más impactante del mes (valor económico o tiempo ahorrado).
2. Dos o tres frases con los números clave en contexto humano (no robotizado).
3. Una frase honesta sobre la atribución: "AI-Team te trae el lead — cerrarlo es tu gestión."
4. Una frase de cierre motivadora orientada al siguiente mes.

Restricciones:
- Máximo 6 frases.
- No uses bullet points, asteriscos ni markdown. Texto corrido.
- No prometas "garantizado", "100%", "el mejor".
- No inventes datos que no estén arriba.
- No menciones planes, precios ni la oferta beta.

Devuelve SOLO el texto del resumen. Sin comillas, sin meta-comentarios.`;

  try {
    const ai = await anthropic.messages.create({
      model: MODELS.fast,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const text = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();
    return text || "Resumen no disponible este mes.";
  } catch (err) {
    console.error("[informe-mensual] narrativa IA falló:", err);
    return (
      `En ${periodoEtiqueta} tu equipo IA atendió ${m.mensajesAtendidos} mensajes ` +
      `y captó ${m.leads} leads. Recuerda: AI-Team te trae el lead, cerrarlo es tu gestión.`
    );
  }
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

export async function generarInformeEsencial(
  tenantId: string,
  mes: string,
): Promise<InformeMensual | null> {
  const tenant = await getTenant(tenantId);
  if (!tenant) return null;

  const metricas = await computeMetricasEsencial(tenantId, mes, tenant);
  const hayDatos =
    metricas.conversacionesUnicas > 0 ||
    metricas.mensajesAtendidos > 0 ||
    metricas.leads > 0 ||
    metricas.citas > 0 ||
    metricas.ventas > 0;

  const periodoEtiqueta = etiquetaMes(mes);
  const narrativa = await redactarNarrativaEsencial(tenant, periodoEtiqueta, metricas, hayDatos);

  const bloqueEsencial: BloqueEsencial = {
    kind: "esencial",
    tenant: {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      minutesPerInteraction: tenant.minutesPerInteraction,
      conversionValueEUR: tenant.conversionValueEUR,
    },
    periodo: { mes, etiqueta: periodoEtiqueta },
    metricas,
    narrativa,
    hayDatos,
  };

  return {
    generadoEn: new Date().toISOString(),
    tenantId,
    mes,
    bloques: [bloqueEsencial],
  };
}
