/**
 * GET /api/marta/conversations — lista conversaciones IG del cliente autenticado.
 * Devuelve conversaciones con el último mensaje + intent + estado.
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

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getClient();
  if (!db) {
    return NextResponse.json({ conversations: [], note: "supabase_not_configured" });
  }

  // Conversaciones del owner + último mensaje (subquery)
  const { data: conversations } = await (db as Row)
    .from("marta_ig_conversations")
    .select(`
      id, ig_username, ig_user_id, status, intent_last, created_at, updated_at,
      marta_ig_messages (
        id, direction, message_type, content, intent, confidence, created_at, responded_by
      )
    `)
    .eq("owner_email", s.email)
    .order("updated_at", { ascending: false })
    .limit(50);

  // Reducir: solo dejar el último mensaje de cada conversación
  const compact = (conversations ?? []).map((c: Row) => {
    const msgs = (c.marta_ig_messages || []).sort(
      (a: Row, b: Row) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return {
      id: c.id,
      ig_username: c.ig_username,
      ig_user_id: c.ig_user_id,
      status: c.status,
      intent_last: c.intent_last,
      updated_at: c.updated_at,
      message_count: msgs.length,
      last_message: msgs[0]
        ? {
            direction: msgs[0].direction,
            content: msgs[0].content,
            intent: msgs[0].intent,
            confidence: msgs[0].confidence,
            created_at: msgs[0].created_at,
          }
        : null,
    };
  });

  return NextResponse.json({ conversations: compact });
}
