/**
 * Pablo · Cola de respuestas pendientes de aprobación humana.
 */

import type { WaIntent } from "./pablo-wa-db";

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

export type PabloPendingStatus = "pending" | "approved" | "rejected" | "sent" | "failed";

export type PabloPending = {
  id: string;
  conversation_id: string;
  wa_phone_number: string;
  wa_profile_name: string | null;
  owner_email: string;
  incoming_message_id: string | null;
  incoming_text: string;
  proposed_response: string;
  intent: WaIntent | null;
  confidence: number | null;
  status: PabloPendingStatus;
  approved_text: string | null;
  approved_at: string | null;
  approved_by: string | null;
  wa_message_id: string | null;
  created_at: string;
};

export async function createPabloPending(input: Omit<PabloPending, "id" | "created_at" | "status" | "approved_text" | "approved_at" | "approved_by" | "wa_message_id">): Promise<PabloPending | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("pablo_pending_responses")
    .insert({ ...input, status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listPabloPending(ownerEmail: string, status: PabloPendingStatus = "pending", limit = 50): Promise<PabloPending[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("pablo_pending_responses")
    .select("*")
    .eq("owner_email", ownerEmail)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getPabloPendingById(id: string, ownerEmail: string): Promise<PabloPending | null> {
  const db = getClient();
  if (!db) return null;
  const { data } = await (db as Row)
    .from("pablo_pending_responses")
    .select("*")
    .eq("id", id)
    .eq("owner_email", ownerEmail)
    .maybeSingle();
  return data ?? null;
}

export async function updatePabloPendingStatus(id: string, patch: Partial<Pick<PabloPending, "status" | "approved_text" | "approved_at" | "approved_by" | "wa_message_id">>): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("pablo_pending_responses").update(patch).eq("id", id);
}

export async function countPabloByStatus(ownerEmail: string): Promise<{ pending: number; approved: number; rejected: number }> {
  const db = getClient();
  if (!db) return { pending: 0, approved: 0, rejected: 0 };
  const counts = await Promise.all(
    (["pending", "approved", "rejected"] as PabloPendingStatus[]).map(async (s) => {
      const { count } = await (db as Row)
        .from("pablo_pending_responses")
        .select("*", { count: "exact", head: true })
        .eq("owner_email", ownerEmail)
        .eq("status", s);
      return [s, count ?? 0] as const;
    }),
  );
  const map = Object.fromEntries(counts) as Record<PabloPendingStatus, number>;
  return { pending: map.pending, approved: map.approved, rejected: map.rejected };
}
