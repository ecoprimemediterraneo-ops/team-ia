/**
 * Sirve el MP3 del saludo de Carmen para que Twilio lo reproduzca.
 * URL: /api/carmen/greeting/{owner_email}.mp3
 * Acceso público (Twilio lo invoca sin auth).
 */
import { getCarmenProfile, ensureGreetingAudio } from "@/lib/carmen";

export async function GET(_req: Request, { params }: { params: Promise<{ owner: string }> }) {
  const { owner: ownerParam } = await params;
  const owner = decodeURIComponent(ownerParam.replace(/\.mp3$/, ""));
  if (!owner.includes("@")) return new Response("invalid owner", { status: 400 });

  const profile = await getCarmenProfile(owner);
  const r = await ensureGreetingAudio(profile);
  if (!r.audioBase64) return new Response("greeting not available", { status: 404 });

  const buf = Buffer.from(r.audioBase64, "base64");
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=86400",
    },
  });
}
