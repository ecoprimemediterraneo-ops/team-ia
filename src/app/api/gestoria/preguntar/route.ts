// El chat de la portada: una pregunta en lenguaje normal, una respuesta con los
// datos reales del tenant. Ver `gestoria-consulta` para el porqué del diseño.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { preguntar } from "@/lib/gestoria-consulta";
import { ejecutar as ejecutarAccion, type AccionPendiente } from "@/lib/gestoria-acciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const s = await getSessionLocal();
  if (!s) {
    return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar en el panel." }, { status: 401 });
  }
  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return NextResponse.json({ error: "Esto es para gestorías." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    pregunta?: string;
    historial?: Array<{ rol: "usuario" | "secretaria"; texto: string }>;
    /** El "sí" del gestor: la acción que ya se le propuso y ha aprobado. */
    confirmar?: AccionPendiente;
  };

  // CONFIRMACIÓN. Es el único camino por el que se cambian datos desde el chat,
  // y llega con la acción ya resuelta que se propuso antes — no con una frase
  // que haya que volver a interpretar. Reinterpretar un "sí" es cómo se acaba
  // marcando hecho el 303 del cliente equivocado.
  if (body.confirmar) {
    const r = await ejecutarAccion(ctx.tenantId, body.confirmar);
    return NextResponse.json({ ok: r.ok, texto: r.texto, acciones: [], consultas: [], pendiente: null });
  }

  const pregunta = (body.pregunta || "").trim();
  if (!pregunta) return NextResponse.json({ error: "Escribe una pregunta." }, { status: 400 });
  // Tope de largo: una pregunta de gestoría no ocupa dos folios, y sin tope
  // cualquiera puede mandar un libro y pagarlo la gestoría.
  if (pregunta.length > 1000) {
    return NextResponse.json({ error: "La pregunta es demasiado larga. Resúmela." }, { status: 400 });
  }

  const r = await preguntar({
    tenantId: ctx.tenantId,
    gestoria: ctx.tenant?.name || "tu gestoría",
    pregunta,
    historial: body.historial,
  });

  return NextResponse.json({ ok: true, ...r });
}
