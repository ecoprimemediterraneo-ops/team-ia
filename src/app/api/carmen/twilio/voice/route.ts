/**
 * Webhook Twilio: llamada entrante.
 * Twilio llama aquí cuando suena el número configurado para un cliente.
 * Devolvemos TwiML que: (1) reproduce el saludo Carmen, (2) graba el mensaje.
 *
 * El número Twilio debe asociarse al owner_email del cliente vía carmen_profiles.twilio_phone_number.
 */
import { getCarmenProfile, ensureGreetingAudio } from "@/lib/carmen";

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

async function findOwnerByCalledNumber(called: string): Promise<string | null> {
  const db = getDb(); if (!db) return null;
  const { data } = await (db as Row).from("carmen_profiles").select("owner_email").eq("twilio_phone_number", called).maybeSingle();
  return data?.owner_email ?? null;
}

function twimlError(msg: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-ES">${msg}</Say><Hangup/></Response>`;
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const called = String(form.get("To") || "");
  const owner_email = await findOwnerByCalledNumber(called);
  if (!owner_email) return twimlError("Número no asignado. Vuelve a llamar más tarde.");

  const profile = await getCarmenProfile(owner_email);
  await ensureGreetingAudio(profile); // genera/recupera MP3 si no existe

  // El audio se sirve desde nuestro endpoint /api/carmen/greeting/[owner].mp3
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;
  const greetingUrl = `${base}/api/carmen/greeting/${encodeURIComponent(owner_email)}.mp3`;
  const recordingUrl = `${base}/api/carmen/twilio/recording?owner=${encodeURIComponent(owner_email)}`;

  const maxSec = profile.max_recording_sec || 60;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${greetingUrl}</Play>
  <Record maxLength="${maxSec}" playBeep="true" trim="trim-silence" action="${recordingUrl}" method="POST" recordingStatusCallback="${recordingUrl}" />
  <Say language="es-ES">No se ha grabado nada. Hasta luego.</Say>
</Response>`;
  return new Response(twiml, { status: 200, headers: { "Content-Type": "text/xml" } });
}
