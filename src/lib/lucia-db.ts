/**
 * Lucía · Capa de datos para drafts + métricas.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key);
}

export type LuciaIntent = "pregunta" | "reunion" | "queja" | "spam" | "info" | "propuesta" | "factura" | "otro";

export type LuciaDraft = {
  id: string;
  owner_email: string;
  thread_id: string | null;
  message_id: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  incoming_snippet: string | null;
  proposed_response: string;
  intent: LuciaIntent | null;
  confidence: number | null;
  status: "draft_created" | "sent" | "edited" | "rejected";
  edited_text: string | null;
  gmail_draft_id: string | null;
  created_at: string;
  acted_at: string | null;
};

export async function createLuciaDraft(input: Omit<LuciaDraft, "id" | "created_at" | "acted_at" | "edited_text" | "status"> & { status?: LuciaDraft["status"] }): Promise<LuciaDraft | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("lucia_drafts")
    .insert({ ...input, status: input.status ?? "draft_created" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listLuciaDrafts(ownerEmail: string, limit = 50): Promise<LuciaDraft[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("lucia_drafts")
    .select("*")
    .eq("owner_email", ownerEmail)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getLuciaDraftById(id: string, ownerEmail: string): Promise<LuciaDraft | null> {
  const db = getClient();
  if (!db) return null;
  const { data } = await (db as Row)
    .from("lucia_drafts")
    .select("*")
    .eq("id", id)
    .eq("owner_email", ownerEmail)
    .maybeSingle();
  return data ?? null;
}

export async function updateLuciaDraftStatus(
  id: string,
  patch: Partial<Pick<LuciaDraft, "status" | "edited_text" | "acted_at" | "gmail_draft_id">>,
): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("lucia_drafts").update(patch).eq("id", id);
}

// ─── Métricas diarias ───────────────────────────────────────────────────────

export async function bumpLuciaMetric(
  ownerEmail: string,
  field: "emails_processed" | "drafts_created" | "promos_archived" | "minutes_saved",
  delta = 1,
): Promise<void> {
  const db = getClient();
  if (!db) return;
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await (db as Row)
    .from("lucia_daily_metrics")
    .select("*")
    .eq("owner_email", ownerEmail)
    .eq("day", today)
    .maybeSingle();

  if (existing) {
    await (db as Row)
      .from("lucia_daily_metrics")
      .update({ [field]: (existing[field] || 0) + delta })
      .eq("id", existing.id);
  } else {
    await (db as Row)
      .from("lucia_daily_metrics")
      .insert({ owner_email: ownerEmail, day: today, [field]: delta });
  }
}

export async function getLuciaMetrics(ownerEmail: string): Promise<{
  drafts_7d: number;
  drafts_total: number;
  promos_7d: number;
  emails_7d: number;
  minutes_saved_7d: number;
  ultima_actividad: string | null;
}> {
  const db = getClient();
  if (!db) {
    return { drafts_7d: 0, drafts_total: 0, promos_7d: 0, emails_7d: 0, minutes_saved_7d: 0, ultima_actividad: null };
  }
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const { data: weekRows } = await (db as Row)
    .from("lucia_daily_metrics")
    .select("emails_processed, drafts_created, promos_archived, minutes_saved")
    .eq("owner_email", ownerEmail)
    .gte("day", weekAgo);

  const sum = (rows: Row[], k: string) => (rows ?? []).reduce((s: number, r: Row) => s + (r[k] || 0), 0);

  const { count: totalDrafts } = await (db as Row)
    .from("lucia_drafts")
    .select("*", { count: "exact", head: true })
    .eq("owner_email", ownerEmail);

  const { data: last } = await (db as Row)
    .from("lucia_drafts")
    .select("created_at")
    .eq("owner_email", ownerEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    drafts_7d: sum(weekRows ?? [], "drafts_created"),
    drafts_total: totalDrafts ?? 0,
    promos_7d: sum(weekRows ?? [], "promos_archived"),
    emails_7d: sum(weekRows ?? [], "emails_processed"),
    minutes_saved_7d: sum(weekRows ?? [], "minutes_saved"),
    ultima_actividad: last?.created_at ?? null,
  };
}
