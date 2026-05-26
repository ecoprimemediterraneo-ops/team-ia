/**
 * Marta · Voz narrada para stories/reels con ElevenLabs.
 * Si no hay ELEVENLABS_API_KEY → devuelve error claro al cliente.
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

// Voces ElevenLabs en español de España (curado)
export const VOCES_ES = [
  { id: "EXAVITQu4vr4xnSDxMaL", nombre: "Bella · Femenina cálida" },
  { id: "21m00Tcm4TlvDq8ikWAM", nombre: "Rachel · Femenina profesional" },
  { id: "ErXwobaYiN019PkySvjV", nombre: "Antoni · Masculina cercana" },
  { id: "VR6AewLTigWG4xSOukaG", nombre: "Arnold · Masculina seria" },
];

export async function generateVoiceOver(input: {
  owner_email: string;
  script: string;
  voiceId?: string;
}): Promise<{ audioBase64: string; voiceName: string; chars: number } | { error: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { error: "Falta ELEVENLABS_API_KEY en el servidor. Avisa al equipo de AI-Team." };

  const voice = VOCES_ES.find((v) => v.id === input.voiceId) || VOCES_ES[0];
  const script = input.script.trim().slice(0, 1500); // límite seguridad

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[elevenlabs]", res.status, t.slice(0, 200));
      return { error: `ElevenLabs ${res.status}` };
    }
    const buf = await res.arrayBuffer();
    const audioBase64 = Buffer.from(buf).toString("base64");

    const db = getClient();
    if (db) {
      await (db as Row).from("marta_voice_overs").insert({
        owner_email: input.owner_email,
        script,
        voice_id: voice.id,
        voice_name: voice.nombre,
        audio_format: "mp3",
        caracteres_usados: script.length,
      });
    }

    return { audioBase64, voiceName: voice.nombre, chars: script.length };
  } catch (e) {
    console.error("[marta-voice]", e);
    return { error: "Error generando audio" };
  }
}

export async function listVoiceOvers(owner_email: string) {
  const db = getClient();
  if (!db) return [];
  const { data } = await (db as Row).from("marta_voice_overs").select("id, script, voice_name, caracteres_usados, created_at").eq("owner_email", owner_email).order("created_at", { ascending: false }).limit(20);
  return data ?? [];
}
