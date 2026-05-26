/**
 * Marta · Capa de datos Instagram (Supabase).
 * Tablas: marta_ig_conversations, marta_ig_messages, marta_ig_leads.
 *
 * Si Supabase no está configurado, las funciones devuelven null/[] sin romper.
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

export type ConversationStatus = "active" | "escalated" | "closed";
export type MessageType = "dm" | "comment" | "mention" | "story_reply";
export type MessageDirection = "in" | "out";
export type RespondedBy = "bot" | "human";

export type Intent =
  | "consulta_precio"
  | "pedir_cita"
  | "info_servicio"
  | "queja"
  | "spam"
  | "saludo"
  | "otro";

export type Conversation = {
  id: string;
  ig_user_id: string;
  ig_username: string | null;
  business_account_id: string;
  owner_email: string | null;
  status: ConversationStatus;
  intent_last: Intent | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  direction: MessageDirection;
  message_type: MessageType;
  content: string;
  media_url: string | null;
  intent: Intent | null;
  confidence: number | null;
  reasoning: string | null;
  responded_by: RespondedBy;
  meta_message_id: string | null;
  created_at: string;
};

export type Lead = {
  id: string;
  conversation_id: string;
  ig_username: string | null;
  lead_type: "cita" | "presupuesto" | "info";
  notes: string;
  owner_email: string | null;
  notified_at: string | null;
  created_at: string;
};

// ─── Conversations ───────────────────────────────────────────────────────────

/**
 * Upsert: busca conversación por (ig_user_id, business_account_id).
 * Si no existe, la crea. Devuelve siempre la conversación actual.
 */
export async function upsertConversation(input: {
  ig_user_id: string;
  ig_username?: string;
  business_account_id: string;
  owner_email?: string;
}): Promise<Conversation | null> {
  const db = getClient();
  if (!db) return null;

  const { data: existing } = await (db as Row)
    .from("marta_ig_conversations")
    .select("*")
    .eq("ig_user_id", input.ig_user_id)
    .eq("business_account_id", input.business_account_id)
    .maybeSingle();

  if (existing) {
    // Actualizar updated_at + username si llegó nuevo
    const patch: Row = { updated_at: new Date().toISOString() };
    if (input.ig_username) patch.ig_username = input.ig_username;
    await (db as Row)
      .from("marta_ig_conversations")
      .update(patch)
      .eq("id", existing.id);
    return { ...existing, ...patch };
  }

  const { data: created, error } = await (db as Row)
    .from("marta_ig_conversations")
    .insert({
      ig_user_id: input.ig_user_id,
      ig_username: input.ig_username ?? null,
      business_account_id: input.business_account_id,
      owner_email: input.owner_email ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return created;
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  const db = getClient();
  if (!db) return null;
  const { data } = await (db as Row)
    .from("marta_ig_conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

export async function setConversationStatus(
  id: string,
  status: ConversationStatus,
  intent?: Intent,
): Promise<void> {
  const db = getClient();
  if (!db) return;
  const patch: Row = { status, updated_at: new Date().toISOString() };
  if (intent) patch.intent_last = intent;
  await (db as Row).from("marta_ig_conversations").update(patch).eq("id", id);
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function insertMessage(input: Omit<Message, "id" | "created_at">): Promise<Message | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("marta_ig_messages")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRecentMessages(
  conversationId: string,
  limit = 10,
): Promise<Message[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("marta_ig_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  // Devolvemos cronológico ascendente
  return (data ?? []).slice().reverse();
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export async function createLead(input: {
  conversation_id: string;
  ig_username?: string;
  lead_type: "cita" | "presupuesto" | "info";
  notes: string;
  owner_email?: string;
}): Promise<Lead | null> {
  const db = getClient();
  if (!db) return null;
  const { data, error } = await (db as Row)
    .from("marta_ig_leads")
    .insert({
      conversation_id: input.conversation_id,
      ig_username: input.ig_username ?? null,
      lead_type: input.lead_type,
      notes: input.notes,
      owner_email: input.owner_email ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markLeadNotified(id: string): Promise<void> {
  const db = getClient();
  if (!db) return;
  await (db as Row)
    .from("marta_ig_leads")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", id);
}

export async function listLeadsByOwner(ownerEmail: string, limit = 50): Promise<Lead[]> {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row)
    .from("marta_ig_leads")
    .select("*")
    .eq("owner_email", ownerEmail)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
