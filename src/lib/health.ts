/**
 * Health checks de los servicios externos que usa AI-Team.
 * Si algo está caído, los clientes lo ven en /status.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export type ServiceStatus = {
  name: string;
  key: string;
  status: "operational" | "degraded" | "down" | "unknown";
  latency_ms?: number;
  message?: string;
  last_check: string;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; err?: string; data?: T }> {
  const start = Date.now();
  try {
    const data = await fn();
    return { ok: true, ms: Date.now() - start, data };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, err: e instanceof Error ? e.message : String(e) };
  }
}

export async function checkAnthropic(): Promise<ServiceStatus> {
  const r = await timed(async () => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY || "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 1, messages: [{ role: "user", content: "ok" }] }),
    });
    if (!res.ok && res.status !== 401) throw new Error(`${res.status}`);
    return res.status;
  });
  return { name: "Anthropic Claude", key: "anthropic", status: r.ok ? "operational" : r.ms > 3000 ? "degraded" : "down", latency_ms: r.ms, message: r.err, last_check: new Date().toISOString() };
}

export async function checkOpenAI(): Promise<ServiceStatus> {
  const r = await timed(async () => {
    const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY || "x"}` } });
    if (!res.ok && res.status !== 401) throw new Error(`${res.status}`);
    return res.status;
  });
  return { name: "OpenAI Whisper", key: "openai", status: r.ok ? "operational" : "down", latency_ms: r.ms, message: r.err, last_check: new Date().toISOString() };
}

export async function checkElevenLabs(): Promise<ServiceStatus> {
  const r = await timed(async () => {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "" } });
    if (!res.ok && res.status !== 401) throw new Error(`${res.status}`);
    return res.status;
  });
  return { name: "ElevenLabs (Voz Carmen)", key: "elevenlabs", status: r.ok ? "operational" : "down", latency_ms: r.ms, message: r.err, last_check: new Date().toISOString() };
}

export async function checkTwilio(): Promise<ServiceStatus> {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    return { name: "Twilio (Carmen + Pablo)", key: "twilio", status: "unknown", message: "no configurado", last_check: new Date().toISOString() };
  }
  const r = await timed(async () => {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN || "";
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.status;
  });
  return { name: "Twilio (Carmen + Pablo)", key: "twilio", status: r.ok ? "operational" : "down", latency_ms: r.ms, message: r.err, last_check: new Date().toISOString() };
}

export async function checkResend(): Promise<ServiceStatus> {
  const r = await timed(async () => {
    const res = await fetch("https://api.resend.com/api-keys", { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY || "x"}` } });
    if (!res.ok && res.status !== 401) throw new Error(`${res.status}`);
    return res.status;
  });
  return { name: "Resend (Emails Eva)", key: "resend", status: r.ok ? "operational" : "down", latency_ms: r.ms, message: r.err, last_check: new Date().toISOString() };
}

export async function checkSupabase(): Promise<ServiceStatus> {
  const url = process.env.SUPABASE_URL;
  if (!url) return { name: "Supabase (Base de datos)", key: "supabase", status: "unknown", last_check: new Date().toISOString() };
  const r = await timed(async () => {
    const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: process.env.SUPABASE_SERVICE_KEY || "" } });
    if (!res.ok && res.status !== 404 && res.status !== 401) throw new Error(`${res.status}`);
    return res.status;
  });
  return { name: "Supabase (Base de datos)", key: "supabase", status: r.ok ? "operational" : "down", latency_ms: r.ms, message: r.err, last_check: new Date().toISOString() };
}

export async function checkAll(): Promise<ServiceStatus[]> {
  return Promise.all([
    checkAnthropic(),
    checkOpenAI(),
    checkElevenLabs(),
    checkTwilio(),
    checkResend(),
    checkSupabase(),
  ]);
}

// Persistencia opcional para historial
function getDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key);
}

export async function saveHealthSnapshot(services: ServiceStatus[]) {
  const db = getDb(); if (!db) return;
  try {
    await (db as Row).from("health_snapshots").insert({ services, snapshot_at: new Date().toISOString() });
  } catch { /* tabla puede no existir aún */ }
}
