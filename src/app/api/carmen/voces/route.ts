// Las voces que puede usar Carmen, y cuál tiene elegida este cliente.
//
//   GET   devuelve la lista (OpenAI siempre; ElevenLabs si hay clave) y la voz
//         elegida hoy.
//   POST  guarda la elección. {proveedor, id}.
//
// Se valida contra la lista de verdad antes de guardar: sin eso, cualquiera con
// sesión podría dejar apuntada una voz que no existe, y el fallo no aparecería
// hasta que alguien pulsara "escuchar" tres semanas después.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { leerVoz, guardarVoz, vocesDisponibles, VOZ_POR_DEFECTO, elevenLabsActivo } from "@/lib/carmen-voz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ error: "Tu sesión ha caducado." }, { status: 401 });
  const ctx = await contextoPanelODefecto();

  const { voces, avisoElevenLabs } = await vocesDisponibles();
  const elegida = await leerVoz(ctx.tenantId);
  return NextResponse.json({
    ok: true,
    voces,
    elegida,
    porDefecto: VOZ_POR_DEFECTO,
    elevenlabs: elevenLabsActivo(),
    ...(avisoElevenLabs ? { avisoElevenLabs } : {}),
  });
}

export async function POST(req: Request) {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ error: "Tu sesión ha caducado." }, { status: 401 });
  const ctx = await contextoPanelODefecto();

  const body = (await req.json().catch(() => ({}))) as { proveedor?: string; id?: string };
  const { voces } = await vocesDisponibles();
  const existe = voces.find((v) => v.proveedor === body.proveedor && v.id === body.id);
  if (!existe) {
    return NextResponse.json({ error: "Esa voz no está en la lista de voces disponibles." }, { status: 400 });
  }

  await guardarVoz(ctx.tenantId, { proveedor: existe.proveedor, id: existe.id });
  return NextResponse.json({ ok: true, elegida: { proveedor: existe.proveedor, id: existe.id }, nombre: existe.nombre });
}
