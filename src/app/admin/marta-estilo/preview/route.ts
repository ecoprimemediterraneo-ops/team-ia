// Devuelve la imagen de ejemplo procesada con el preset o estilo IA solicitado.
// Solo accesible para el fundador.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { applyStyle } from "@/lib/image-style";
import { STYLE_PRESETS, AI_STYLES, type StylePreset, type AIStyle } from "@/lib/image-style-presets";
import { transformWithAI } from "@/lib/image-style-ai";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
const SAMPLE = "https://picsum.photos/seed/marta/1080/1080";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com")) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const aiParam = searchParams.get("ai") as AIStyle | null;
  const presetParam = (searchParams.get("preset") || "natural") as StylePreset;
  const preset = STYLE_PRESETS.find((p) => p.id === presetParam)?.id || "natural";
  const logoUrl = searchParams.get("logo") || undefined;

  let sample: Buffer;
  try {
    const r = await fetch(SAMPLE, { cache: "no-store" });
    if (!r.ok) throw new Error(`sample ${r.status}`);
    sample = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    return new NextResponse(`sample fetch failed: ${(e as Error).message}`, { status: 502 });
  }

  // Si se pide estilo IA, primero transforma con Gemini.
  let input = sample;
  if (aiParam && AI_STYLES.find((a) => a.id === aiParam)) {
    const ai = await transformWithAI(sample, aiParam);
    if (!ai.ok) {
      return new NextResponse(`AI ${ai.reason}: ${ai.detail}`, { status: 502 });
    }
    input = ai.image;
  }

  try {
    const out = await applyStyle(input, { preset, logoUrl });
    return new NextResponse(new Uint8Array(out), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new NextResponse(`process failed: ${(e as Error).message}`, { status: 500 });
  }
}
