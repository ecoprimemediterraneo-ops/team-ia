// Las decisiones de Jose sobre un cargo concreto.
//
// Tres cosas distintas que comparten ruta porque comparten dato —el movimiento—
// y las tres son un clic suyo, nunca automáticas:
//
//   · motivo      : por qué quita un cargo de la reclamación (ver MotivoNoReclamar).
//   · sugerencia  : acepta o rechaza el emparejamiento que le propone el cruce.
//
// El motivo importa medirlo: "no corresponde" es el ÚNICO que señala un fallo
// del cruce. "La tengo yo" solo dice que la factura aún no estaba subida, y
// "ahora no se la pido" no dice nada del sistema.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import {
  listarMovimientos, guardarMovimientos, listarFacturas, guardarFacturas,
  type MotivoNoReclamar,
} from "@/lib/gestoria-facturas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOTIVOS: MotivoNoReclamar[] = ["la_tengo", "no_corresponde", "ahora_no"];

export async function POST(req: Request) {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar en el panel." }, { status: 401 });
  const ctx = await contextoPanelODefecto();

  const body = (await req.json().catch(() => ({}))) as {
    movimientoId?: string;
    motivo?: string;
    aceptar?: string[];   // ids de factura que SÍ justifican el cargo
    rechazar?: string[];  // ids de factura que NO
  };
  if (!body.movimientoId) return NextResponse.json({ error: "falta movimientoId" }, { status: 400 });

  const movs = await listarMovimientos(ctx.tenantId);
  const mov = movs.find((m) => m.id === body.movimientoId);
  if (!mov) return NextResponse.json({ error: "no encontrado" }, { status: 404 });

  const ahora = new Date().toISOString();
  let facturasTocadas = false;
  const facturas = await listarFacturas(ctx.tenantId);

  const siguiente = { ...mov };

  // --- Aceptar una sugerencia ---
  // Puede venir más de una factura: es el caso del adeudo agrupado, donde un
  // solo cargo paga varias. El cargo apunta a la primera —el modelo guarda un
  // enlace— y TODAS quedan conciliadas contra él, que es lo que importa para
  // que no se vuelvan a ofrecer ni se reclamen dos veces.
  if (body.aceptar?.length) {
    const validas = facturas.filter(
      (f) => body.aceptar!.includes(f.id) && f.cliente_id === mov.cliente_id && f.estado === "pendiente",
    );
    if (!validas.length) return NextResponse.json({ error: "esas facturas ya no están disponibles" }, { status: 409 });
    siguiente.estado = "conciliado";
    siguiente.factura_id = validas[0].id;
    if ((mov.veces_sin_justificar ?? 0) > 0) siguiente.resuelto_tras = mov.veces_sin_justificar;
    await guardarFacturas(
      ctx.tenantId,
      facturas.map((f) =>
        validas.some((v) => v.id === f.id)
          ? { ...f, estado: "conciliada" as const, movimiento_id: mov.id }
          : f,
      ),
    );
    facturasTocadas = true;
  }

  // --- Rechazar una sugerencia ---
  // Se recuerda para siempre: sin esto, la siguiente pasada volvería a proponer
  // exactamente lo mismo y Jose tendría que decir que no cada semana.
  if (body.rechazar?.length) {
    siguiente.sugerencias_rechazadas = [
      ...new Set([...(mov.sugerencias_rechazadas ?? []), ...body.rechazar]),
    ];
    if (siguiente.estado === "sugerido") siguiente.estado = "sin_factura";
  }

  // --- Motivo al desmarcar ---
  if (body.motivo) {
    const motivo = body.motivo as MotivoNoReclamar;
    if (!MOTIVOS.includes(motivo)) return NextResponse.json({ error: "motivo no válido" }, { status: 400 });
    siguiente.motivo = motivo;
    siguiente.motivo_en = ahora;
    // "No corresponde" es el único que saca el cargo del circuito: no es un
    // gasto de ese cliente, así que no se le puede pedir su factura. Los otros
    // dos lo dejan pendiente y se le vuelve a ofrecer en la pasada siguiente.
    if (motivo === "no_corresponde") siguiente.estado = "ignorado";
  }

  await guardarMovimientos(ctx.tenantId, movs.map((m) => (m.id === mov.id ? siguiente : m)));

  return NextResponse.json({ ok: true, movimiento: siguiente, facturasTocadas });
}
