// /api/admin/marta-probar-comentario — founder-only. Dispara el camino
// comentario→DM SIN tener que ir a Instagram a comentar a mano.
//
// Existe porque el fallo que había (la respuesta pública en el hilo no salía y
// el DM sí) solo se podía reproducir comentando de verdad en un post, y lo único
// que quedaba de la llamada a Meta era una línea de console.log que no decía si
// había ido bien. Ahora el resultado de cada paso —incluido el status HTTP y el
// error de Meta con su fbtrace_id— vuelve en el JSON de la respuesta.
//
// TRES MODOS, de menos a más invasivo:
//
//   1. GET  ?texto=QUIERO                      → SECO. Resuelve reglas y dice qué
//      haría. No llama a Meta. Enseña TODAS las reglas que casan, en orden: si
//      hay dos, la primera es la que manda y las demás no pintan nada.
//
//   2. GET  ?texto=QUIERO&commentId=<id real>&real=1
//      → REAL sobre un comentario que existe: manda el DM y, si la regla lo
//        pide, la respuesta pública. Es el camino entero, el mismo que corre el
//        webhook. Necesita un commentId de verdad; Meta no acepta inventados.
//
//   3. GET  ?commentId=<id real>&soloPublica=1&texto=Hola
//      → SOLO la respuesta pública, sin reglas y sin DM. Para aislar el problema
//        del endpoint /{comment-id}/replies cuando lo demás ya funciona.
//
// El modo real está detrás de `real=1` a propósito: un GET de diagnóstico no
// puede escribir en el Instagram de nadie por accidente.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { procesarComentario, TEXTO_PUBLICO_POR_DEFECTO } from "@/lib/marta-comment-flow";
import { getCommentRules, isCommentDmEnabled } from "@/lib/marta-comment-rules";
import { replyToComment } from "@/lib/marta-graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const a = await requireFounder();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const url = new URL(req.url);
  const texto = url.searchParams.get("texto") || "QUIERO";
  const real = url.searchParams.get("real") === "1";
  const soloPublica = url.searchParams.get("soloPublica") === "1";
  const mediaId = url.searchParams.get("mediaId") || undefined;
  const username = url.searchParams.get("username") || "usuario_de_prueba";
  // Sin commentId real, se usa uno sintético: vale para el modo seco, y en modo
  // real Meta lo rechazará con un error claro (que es justo lo que se quiere ver).
  const commentId = url.searchParams.get("commentId") || `test_${Date.now()}`;

  const ctx = await contextoPanelODefecto();
  const tenantId = ctx.tenantId;

  // Modo 3: solo la respuesta pública, sin pasar por reglas.
  if (soloPublica) {
    if (!real) {
      return NextResponse.json({
        ok: false,
        modo: "solo_publica",
        error: "Este modo escribe en Instagram: añade &real=1 para ejecutarlo de verdad.",
      });
    }
    const res = await replyToComment(commentId, texto || TEXTO_PUBLICO_POR_DEFECTO);
    return NextResponse.json({
      ok: res.ok,
      modo: "solo_publica",
      commentId,
      texto,
      resultado: res,
      queMirar: res.ok
        ? `Funcionó vía ${res.gano}. Ese es el camino bueno para esta cuenta.`
        : "Mira `intentos`: cada uno trae status HTTP, código de Meta y fbtrace_id.",
    });
  }

  const reglas = await getCommentRules(tenantId);
  const envioEncendido = isCommentDmEnabled(tenantId);

  const res = await procesarComentario(
    tenantId,
    process.env.INSTAGRAM_USER_ID,
    { commentId, text: texto, fromId: `probe_${username}`, username, mediaId },
    // En seco no se toca Meta. En real se salta el dedup para poder repetir la
    // prueba con el mismo comentario tantas veces como haga falta.
    { simular: !real, saltarDedup: true },
  );

  return NextResponse.json({
    ok: res.ok,
    modo: real ? "real" : "seco",
    tenantId,
    envioEncendido,
    reglasTotales: reglas.length,
    comentario: { commentId, texto, mediaId, username },
    resultado: res,
    queMirar: [
      res.reglasQueCasan && res.reglasQueCasan.length > 1
        ? `OJO: ${res.reglasQueCasan.length} reglas casan. Manda la primera (${res.reglasQueCasan[0].id}, replyPublic=${res.reglasQueCasan[0].replyPublic}); las demás no se aplican.`
        : null,
      res.publica?.pedida === false
        ? "La regla que gana NO pide respuesta pública (replyPublic=false)."
        : null,
      res.publica?.resultado && !res.publica.resultado.ok
        ? "Meta rechazó la respuesta pública: mira resultado.publica.resultado.intentos."
        : null,
      !real ? "Modo seco: no se ha llamado a Meta. Añade &real=1 y un &commentId= real." : null,
    ].filter(Boolean),
  });
}
