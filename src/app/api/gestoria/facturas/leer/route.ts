// Volver a leer documentos que no se leyeron.
//
// Para dos casos, y los dos son el mismo problema visto desde sitios distintos:
//   - la lectura falló y el gestor le da a "reintentar";
//   - el documento entró ANTES de que esto se leyera solo y sigue en blanco.
//
// No hay un segundo camino de lectura: esto llama al mismo `releerDocumento`
// que usa todo lo demás. Dos formas de leer acaban dando dos resultados.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { listarFacturas, releerDocumento, asignarPorDatoDuro } from "@/lib/gestoria-facturas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Cuántos se releen de una tacada. Más que esto y la petición se hace eterna. */
const TOPE_POR_TANDA = 10;

async function guardia() {
  const s = await getSessionLocal();
  if (!s) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar en el panel." }, { status: 401 }),
    };
  }
  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return { ok: false as const, res: NextResponse.json({ error: "Esto es para gestorías." }, { status: 403 }) };
  }
  return { ok: true as const, tenantId: ctx.tenantId };
}

export async function POST(req: Request) {
  const g = await guardia();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => ({}))) as { id?: string; pendientes?: boolean };

  // Un documento concreto: el botón de reintentar.
  if (body.id) {
    const r = await releerDocumento(g.tenantId, body.id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 200 });
    return NextResponse.json({ ok: true, leidos: 1, factura: r.factura });
  }

  // Todos los que se quedaron atrás. Se cogen los que NO tienen lectura buena:
  // sin lectura, con error, o marcados como leyendo hace rato (una lectura que
  // se quedó a medias no se desbloquea sola).
  if (body.pendientes) {
    const todas = await listarFacturas(g.tenantId);
    const pendientes = todas
      .filter((f) => !f.lectura && f.estado !== "descartada")
      .slice(0, TOPE_POR_TANDA);

    let leidos = 0;
    const fallos: string[] = [];
    for (const f of pendientes) {
      const r = await releerDocumento(g.tenantId, f.id);
      if (r.ok) leidos++;
      else fallos.push(`${f.nombre_original}: ${r.error}`);
    }
    // Y AHORA, COLOCARLOS. Va aparte de la lectura y siempre, no solo sobre lo
    // que se acaba de leer: hay documentos que ya estaban leídos desde antes y
    // que se quedaron sin dueño porque entonces la asignación automática no
    // existía, o porque su cliente no tenía NIF todavía y ahora sí. Esto no
    // gasta IA —solo compara datos duros— así que se puede pasar por todos.
    const sinDueno = (await listarFacturas(g.tenantId)).filter(
      (f) => !f.cliente_id && f.estado !== "descartada",
    );
    let colocados = 0;
    let conflictos = 0;
    for (const f of sinDueno) {
      const r = await asignarPorDatoDuro(g.tenantId, f.id).catch(() => null);
      if (r?.cliente_id) colocados++;
      else if (r?.conflicto) conflictos++;
    }

    const todosLosPendientes = (await listarFacturas(g.tenantId)).filter(
      (f) => !f.lectura && f.estado !== "descartada",
    ).length;
    return NextResponse.json({
      ok: true,
      leidos,
      colocados,
      conflictos,
      fallos,
      // Se dice cuántos quedan: un tope silencioso parece "ya está todo".
      quedan: Math.max(0, todosLosPendientes),
    });
  }

  return NextResponse.json({ error: "Dime qué documento leer." }, { status: 400 });
}
