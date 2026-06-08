// Feed de actividad — lee del event-log del tenant y convierte cada
// AnalyticsEvent en una entrada lista para pintar en el dashboard.
//
// Cubre los tipos del EventType existente (message_in/out, lead_captured,
// appointment_set, sale, handoff_human, review_in, review_replied) más un
// fallback para cualquier tipo futuro.

import "server-only";
import { getMonthEvents, type AnalyticsEvent, type EventChannel, type EventType } from "./event-log";
import { agentBySlug, type AgentSlug } from "./agents";

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------

export type FeedEntry = {
  id: string;
  ts: string;
  type: EventType;
  channel: EventChannel;
  agentSlug?: AgentSlug;
  agentName: string;
  agentEmoji: string;
  agentColor: string;
  label: string;          // frase natural breve (ej. "Carmen agendó cita con María García")
  detail?: string;        // segunda línea opcional (ej. "Limpieza dental · 15 jun 10:00")
  htmlLink?: string;      // link externo opcional (ej. Google Calendar)
};

const AGENT_SLUGS = new Set<string>(["pablo", "marta", "carmen", "eva", "lucia", "rocio", "sergio"]);

function channelToAgentSlug(channel: EventChannel): AgentSlug | undefined {
  return AGENT_SLUGS.has(channel) ? (channel as AgentSlug) : undefined;
}

function channelDisplay(channel: EventChannel) {
  const slug = channelToAgentSlug(channel);
  if (slug) {
    const a = agentBySlug[slug];
    return { agentSlug: slug, agentName: a.name, agentEmoji: a.emoji, agentColor: a.color };
  }
  if (channel === "dashboard") return { agentName: "Panel", agentEmoji: "📋", agentColor: "#FAF7F0" };
  if (channel === "system") return { agentName: "Sistema", agentEmoji: "⚙️", agentColor: "#FAF7F0" };
  return { agentName: channel, agentEmoji: "•", agentColor: "#FAF7F0" };
}

// -----------------------------------------------------------------------------
// Formateadores de texto
// -----------------------------------------------------------------------------

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function prevMonthKey(d: Date): string {
  const p = new Date(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
  return monthKey(p);
}

function maskSender(senderId?: string): string {
  if (!senderId) return "";
  if (senderId.length <= 4) return senderId;
  return `…${senderId.slice(-4)}`;
}

function ratingStars(n?: number): string {
  if (!n || !Number.isFinite(n)) return "";
  return "⭐".repeat(Math.max(0, Math.min(5, n)));
}

function formatStartHumanES(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const fecha = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${fecha} · ${hora}`;
}

function formatEvent(ev: AnalyticsEvent): { label: string; detail?: string; htmlLink?: string } {
  const meta = (ev.meta || {}) as Record<string, unknown>;
  const channelInfo = channelDisplay(ev.channel);
  const agente = channelInfo.agentName;

  switch (ev.type) {
    case "appointment_set": {
      const nombre = String(meta.nombre || "");
      const motivo = String(meta.motivo || "");
      const cuando = formatStartHumanES(String(meta.fechaIso || meta.horaIso || ev.ts));
      const label = nombre
        ? `${agente} agendó cita con ${nombre}`
        : `${agente} agendó una cita`;
      const detail = [motivo, cuando].filter(Boolean).join(" · ");
      const htmlLink = typeof meta.htmlLink === "string" ? meta.htmlLink : undefined;
      return { label, detail: detail || undefined, htmlLink };
    }

    case "sale": {
      const valorEUR = typeof meta.valueEUR === "number" ? meta.valueEUR : undefined;
      const sector = typeof meta.sector === "string" ? meta.sector : "";
      const detail = [
        valorEUR ? `${valorEUR}€` : "",
        sector,
      ].filter(Boolean).join(" · ");
      return {
        label: `Venta cerrada (${agente})`,
        detail: detail || undefined,
      };
    }

    case "lead_captured": {
      const sector = typeof meta.sector === "string" ? meta.sector : "";
      return {
        label: `Lead nuevo captado por ${agente}`,
        detail: sector || undefined,
      };
    }

    case "handoff_human": {
      return {
        label: `${agente} ha derivado a humano`,
        detail: ev.senderId ? `desde ${maskSender(ev.senderId)}` : undefined,
      };
    }

    case "review_in": {
      const rating = typeof meta.rating === "number" ? meta.rating : undefined;
      const stars = ratingStars(rating);
      return {
        label: `Reseña recibida en Google${stars ? ` ${stars}` : ""}`,
        detail: agente !== "Rocío" ? agente : undefined,
      };
    }

    case "review_replied": {
      const rating = typeof meta.rating === "number" ? meta.rating : undefined;
      const stars = ratingStars(rating);
      const auto = meta.auto === true ? " (auto)" : "";
      return {
        label: `${agente} respondió una reseña${stars ? ` ${stars}` : ""}${auto}`,
      };
    }

    case "message_in": {
      const sender = maskSender(ev.senderId);
      return {
        label: `Mensaje entrante de cliente`,
        detail: `vía ${agente}${sender ? ` · ${sender}` : ""}`,
      };
    }

    case "message_out": {
      const latency = typeof meta.latencyMs === "number" ? Math.round(meta.latencyMs / 100) / 10 : undefined;
      return {
        label: `${agente} respondió`,
        detail: latency ? `${latency}s` : undefined,
      };
    }

    default: {
      // Fallback humanizado para tipos futuros
      return { label: `${agente} · ${String(ev.type).replace(/_/g, " ")}` };
    }
  }
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

export type FeedCounters = {
  citas: number;
  mensajesIn: number;
  mensajesOut: number;
  leads: number;
  ventas: number;
  resenasIn: number;
  resenasRepliedAuto: number;
};

export type FeedResult = {
  entries: FeedEntry[];
  counters: FeedCounters;
  /** Para depuración / monitor */
  loaded: { month: string; count: number }[];
};

/**
 * Devuelve los últimos N eventos del tenant, fusionando este mes y el
 * anterior (para que el feed no quede vacío justo al cambiar de mes).
 */
export async function getFeed(
  tenantId: string,
  limit = 20,
  now: Date = new Date(),
): Promise<FeedResult> {
  const months = [monthKey(now), prevMonthKey(now)];
  const loaded: { month: string; count: number }[] = [];
  const all: AnalyticsEvent[] = [];
  for (const m of months) {
    const list = await getMonthEvents(tenantId, m);
    loaded.push({ month: m, count: list.length });
    for (const e of list) all.push(e);
  }
  // Más reciente primero
  all.sort((a, b) => (a.ts < b.ts ? 1 : -1));

  const entries: FeedEntry[] = all.slice(0, limit).map((ev) => {
    const ch = channelDisplay(ev.channel);
    const f = formatEvent(ev);
    return {
      id: ev.id,
      ts: ev.ts,
      type: ev.type,
      channel: ev.channel,
      agentSlug: ch.agentSlug,
      agentName: ch.agentName,
      agentEmoji: ch.agentEmoji,
      agentColor: ch.agentColor,
      label: f.label,
      detail: f.detail,
      htmlLink: f.htmlLink,
    };
  });

  // Contadores combinados de los 2 meses para los KPIs del dashboard
  const counters: FeedCounters = {
    citas: 0,
    mensajesIn: 0,
    mensajesOut: 0,
    leads: 0,
    ventas: 0,
    resenasIn: 0,
    resenasRepliedAuto: 0,
  };
  for (const e of all) {
    switch (e.type) {
      case "appointment_set": counters.citas++; break;
      case "message_in":      counters.mensajesIn++; break;
      case "message_out":     counters.mensajesOut++; break;
      case "lead_captured":   counters.leads++; break;
      case "sale":            counters.ventas++; break;
      case "review_in":       counters.resenasIn++; break;
      case "review_replied":
        counters.resenasRepliedAuto++;
        break;
    }
  }

  return { entries, counters, loaded };
}

/**
 * Conveniencia para componentes que solo necesitan las entradas (sin
 * contadores). Equivalente a `(await getFeed(t, n)).entries`.
 */
export async function getFeedEntries(
  tenantId: string,
  limit = 20,
): Promise<FeedEntry[]> {
  const r = await getFeed(tenantId, limit);
  return r.entries;
}
