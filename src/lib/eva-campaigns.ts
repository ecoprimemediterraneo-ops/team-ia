/**
 * Eva · Tracking de campañas enviadas.
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

export type EvaCampaignType = "newsletter" | "welcome" | "promo" | "reactivacion" | "cumpleanos" | "otro";
export type EvaCampaignStatus = "programada" | "enviada" | "fallida";

export type EvaCampaign = {
  id: string;
  owner_email: string;
  tipo: EvaCampaignType;
  asunto: string;
  cuerpo: string;
  contactos_count: number;
  enviados_count: number;
  abiertos_count: number;
  clicks_count: number;
  bounces_count: number;
  bajas_count: number;
  estado: EvaCampaignStatus;
  scheduled_for: string | null;
  sent_at: string;
  created_at: string;
};

export async function createCampaign(input: Omit<EvaCampaign, "id" | "created_at" | "sent_at"> & { sent_at?: string }): Promise<EvaCampaign | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("eva_campaigns")
    .insert({ ...input, sent_at: input.sent_at ?? new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listCampaigns(ownerEmail: string, limit = 50): Promise<EvaCampaign[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("eva_campaigns")
    .select("*")
    .eq("owner_email", ownerEmail)
    .order("sent_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getEvaMetrics(ownerEmail: string): Promise<{
  campaigns_30d: number;
  campaigns_total: number;
  enviados_30d: number;
  open_rate_pct: number;
  click_rate_pct: number;
  ultima_campana: string | null;
}> {
  const db = getClient();
  if (!db) return { campaigns_30d: 0, campaigns_total: 0, enviados_30d: 0, open_rate_pct: 0, click_rate_pct: 0, ultima_campana: null };

  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: total } = await (db as Row)
    .from("eva_campaigns")
    .select("id, sent_at, enviados_count, abiertos_count, clicks_count")
    .eq("owner_email", ownerEmail)
    .order("sent_at", { ascending: false });

  const all = total ?? [];
  const month = all.filter((c: Row) => c.sent_at >= monthAgo);
  const totalEnviados30d = month.reduce((s: number, c: Row) => s + (c.enviados_count || 0), 0);
  const totalAbiertos30d = month.reduce((s: number, c: Row) => s + (c.abiertos_count || 0), 0);
  const totalClicks30d = month.reduce((s: number, c: Row) => s + (c.clicks_count || 0), 0);

  return {
    campaigns_30d: month.length,
    campaigns_total: all.length,
    enviados_30d: totalEnviados30d,
    open_rate_pct: totalEnviados30d > 0 ? Math.round((totalAbiertos30d / totalEnviados30d) * 100) : 0,
    click_rate_pct: totalEnviados30d > 0 ? Math.round((totalClicks30d / totalEnviados30d) * 100) : 0,
    ultima_campana: all[0]?.sent_at ?? null,
  };
}

export async function bumpCampaignMetric(id: string, field: "abiertos_count" | "clicks_count" | "bounces_count" | "bajas_count", delta = 1): Promise<void> {
  const db = getClient();
  if (!db) return;
  const { data: existing } = await (db as Row)
    .from("eva_campaigns")
    .select(field)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return;
  await (db as Row)
    .from("eva_campaigns")
    .update({ [field]: (existing[field] || 0) + delta })
    .eq("id", id);
}
