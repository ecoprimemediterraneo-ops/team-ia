// Banco de pruebas de la gestoría. Founder-only.
//
//   GET ?que=aviso                       enseña los dos mensajes de la mañana, sin enviarlos
//   POST {correo:{remitente,asunto,cuerpo}}   lee un correo y crea el vencimiento en HOY
//   POST {texto:"..."}                   simula lo que Pablo entiende de un audio del gestor
//
// Existe porque las tres cosas solo se pueden probar de verdad con un correo
// real en Gmail o un audio real por WhatsApp. Aquí se prueban con texto pegado.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { avisoDelDia, avisoDiarioEnabled } from "@/lib/gestoria-aviso-diario";
import { apuntarPlazoDeCorreo } from "@/lib/gestoria-plazos";
import { entender } from "@/lib/gestoria-audio";
import { listarClientes } from "@/lib/gestoria-clientes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const ctx = await contextoPanelODefecto();
  const tenantId = new URL(req.url).searchParams.get("tenant") || ctx.tenantId;
  const aviso = await avisoDelDia(tenantId);

  return NextResponse.json({
    tenant: tenantId,
    envioAutomatico: avisoDiarioEnabled() ? "ENCENDIDO" : "apagado (GESTORIA_AVISO_DIARIO_ENABLED)",
    mensaje1_resumen: aviso.resumen,
    mensaje2_loQueVence: aviso.urgente ?? "(no hay nada que venza hoy o mañana: no se manda segundo mensaje)",
    pendientes: aviso.tareas.length,
  });
}

export async function POST(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const ctx = await contextoPanelODefecto();
  const body = (await req.json().catch(() => ({}))) as {
    tenant?: string;
    correo?: { remitente?: string; asunto?: string; cuerpo?: string };
    texto?: string;
  };
  const tenantId = body.tenant || ctx.tenantId;

  if (body.correo) {
    const r = await apuntarPlazoDeCorreo({
      tenantId,
      remitente: body.correo.remitente || "",
      asunto: body.correo.asunto || "",
      cuerpo: body.correo.cuerpo || "",
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    return NextResponse.json({
      veredicto: r.plazo.fechaLimite
        ? `Vencimiento creado para el ${r.plazo.fechaLimite}.`
        : "No hay fecha límite en el correo: se ha apuntado SIN PLAZO para que lo mires.",
      plazo: r.plazo,
      tarea: r.tarea,
    });
  }

  if (body.texto) {
    const clientes = await listarClientes(tenantId).catch(() => []);
    const intencion = await entender(body.texto, clientes.map((c) => ({ id: c.id, nombre: c.nombre })));
    return NextResponse.json({ texto: body.texto, intencion });
  }

  return NextResponse.json({ error: "manda { correo: {...} } o { texto: '...' }" }, { status: 400 });
}
