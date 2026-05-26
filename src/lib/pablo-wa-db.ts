/**
 * Pablo · Capa de datos WhatsApp (Supabase, multi-tenant).
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

export type WaConversationStatus = "active" | "escalated" | "closed";
export type WaDirection = "in" | "out";
export type WaIntent =
  | "consulta_precio"
  | "pedir_cita"
  | "confirmar_cita"
  | "cancelar_cita"
  | "info_servicio"
  | "queja"
  | "spam"
  | "saludo"
  | "otro";

export type WaConversation = {
  id: string;
  wa_phone_number: string;
  wa_profile_name: string | null;
  business_phone_id: string;
  owner_email: string | null;
  status: WaConversationStatus;
  intent_last: WaIntent | null;
  created_at: string;
  updated_at: string;
};

export type WaMessage = {
  id: string;
  conversation_id: string;
  direction: WaDirection;
  content: string;
  intent: WaIntent | null;
  confidence: number | null;
  reasoning: string | null;
  responded_by: "bot" | "human";
  wa_message_id: string | null;
  created_at: string;
};

export type WaLead = {
  id: string;
  conversation_id: string;
  wa_phone_number: string | null;
  wa_profile_name: string | null;
  lead_type: "cita" | "presupuesto" | "info";
  notes: string;
  owner_email: string | null;
  notified_at: string | null;
  created_at: string;
};

// ─── Conversations ───────────────────────────────────────────────────────────

export async function upsertWaConversation(input: {
  wa_phone_number: string;
  wa_profile_name?: string | null;
  business_phone_id: string;
  owner_email?: string;
}): Promise<WaConversation | null> {
  const db = getClient();
  if (!db) return null;

  const { data: existing } = await (db as Row)
    .from("pablo_conversations")
    .select("*")
    .eq("wa_phone_number", input.wa_phone_number)
    .eq("business_phone_id", input.business_phone_id)
    .maybeSingle();

  if (existing) {
    const patch: Row = { updated_at: new Date().toISOString() };
    if (input.wa_profile_name) patch.wa_profile_name = input.wa_profile_name;
    await (db as Row).from("pablo_conversations").update(patch).eq("id", existing.id);
    return { ...existing, ...patch };
  }

  const { data: created, error } = await (db as Row)
    .from("pablo_conversations")
    .insert({
      wa_phone_number: input.wa_phone_number,
      wa_profile_name: input.wa_profile_name ?? null,
      business_phone_id: input.business_phone_id,
      owner_email: input.owner_email ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return created;
}

export async function setWaConversationStatus(
  id: string,
  status: WaConversationStatus,
  intent?: WaIntent,
): Promise<void> {
  const db = getClient();
  if (!db) return;
  const patch: Row = { status, updated_at: new Date().toISOString() };
  if (intent) patch.intent_last = intent;
  await (db as Row).from("pablo_conversations").update(patch).eq("id", id);
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function insertWaMessage(input: Omit<WaMessage, "id" | "created_at">): Promise<WaMessage | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("pablo_messages")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRecentWaMessages(conversationId: string, limit = 10): Promise<WaMessage[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("pablo_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).slice().reverse();
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export async function createWaLead(input: {
  conversation_id: string;
  wa_phone_number?: string | null;
  wa_profile_name?: string | null;
  lead_type: "cita" | "presupuesto" | "info";
  notes: string;
  owner_email?: string;
}): Promise<WaLead | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("pablo_leads")
    .insert({
      conversation_id: input.conversation_id,
      wa_phone_number: input.wa_phone_number ?? null,
      wa_profile_name: input.wa_profile_name ?? null,
      lead_type: input.lead_type,
      notes: input.notes,
      owner_email: input.owner_email ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markWaLeadNotified(id: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row).from("pablo_leads").update({ notified_at: new Date().toISOString() }).eq("id", id);
}

export async function listWaLeadsByOwner(ownerEmail: string, limit = 50): Promise<WaLead[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("pablo_leads")
    .select("*")
    .eq("owner_email", ownerEmail)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
