// Carmen lee un guion en voz alta.
//
// LA VOZ YA NO ESTÁ ESCRITA AQUÍ. Estaba: un `.default("nova")` en el esquema de
// abajo, igual para todos los clientes y sin forma de cambiarla que no fuera
// tocar el código. Ahora sale de `carmen-voz.ts`, guardada por cliente, y esta
// ruta solo la usa.
//
// El parámetro `voice` sigue admitiéndose, y sirve para escuchar una voz ANTES
// de guardarla: se prueba sin cambiarle la voz a nadie.
//
// OJO, LA OTRA VOZ: esto es la voz del panel. La de las llamadas de teléfono de
// verdad la pone Retell y se elige en su panel, no aquí.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { openai } from "@/lib/openai";
import { leerVoz, hablarElevenLabs, VOCES_OPENAI, type Proveedor } from "@/lib/carmen-voz";

const schema = z.object({
  text: z.string().min(3).max(3000),
  /** Para escuchar sin guardar. Si no viene, se usa la voz elegida del cliente. */
  voice: z.string().optional(),
  proveedor: z.enum(["openai", "elevenlabs"]).optional(),
});

type VozOpenAI = (typeof VOCES_OPENAI)[number]["id"];

export async function POST(req: Request) {
  try {
    // `requireSessionLocal` y no `requireSession`: en producción son idénticas
    // —la de local solo añade el bypass de desarrollo que ya usa todo el panel—,
    // pero con la estricta esta ruta era IMPOSIBLE de probar en local. Devolvía
    // UNAUTHORIZED siempre, incluso con el panel abierto, así que el botón de
    // escuchar el guion no se había podido comprobar nunca fuera de producción.
    await requireSessionLocal();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    // Limpiar marcadores tipo "Carmen dice:" para que solo lea las partes habladas
    const cleanText = parsed.data.text
      .replace(/^Carmen (dice|pregunta|confirma|escucha):\s*/gim, "")
      .replace(/^\s*[-•*]\s*/gm, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/^#{1,6}\s+/gm, "")
      .trim();
    const texto = cleanText.slice(0, 2500);

    // Qué voz: la que pide la petición para probar, o la que tenga guardada el
    // cliente. Nunca una escrita aquí.
    const ctx = await contextoPanelODefecto();
    const guardada = await leerVoz(ctx.tenantId);
    const proveedor: Proveedor = parsed.data.proveedor ?? (parsed.data.voice ? "openai" : guardada.proveedor);
    const vozId = parsed.data.voice ?? guardada.id;

    // TRAZA. Mismo patrón que `[marta/envio]`: qué voz se ha usado, de quién y
    // si venía de una prueba o de la guardada. Sin esto, "Carmen no suena como
    // la puse" no se puede diagnosticar — el audio no dice qué voz lo hizo.
    console.log(
      `[carmen/voz] tenant=${ctx.tenantId} proveedor=${proveedor} voz=${vozId} ` +
      `origen=${parsed.data.voice ? "prueba" : "guardada"} caracteres=${texto.length}`,
    );

    let buffer: Buffer;
    if (proveedor === "elevenlabs") {
      const r = await hablarElevenLabs(vozId, texto);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
      buffer = Buffer.from(r.audio);
    } else {
      // Se comprueba contra la lista: OpenAI rechaza una voz que no conoce con un
      // error suyo, y este dice qué pasa.
      if (!VOCES_OPENAI.some((v) => v.id === vozId)) {
        return NextResponse.json({ error: `"${vozId}" no es una voz de OpenAI.` }, { status: 400 });
      }
      const audio = await openai.audio.speech.create({
        model: "tts-1",
        voice: vozId as VozOpenAI,
        input: texto,
        response_format: "mp3",
      });
      buffer = Buffer.from(await audio.arrayBuffer());
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
