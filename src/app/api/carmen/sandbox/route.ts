/**
 * Carmen sandbox: simula una llamada con texto.
 * Cliente envía "lo que el llamante diría" → ejecuta toda la pipeline (clasificación + resumen).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { analyzeCall, getCarmenProfile } from "@/lib/carmen";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function getDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key);
}

const schema = z.object({ message: z.string().min(5).max(2000), caller_number: z.string().optional() });

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ items: [] });
  const { data } = await (db as Row).from("carmen_sandbox").select("*").eq("owner_email", s.email).order("created_at", { ascending: false }).limit(20);
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "carmen-sand", ip: getClientIp(req), limit: 15, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });
  const body = await req.json();
  const c = schema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });

  const profile = await getCarmenProfile(s.email);
  const analysis = await analyzeCall({ transcript: c.data.message, caller_number: c.data.caller_number, profile });
  const whatsappSim = `🔔 Carmen · llamada perdida ${analysis.urgencia === "urgente" ? "🚨 URGENTE" : ""}
De: ${c.data.caller_number || "desconocido"}

${analysis.resumen}

${analysis.recall_phone ? `Devolver llamada: ${analysis.recall_phone}` : ""}`;

  const db = getDb();
  if (db) {
    await (db as Row).from("carmen_sandbox").insert({
      owner_email: s.email,
      user_message: c.data.message,
      resumen_generado: analysis.resumen,
      intent_detectado: analysis.intent,
      urgencia_detectada: analysis.urgencia,
      whatsapp_simulado: whatsappSim,
    });
  }
  return NextResponse.json({ analysis, whatsapp_simulado: whatsappSim });
}
