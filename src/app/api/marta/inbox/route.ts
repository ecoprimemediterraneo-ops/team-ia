/**
 * GET /api/marta/inbox?filter=dm|comment|mention|lead|all
 * Bandeja unificada de TODA la actividad Instagram de Marta:
 * - DMs (conversaciones con su último mensaje)
 * - Comentarios (mismo, type=comment)
 * - Menciones en stories (type=mention)
 * - Leads cualificados detectados
 *
 * Devuelve una lista única ordenada por fecha desc con tipo + preview.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

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

export type InboxItemType = "dm" | "comment" | "mention" | "lead";

export type InboxItem = {
  kind: InboxItemType;
  id: string;
  who: string;
  preview: string;
  intent: string | null;
  confidence: number | null;
  status: string;
  created_at: string;
  conversation_id: string | null;
};

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = (searchParams.get("filter") || "all") as InboxItemType | "all";

  const db = getClient();
  if (!db) return NextResponse.json({ items: [], note: "supabase_not_configured" });

  // ─── DMs / comments / mentions desde conversations + último mensaje ──────
  const items: InboxItem[] = [];

  if (filter === "all" || filter === "dm" || filter === "comment" || filter === "mention") {
    const { data: convs } = await (db as Row)
      .from("marta_ig_conversations")
      .select(`
        id, ig_username, ig_user_id, status, intent_last, updated_at,
        marta_ig_messages (direction, message_type, content, intent, confidence, created_at)
      `)
      .eq("owner_email", s.email)
      .order("updated_at", { ascending: false })
      .limit(100);

    for (const c of (convs ?? []) as Row[]) {
      const msgs = (c.marta_ig_messages || []).sort(
        (a: Row, b: Row) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const last = msgs[0];
      if (!last) continue;

      const kind: InboxItemType =
        last.message_type === "comment" ? "comment" :
        last.message_type === "mention" ? "mention" : "dm";

      if (filter !== "all" && filter !== kind) continue;

      items.push({
        kind,
        id: c.id,
        who: c.ig_username || c.ig_user_id.slice(0, 12),
        preview: (last.content || "").slice(0, 200),
        intent: last.intent || c.intent_last,
        confidence: last.confidence,
        status: c.status,
        created_at: c.updated_at,
        conversation_id: c.id,
      });
    }
  }

  // ─── Leads ──────────────────────────────────────────────────────────────
  if (filter === "all" || filter === "lead") {
    const { data: leads } = await (db as Row)
      .from("marta_ig_leads")
      .select("id, ig_username, lead_type, notes, conversation_id, created_at, notified_at")
      .eq("owner_email", s.email)
      .order("created_at", { ascending: false })
      .limit(50);

    for (const l of (leads ?? []) as Row[]) {
      items.push({
        kind: "lead",
        id: l.id,
        who: l.ig_username || "(sin username)",
        preview: l.notes || "",
        intent: l.lead_type,
        confidence: null,
        status: l.notified_at ? "avisado" : "pendiente",
        created_at: l.created_at,
        conversation_id: l.conversation_id,
      });
    }
  }

  // Ordenar global por fecha desc
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Stats agregadas
  const counts = {
    total: items.length,
    dm: items.filter((i) => i.kind === "dm").length,
    comment: items.filter((i) => i.kind === "comment").length,
    mention: items.filter((i) => i.kind === "mention").length,
    lead: items.filter((i) => i.kind === "lead").length,
    escalated: items.filter((i) => i.status === "escalated").length,
  };

  return NextResponse.json({ items: items.slice(0, 100), counts });
}
