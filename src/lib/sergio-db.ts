/**
 * Sergio · Capa de datos con Supabase.
 * Tablas: sergio_sources, sergio_snapshots, sergio_changes, sergio_alerts, sergio_insights
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key);
}

export type SourceType = "web" | "linkedin" | "crunchbase" | "reviews" | "reddit" | "ads" | "seo";
export type SourceCategory = "direct_competitor" | "adjacent" | "inspiration";
export type Frequency = "daily" | "weekly" | "biweekly";
export type ChangeType = "price" | "feature" | "pricing_plan" | "team" | "content" | "general";
export type Relevance = "critical" | "high" | "medium" | "low";

export type Source = {
  id: string;
  type: SourceType;
  url: string;
  competitor_name: string;
  category: SourceCategory;
  frequency: Frequency;
  active: boolean;
  config: Record<string, unknown>;
  created_at: string;
  last_scraped_at: string | null;
};

export type Snapshot = {
  id: string;
  source_id: string;
  scraped_at: string;
  raw_content: string;
  parsed_data: Record<string, unknown>;
  hash: string;
  created_at: string;
};

export type Change = {
  id: string;
  source_id: string;
  snapshot_before: string | null;
  snapshot_after: string;
  change_type: ChangeType;
  diff: Record<string, unknown>;
  relevance: Relevance;
  summary: string;
  detected_at: string;
  acknowledged: boolean;
};

export type Insight = {
  id: string;
  period_start: string;
  period_end: string;
  content: string;
  highlights: string[];
  recommendations: string[];
  generated_at: string;
};

// ── Sources ──────────────────────────────────────────────────────────────────

export async function listSources(activeOnly = false): Promise<Source[]> {
  const db = getClient();
  let q = (db as Row).from("sergio_sources").select("*").order("created_at", { ascending: false });
  if (activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return data ?? [];
}

export async function createSource(input: Omit<Source, "id" | "created_at" | "last_scraped_at">): Promise<Source> {
  const db = getClient();
  const { data, error } = await (db as Row).from("sergio_sources").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateSource(id: string, patch: Partial<Source>): Promise<void> {
  const db = getClient();
  await (db as Row).from("sergio_sources").update(patch).eq("id", id);
}

export async function deleteSource(id: string): Promise<void> {
  const db = getClient();
  await (db as Row).from("sergio_sources").delete().eq("id", id);
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

export async function getLastSnapshot(sourceId: string): Promise<Snapshot | null> {
  const db = getClient();
  const { data } = await (db as Row)
    .from("sergio_snapshots")
    .select("*")
    .eq("source_id", sourceId)
    .order("scraped_at", { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

export async function createSnapshot(input: Omit<Snapshot, "id" | "created_at">): Promise<Snapshot> {
  const db = getClient();
  const { data, error } = await (db as Row).from("sergio_snapshots").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function listSnapshots(sourceId: string, limit = 10): Promise<Snapshot[]> {
  const db = getClient();
  const { data } = await (db as Row)
    .from("sergio_snapshots")
    .select("*")
    .eq("source_id", sourceId)
    .order("scraped_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ── Changes ───────────────────────────────────────────────────────────────────

export async function createChange(input: Omit<Change, "id">): Promise<Change> {
  const db = getClient();
  const { data, error } = await (db as Row).from("sergio_changes").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function listChanges(opts?: { relevance?: Relevance; acknowledged?: boolean; limit?: number }): Promise<Change[]> {
  const db = getClient();
  let q = (db as Row).from("sergio_changes").select("*, sergio_sources(competitor_name, url, type)").order("detected_at", { ascending: false });
  if (opts?.relevance) q = q.eq("relevance", opts.relevance);
  if (opts?.acknowledged !== undefined) q = q.eq("acknowledged", opts.acknowledged);
  q = q.limit(opts?.limit ?? 50);
  const { data } = await q;
  return data ?? [];
}

export async function acknowledgeChange(id: string): Promise<void> {
  const db = getClient();
  await (db as Row).from("sergio_changes").update({ acknowledged: true }).eq("id", id);
}

// ── Insights ──────────────────────────────────────────────────────────────────

export async function createInsight(input: Omit<Insight, "id">): Promise<Insight> {
  const db = getClient();
  const { data, error } = await (db as Row).from("sergio_insights").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function listInsights(limit = 10): Promise<Insight[]> {
  const db = getClient();
  const { data } = await (db as Row)
    .from("sergio_insights")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
