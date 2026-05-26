import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getCarmenProfile, updateCarmenProfile, ensureGreetingAudio, VOCES_CARMEN } from "@/lib/carmen";

const schema = z.object({
  nombre_negocio: z.string().max(255).optional(),
  sector: z.string().max(255).optional(),
  saludo: z.string().max(2000).optional(),
  voz_id: z.string().optional(),
  whatsapp_dueno: z.string().max(20).optional(),
  email_dueno: z.string().email().optional().or(z.literal("")),
  horario_negocio: z.string().max(255).optional(),
  max_recording_sec: z.number().min(10).max(120).optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getCarmenProfile(s.email);
  return NextResponse.json({ profile: { ...profile, greeting_audio_base64: !!profile.greeting_audio_base64 }, voces: VOCES_CARMEN });
}

export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const c = schema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  await updateCarmenProfile(s.email, c.data);
  const profile = await getCarmenProfile(s.email);
  // Si cambió saludo o voz, regenerar el MP3 cacheado
  const r = await ensureGreetingAudio(profile);
  return NextResponse.json({ ok: true, regenerated: r.regenerated });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.action === "preview_greeting") {
    const profile = await getCarmenProfile(s.email);
    const r = await ensureGreetingAudio(profile);
    if (!r.audioBase64) return NextResponse.json({ error: "No se pudo generar audio. Verifica ELEVENLABS_API_KEY." }, { status: 500 });
    return NextResponse.json({ audioBase64: r.audioBase64 });
  }
  return NextResponse.json({ error: "action desconocida" }, { status: 400 });
}
