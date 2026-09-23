// El chat fijo del panel de estética: una pregunta en lenguaje normal, una
// respuesta con los datos reales del tenant — y acciones, con el mismo
// mecanismo de confirmación que `/api/dental/preguntar`.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { preguntarEstetica } from "@/lib/estetica-consulta";
import { ejecutar as ejecutarAccion, type AccionPendiente } from "@/lib/estetica-acciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const s = await getSessionLocal();
  if (!s) {
    return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar en el panel." }, { status: 401 });
  }
  const ctx = await contextoPanelODefecto();
  if (ctx.perfil.id !== "estetica") {
    return NextResponse.json({ error: "Esto es para clínicas estéticas." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    pregunta?: string;
    historial?: Array<{ rol: "usuario" | "secretaria"; texto: string }>;
    /** El "sí" de la dueña: la acción que ya se le propuso y ha aprobado. */
    confirmar?: AccionPendiente;
  };

  // CONFIRMACIÓN. Es el único camino por el que se cambian datos desde el
  // chat, y llega con la acción ya resuelta que se propuso antes — no con una
  // frase que haya que volver a interpretar. `ejecutarAccion` comprueba además
  // que el `tenantId` de la acción coincide con el de quien confirma: una
  // propuesta no puede ejecutarse en el panel de otra clínica.
  if (body.confirmar) {
    const r = await ejecutarAccion(ctx.tenantId, body.confirmar);
    return NextResponse.json({ ok: r.ok, texto: r.texto, acciones: [], pendiente: null });
  }

  const pregunta = (body.pregunta || "").trim();
  if (!pregunta) return NextResponse.json({ error: "Escribe una pregunta." }, { status: 400 });
  if (pregunta.length > 1000) {
    return NextResponse.json({ error: "La pregunta es demasiado larga. Resúmela." }, { status: 400 });
  }

  const r = await preguntarEstetica({ tenantId: ctx.tenantId, pregunta, historial: body.historial });
  return NextResponse.json({ ok: true, ...r });
}
