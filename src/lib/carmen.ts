/**
 * Carmen · Contestador inteligente.
 * Twilio + ElevenLabs (saludo) + Whisper (transcripción) + Claude (clasificación) + WhatsApp (aviso dueño).
 */
import { anthropic, MODELS } from "@/lib/claude";
import crypto from "node:crypto";

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

export type CarmenProfile = {
  owner_email: string;
  nombre_negocio: string;
  sector: string;
  saludo: string;
  voz_id: string;
  greeting_audio_base64: string | null;
  greeting_text_hash: string | null;
  twilio_phone_number: string | null;
  whatsapp_dueno: string | null;
  email_dueno: string | null;
  horario_negocio: string;
  max_recording_sec: number;
  modo_activacion: string;
  updated_at: string;
};

export const VOCES_CARMEN = [
  { id: "EXAVITQu4vr4xnSDxMaL", nombre: "Bella · Femenina cálida" },
  { id: "21m00Tcm4TlvDq8ikWAM", nombre: "Rachel · Femenina profesional" },
  { id: "ErXwobaYiN019PkySvjV", nombre: "Antoni · Masculina cercana" },
  { id: "VR6AewLTigWG4xSOukaG", nombre: "Arnold · Masculina seria" },
];

function defaultProfile(owner_email: string): CarmenProfile {
  return {
    owner_email, nombre_negocio: "", sector: "",
    saludo: "Hola, soy Carmen. Ahora mismo no podemos atenderte. Cuéntame brevemente en qué te puedo ayudar después del tono y te llamamos cuanto antes.",
    voz_id: "EXAVITQu4vr4xnSDxMaL", greeting_audio_base64: null, greeting_text_hash: null,
    twilio_phone_number: null, whatsapp_dueno: null, email_dueno: null,
    horario_negocio: "L-V 9-19, S 10-14", max_recording_sec: 60,
    modo_activacion: "auto", updated_at: new Date().toISOString(),
  };
}

export async function getCarmenProfile(owner_email: string): Promise<CarmenProfile> {
  const db = getClient(); if (!db) return defaultProfile(owner_email);
  const { data } = await (db as Row).from("carmen_profiles").select("*").eq("owner_email", owner_email).maybeSingle();
  if (!data) {
    const def = defaultProfile(owner_email);
    await (db as Row).from("carmen_profiles").insert(def);
    return def;
  }
  return { ...defaultProfile(owner_email), ...data };
}

export async function updateCarmenProfile(owner_email: string, patch: Partial<CarmenProfile>) {
  const db = getClient(); if (!db) return null;
  await getCarmenProfile(owner_email); // ensure exists
  const { data } = await (db as Row).from("carmen_profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("owner_email", owner_email).select().single();
  return data;
}

// Pre-genera el MP3 con ElevenLabs y lo cachea en base64 dentro del perfil
export async function ensureGreetingAudio(profile: CarmenProfile): Promise<{ audioBase64: string | null; regenerated: boolean }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { audioBase64: profile.greeting_audio_base64, regenerated: false };

  const hash = crypto.createHash("sha256").update(`${profile.voz_id}|${profile.saludo}`).digest("hex");
  if (profile.greeting_text_hash === hash && profile.greeting_audio_base64) {
    return { audioBase64: profile.greeting_audio_base64, regenerated: false };
  }

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${profile.voz_id}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: profile.saludo,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true },
      }),
    });
    if (!res.ok) return { audioBase64: profile.greeting_audio_base64, regenerated: false };
    const buf = await res.arrayBuffer();
    const audioBase64 = Buffer.from(buf).toString("base64");
    await updateCarmenProfile(profile.owner_email, { greeting_audio_base64: audioBase64, greeting_text_hash: hash });
    return { audioBase64, regenerated: true };
  } catch (e) {
    console.error("[carmen-greeting]", e);
    return { audioBase64: profile.greeting_audio_base64, regenerated: false };
  }
}

// ===== Clasificación + resumen llamada =====
export type CallAnalysis = {
  resumen: string;
  intent: "cita" | "consulta" | "queja" | "urgencia" | "informacion" | "spam" | "otro";
  urgencia: "urgente" | "alta" | "normal" | "spam";
  recall_phone: string | null;
};

export async function analyzeCall(input: { transcript: string; caller_number?: string; profile: CarmenProfile }): Promise<CallAnalysis> {
  const fallback: CallAnalysis = { resumen: input.transcript.slice(0, 300), intent: "otro", urgencia: "normal", recall_phone: input.caller_number || null };
  try {
    const c = await anthropic.messages.create({
      model: MODELS.fast, max_tokens: 500, temperature: 0.2,
      system: `Eres Carmen, analista de llamadas perdidas. Recibes la transcripción del mensaje que dejó el cliente y devuelves JSON estricto:
{
  "resumen": "<2-3 frases ejecutivas claras>",
  "intent": "cita|consulta|queja|urgencia|informacion|spam|otro",
  "urgencia": "urgente|alta|normal|spam",
  "recall_phone": "<número si lo menciona o null>"
}
Reglas:
- "urgente" = palabras de dolor agudo / emergencia / sangrado / accidente / muy enfadado
- "alta" = quiere cita esta semana / ya / mañana
- "normal" = consulta info, cita futura, pregunta general
- "spam" = silencio, ruido, audio cortado, sin contenido útil
- Sé conciso. No inventes.`,
      messages: [{ role: "user", content: `Negocio: ${input.profile.nombre_negocio || "sin definir"} (${input.profile.sector || "sin sector"}).\nNúmero llamante: ${input.caller_number || "desconocido"}.\nTranscripción:\n"""${input.transcript}"""\n\nDevuelve JSON.` }],
    });
    const block = c.content[0]; const text = block && block.type === "text" ? block.text.trim() : "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return fallback;
    const parsed = JSON.parse(m[0]);
    return {
      resumen: parsed.resumen || fallback.resumen,
      intent: parsed.intent || "otro",
      urgencia: parsed.urgencia || "normal",
      recall_phone: parsed.recall_phone || input.caller_number || null,
    };
  } catch (e) { console.error("[carmen-analyze]", e); return fallback; }
}

// ===== Whisper transcripción =====
export async function transcribeAudio(audioUrl: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[carmen-whisper] no OPENAI_API_KEY, returning placeholder");
    return "[transcripción no disponible: falta OPENAI_API_KEY]";
  }
  try {
    const audioRes = await fetch(audioUrl, {
      headers: process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
        ? { Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}` }
        : {},
    });
    if (!audioRes.ok) throw new Error(`Audio fetch ${audioRes.status}`);
    const audioBuffer = await audioRes.arrayBuffer();

    const form = new FormData();
    form.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), "recording.mp3");
    form.append("model", "whisper-1");
    form.append("language", "es");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) { const t = await res.text(); console.error("[whisper]", res.status, t.slice(0, 200)); return "[transcripción falló]"; }
    const j = await res.json();
    return j.text || "";
  } catch (e) {
    console.error("[carmen-whisper]", e);
    return "[transcripción falló]";
  }
}

// ===== Llamadas (CRUD) =====
export async function listCalls(owner_email: string, status?: string) {
  const db = getClient(); if (!db) return [];
  let q = (db as Row).from("carmen_calls").select("*").eq("owner_email", owner_email);
  if (status) q = q.eq("status", status);
  const { data } = await q.order("created_at", { ascending: false }).limit(200);
  return data ?? [];
}

export async function getCallBySid(owner_email: string, twilio_call_sid: string) {
  const db = getClient(); if (!db) return null;
  const { data } = await (db as Row).from("carmen_calls").select("*").eq("owner_email", owner_email).eq("twilio_call_sid", twilio_call_sid).maybeSingle();
  return data;
}

export async function upsertCall(input: Row) {
  const db = getClient(); if (!db) return null;
  const { data } = await (db as Row).from("carmen_calls").upsert(input, { onConflict: "twilio_call_sid" }).select().single();
  return data;
}

export async function updateCallStatus(id: string, owner_email: string, status: string, notas?: string) {
  const db = getClient(); if (!db) return;
  await (db as Row).from("carmen_calls").update({ status, notas: notas ?? null, resolved_at: status === "resuelta" ? new Date().toISOString() : null }).eq("id", id).eq("owner_email", owner_email);
}

// ===== Aviso al dueño (WhatsApp o email) =====
export async function notifyOwner(input: { profile: CarmenProfile; call: Row }) {
  const txt = `🔔 Carmen · llamada perdida ${input.call.urgencia === "urgente" ? "🚨 URGENTE" : ""}
De: ${input.call.caller_number || "desconocido"}
${input.call.duration_sec ? `Duración: ${input.call.duration_sec}s\n` : ""}
${input.call.resumen}

${input.call.recall_phone ? `Devolver llamada: ${input.call.recall_phone}\n` : ""}---
Transcripción: ${(input.call.transcript || "").slice(0, 400)}`;

  // WhatsApp via Twilio API (si configurado)
  const wa = input.profile.whatsapp_dueno;
  if (wa && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const form = new URLSearchParams();
      form.append("From", process.env.TWILIO_WHATSAPP_FROM);
      form.append("To", `whatsapp:${wa}`);
      form.append("Body", txt);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      if (res.ok) {
        await upsertCall({ id: input.call.id, owner_email: input.call.owner_email, whatsapp_sent: true });
        return { whatsapp: true };
      }
    } catch (e) { console.error("[carmen-wa]", e); }
  }

  // Fallback email vía Resend
  const emailDueno = input.profile.email_dueno || input.profile.owner_email;
  if (emailDueno && process.env.RESEND_API_KEY) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getResend, RESEND_FROM } = require("./resend");
      const resend = getResend();
      await resend.emails.send({
        from: RESEND_FROM, to: emailDueno,
        subject: `🔔 Carmen · llamada ${input.call.urgencia === "urgente" ? "URGENTE" : "perdida"} de ${input.call.caller_number || "desconocido"}`,
        text: txt,
      });
      await upsertCall({ id: input.call.id, owner_email: input.call.owner_email, email_sent: true });
      return { email: true };
    } catch (e) { console.error("[carmen-email]", e); }
  }
  return { whatsapp: false, email: false };
}
