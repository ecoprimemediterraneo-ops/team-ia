// Endpoint de prueba de los estilos de imagen.
// Por seguridad, solo accesible para el fundador (sesión).
//
// GET /api/admin/estilos-test?style=natural|calido|vivido|luminoso|comic|editorial
//   → devuelve la imagen test (1080x1080 JPG) con ese estilo aplicado.
//
// La imagen base es una URL pública por defecto (configurable con
// ESTILOS_TEST_BASE_URL en env). El resultado se devuelve como image/jpeg
// para poder mostrarlo directo en <img>.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { applyStyle } from "@/lib/image-style";
import { transformWithAI } from "@/lib/image-style-ai";
import type { AIStyle, StylePreset } from "@/lib/image-style-presets";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
const DEFAULT_BASE = "https://picsum.photos/seed/aiteam-test/1200/1200.jpg";

export const dynamic = "force-dynamic";

async function fetchBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`fetch base ${url} -> ${r.status}`);
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return new NextResponse("forbidden", { status: 403 });
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") {
    return new NextResponse("forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const style = (url.searchParams.get("style") || "").toLowerCase();
  const baseUrl = process.env.ESTILOS_TEST_BASE_URL || DEFAULT_BASE;

  const PRESETS: StylePreset[] = ["natural", "calido", "vivido", "luminoso"];
  const AI: AIStyle[] = ["comic", "editorial"];

  try {
    const baseBuf = await fetchBuffer(baseUrl);

    if (PRESETS.includes(style as StylePreset)) {
      const out = await applyStyle(baseBuf, { preset: style as StylePreset });
      return new NextResponse(out as unknown as BodyInit, {
        status: 200,
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
      });
    }

    if (AI.includes(style as AIStyle)) {
      const ai = await transformWithAI(baseBuf, style as AIStyle);
      if (!ai.ok) {
        return NextResponse.json(
          { ok: false, reason: ai.reason, detail: ai.detail },
          { status: 502 },
        );
      }
      return new NextResponse(ai.image as unknown as BodyInit, {
        status: 200,
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json({ ok: false, error: `Estilo desconocido: ${style}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
