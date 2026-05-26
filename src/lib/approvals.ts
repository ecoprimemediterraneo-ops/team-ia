/**
 * Aprobaciones · junta las colas pending de Marta, Pablo, Rocío y Eva.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function getDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key);
}

export type ApprovalItem = {
  id: string;
  agent: "marta" | "pablo" | "rocio" | "eva" | "lucia";
  agent_emoji: string;
  agent_color: string;
  tipo: string;
  contenido_preview: string;
  contenido_full: string;
  created_at: string;
  link?: string;
};

async function safeList(table: string, owner_email: string, where?: Record<string, unknown>, limit = 30) {
  const db = getDb(); if (!db) return [];
  try {
    let q = (db as Row).from(table).select("*").eq("owner_email", owner_email);
    if (where) for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
    const { data } = await q.order("created_at", { ascending: false }).limit(limit);
    return data ?? [];
  } catch { return []; }
}

export async function listAllApprovals(owner_email: string): Promise<ApprovalItem[]> {
  const items: ApprovalItem[] = [];

  // Marta pending queue (table: marta_pending)
  const martaPending = await safeList("marta_pending", owner_email, { status: "pending" });
  for (const m of martaPending) {
    items.push({
      id: m.id, agent: "marta", agent_emoji: "📱", agent_color: "#FF7A59",
      tipo: m.tipo || "post",
      contenido_preview: (m.caption || m.content || "").slice(0, 140),
      contenido_full: m.caption || m.content || "",
      created_at: m.created_at,
      link: "/dashboard/marta",
    });
  }

  // Pablo pending (table: pablo_pending)
  const pabloPending = await safeList("pablo_pending", owner_email, { status: "pending" });
  for (const p of pabloPending) {
    items.push({
      id: p.id, agent: "pablo", agent_emoji: "💬", agent_color: "#25D366",
      tipo: p.intent || "respuesta",
      contenido_preview: (p.proposed_response || p.response || "").slice(0, 140),
      contenido_full: p.proposed_response || p.response || "",
      created_at: p.created_at,
      link: "/dashboard/pablo",
    });
  }

  // Rocío pending (table: rocio_pending o reviews_pending)
  const rocioPending = await safeList("rocio_pending", owner_email, { status: "pending" });
  for (const r of rocioPending) {
    items.push({
      id: r.id, agent: "rocio", agent_emoji: "⭐", agent_color: "#FBBF24",
      tipo: `${r.rating || "?"}★ reseña`,
      contenido_preview: (r.proposed_response || r.response || "").slice(0, 140),
      contenido_full: r.proposed_response || r.response || "",
      created_at: r.created_at,
      link: "/dashboard/rocio",
    });
  }

  // Lucía drafts (table: lucia_drafts)
  const luciaPending = await safeList("lucia_drafts", owner_email, { status: "draft_created" });
  for (const l of luciaPending) {
    items.push({
      id: l.id, agent: "lucia", agent_emoji: "📬", agent_color: "#F5C518",
      tipo: l.intent || "email",
      contenido_preview: `Re: ${l.subject || ""} → ${(l.proposed_response || "").slice(0, 100)}`,
      contenido_full: l.proposed_response || "",
      created_at: l.created_at,
      link: "/dashboard/lucia",
    });
  }

  // Eva campañas programadas (estado=programada)
  const evaPending = await safeList("eva_campaigns", owner_email, { estado: "programada" });
  for (const e of evaPending) {
    items.push({
      id: e.id, agent: "eva", agent_emoji: "✉️", agent_color: "#60A5FA",
      tipo: e.tipo || "campaña",
      contenido_preview: e.asunto || "",
      contenido_full: `${e.asunto}\n\n${e.cuerpo || ""}`.slice(0, 800),
      created_at: e.created_at,
      link: "/dashboard/eva",
    });
  }

  return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
