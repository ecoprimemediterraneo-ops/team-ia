/**
 * Rocío · Capa de datos Supabase (multi-tenant + multi-local).
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

export type RocioLocation = {
  id: string;
  owner_email: string;
  name: string;
  google_place_id: string | null;
  google_review_link: string | null;
  address: string | null;
  city: string | null;
  active: boolean;
  created_at: string;
};

export type RocioReview = {
  id: string;
  owner_email: string;
  location_id: string | null;
  reviewer_name: string | null;
  rating: number;
  text: string | null;
  google_review_id: string | null;
  status: "pending" | "responded" | "ignored" | "escalated";
  created_at_google: string | null;
  imported_at: string;
};

export type RocioPending = {
  id: string;
  owner_email: string;
  review_id: string;
  proposed_response: string;
  intent: string | null;
  status: "pending" | "approved" | "rejected" | "sent" | "failed";
  approved_text: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
};

export type RocioRequest = {
  id: string;
  owner_email: string;
  location_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  channel: "whatsapp" | "sms" | "email" | "qr" | "link";
  message_sent: string | null;
  status: "sent" | "clicked" | "converted";
  clicked_at: string | null;
  created_at: string;
};

// ─── Locations ───────────────────────────────────────────────────────────────

export async function listLocations(ownerEmail: string): Promise<RocioLocation[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("rocio_locations")
    .select("*")
    .eq("owner_email", ownerEmail)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createLocation(input: Omit<RocioLocation, "id" | "created_at" | "active"> & { active?: boolean }): Promise<RocioLocation | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("rocio_locations")
    .insert({ ...input, active: input.active ?? true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getLocationForOwner(id: string, ownerEmail: string): Promise<RocioLocation | null> {
  const db = getClient();
  if (!db) return null;
  const { data } = await (db as Row)
    .from("rocio_locations")
    .select("*")
    .eq("id", id)
    .eq("owner_email", ownerEmail)
    .maybeSingle();
  return data ?? null;
}

export async function deleteLocation(id: string, ownerEmail: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("rocio_locations").delete().eq("id", id).eq("owner_email", ownerEmail);
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export async function listReviews(
  ownerEmail: string,
  opts?: { status?: RocioReview["status"]; limit?: number },
): Promise<RocioReview[]> {
  const db = getClient();
  if (!db) return [];
  let q = (db as Row)
    .from("rocio_reviews")
    .select("*")
    .eq("owner_email", ownerEmail)
    .order("imported_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data } = await q;
  return data ?? [];
}

export async function createReview(input: Omit<RocioReview, "id" | "imported_at" | "status"> & { status?: RocioReview["status"] }): Promise<RocioReview | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("rocio_reviews")
    .insert({ ...input, status: input.status ?? "pending" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setReviewStatus(id: string, status: RocioReview["status"]): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("rocio_reviews").update({ status }).eq("id", id);
}

// ─── Pending responses (modo ruedines) ──────────────────────────────────────

export async function createRocioPending(input: Omit<RocioPending, "id" | "created_at" | "status" | "approved_text" | "approved_at" | "approved_by">): Promise<RocioPending | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("rocio_pending_responses")
    .insert({ ...input, status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listRocioPending(ownerEmail: string, status: RocioPending["status"] = "pending"): Promise<RocioPending[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("rocio_pending_responses")
    .select("*")
    .eq("owner_email", ownerEmail)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getRocioPending(id: string, ownerEmail: string): Promise<RocioPending | null> {
  const db = getClient();
  if (!db) return null;
  const { data } = await (db as Row)
    .from("rocio_pending_responses")
    .select("*")
    .eq("id", id)
    .eq("owner_email", ownerEmail)
    .maybeSingle();
  return data ?? null;
}

export async function updateRocioPendingStatus(id: string, patch: Partial<Pick<RocioPending, "status" | "approved_text" | "approved_at" | "approved_by">>): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("rocio_pending_responses").update(patch).eq("id", id);
}

// ─── Review requests (tracking QR/WhatsApp) ─────────────────────────────────

export async function createRequest(input: Omit<RocioRequest, "id" | "created_at" | "status" | "clicked_at"> & { status?: RocioRequest["status"] }): Promise<RocioRequest | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("rocio_review_requests")
    .insert({ ...input, status: input.status ?? "sent" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listRequests(ownerEmail: string, limit = 50): Promise<RocioRequest[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("rocio_review_requests")
    .select("*")
    .eq("owner_email", ownerEmail)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export async function getRocioMetrics(ownerEmail: string): Promise<{
  total_reviews: number;
  avg_rating: number;
  pending_count: number;
  responded_count: number;
  five_star_count: number;
  one_two_star_count: number;
  requests_30d: number;
}> {
  const db = getClient();
  if (!db) {
    return { total_reviews: 0, avg_rating: 0, pending_count: 0, responded_count: 0, five_star_count: 0, one_two_star_count: 0, requests_30d: 0 };
  }
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: reviews } = await (db as Row)
    .from("rocio_reviews")
    .select("rating, status")
    .eq("owner_email", ownerEmail);

  const total = (reviews ?? []).length;
  const avg = total > 0 ? (reviews as Row[]).reduce((s, r) => s + r.rating, 0) / total : 0;
  const pending = (reviews ?? []).filter((r: Row) => r.status === "pending").length;
  const responded = (reviews ?? []).filter((r: Row) => r.status === "responded").length;
  const fives = (reviews ?? []).filter((r: Row) => r.rating === 5).length;
  const bad = (reviews ?? []).filter((r: Row) => r.rating <= 2).length;

  const { count: reqs } = await (db as Row)
    .from("rocio_review_requests")
    .select("*", { count: "exact", head: true })
    .eq("owner_email", ownerEmail)
    .gte("created_at", monthAgo);

  return {
    total_reviews: total,
    avg_rating: Math.round(avg * 100) / 100,
    pending_count: pending,
    responded_count: responded,
    five_star_count: fives,
    one_two_star_count: bad,
    requests_30d: reqs ?? 0,
  };
}
