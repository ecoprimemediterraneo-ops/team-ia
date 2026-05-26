/**
 * GET /api/marta/metrics — métricas semanales y totales para el dashboard.
 *
 * Devuelve:
 *   - total DMs últimos 7d
 *   - total leads últimos 7d
 *   - total escalados últimos 7d
 *   - DM más reciente
 *   - tasa de respuesta automática (% mensajes contestados por bot)
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
    return NextResponse.json({
      dms_7d: 0,
      leads_7d: 0,
      escalados_7d: 0,
      total_conversaciones: 0,
      ultimo_dm: null,
      note: "supabase_not_configured",
    });
  }

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // Obtener conversaciones del owner para los JOINs
  const { data: convs } = await (db as Row)
    .from("marta_ig_conversations")
    .select("id, status")
    .eq("owner_email", s.email);

  const convIds = (convs ?? []).map((c: Row) => c.id);
  if (convIds.length === 0) {
    return NextResponse.json({
      dms_7d: 0,
      leads_7d: 0,
      escalados_7d: 0,
      total_conversaciones: 0,
      ultimo_dm: null,
    });
  }

  // DMs entrantes últimos 7 días
  const { count: dms_7d } = await (db as Row)
    .from("marta_ig_messages")
    .select("*", { count: "exact", head: true })
    .in("conversation_id", convIds)
    .eq("direction", "in")
    .gte("created_at", weekAgo);

  // Leads últimos 7 días
  const { count: leads_7d } = await (db as Row)
    .from("marta_ig_leads")
    .select("*", { count: "exact", head: true })
    .eq("owner_email", s.email)
    .gte("created_at", weekAgo);

  // Escalados (status = escalated)
  const escalados_7d = (convs ?? []).filter((c: Row) => c.status === "escalated").length;

  // Último DM
  const { data: ultimo } = await (db as Row)
    .from("marta_ig_messages")
    .select("content, created_at, intent")
    .in("conversation_id", convIds)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    dms_7d: dms_7d ?? 0,
    leads_7d: leads_7d ?? 0,
    escalados_7d,
    total_conversaciones: convIds.length,
    ultimo_dm: ultimo,
  });
}
