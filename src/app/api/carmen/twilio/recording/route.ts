/**
 * Webhook Twilio: grabación finalizada.
 * Twilio nos manda recording_url + datos llamada.
 * Aquí: transcribimos (Whisper) → clasificamos (Claude) → guardamos → avisamos al dueño.
 */
import { getCarmenProfile, transcribeAudio, analyzeCall, upsertCall, notifyOwner } from "@/lib/carmen";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner");
  if (!owner) return new Response("missing owner", { status: 400 });

  const form = await req.formData();
  const callSid = String(form.get("CallSid") || "");
  const recordingUrl = String(form.get("RecordingUrl") || "");
  const recordingDuration = Number(form.get("RecordingDuration") || 0);
  const callerNumber = String(form.get("From") || "");

  if (!callSid || !recordingUrl) return new Response("missing fields", { status: 400 });

  // Twilio expone .mp3 añadiendo extensión
  const mp3Url = `${recordingUrl}.mp3`;

  const profile = await getCarmenProfile(owner);

  // Transcribir
  const transcript = await transcribeAudio(mp3Url);

  // Analizar con Claude
  const analysis = await analyzeCall({ transcript, caller_number: callerNumber, profile });

  // Guardar
  const call = await upsertCall({
    owner_email: owner,
    twilio_call_sid: callSid,
    caller_number: callerNumber,
    duration_sec: recordingDuration,
    recording_url: mp3Url,
    transcript,
    resumen: analysis.resumen,
    intent: analysis.intent,
    urgencia: analysis.urgencia,
    recall_phone: analysis.recall_phone,
    status: "nueva",
  });

  // Avisar dueño
  if (call) await notifyOwner({ profile, call });

  return new Response("ok", { status: 200 });
}
