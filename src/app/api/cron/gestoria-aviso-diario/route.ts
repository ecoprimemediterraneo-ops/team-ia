// El aviso de cada mañana al gestor, por WhatsApp.
//
// DOS MENSAJES: el resumen del día y, aparte, lo que vence hoy o mañana y sigue
// sin hacer. Mezclados, lo urgente se lee como un renglón más.
//
// Fail-closed: sin `GESTORIA_AVISO_DIARIO_ENABLED=true` calcula, lo deja
// escrito en el log y NO manda nada. Así se puede ver qué se enviaría antes de
// que le llegue nada a nadie.

import { NextResponse } from "next/server";
import { listTenants } from "@/lib/tenants";
import { resolverSector } from "@/lib/sectores";
import { avisoDelDia, avisoDiarioEnabled } from "@/lib/gestoria-aviso-diario";
import { sendWhatsAppText } from "@/lib/whatsapp-sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Mismo candado que el resto de crons.
  const secreto = process.env.CRON_SECRET;
  const cabecera = req.headers.get("authorization") || "";
  const esVercel = req.headers.get("user-agent")?.includes("vercel-cron");
  if (secreto && !esVercel && cabecera !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const encendido = avisoDiarioEnabled();
  const salida: Array<Record<string, unknown>> = [];

  for (const t of (await listTenants()).filter((x) => resolverSector(x) === "gestoria")) {
    const aviso = await avisoDelDia(t.id).catch(() => null);
    if (!aviso) { salida.push({ tenant: t.id, error: "no se han podido leer las tareas" }); continue; }

    const destino = t.ownerWhatsapp;
    const fila: Record<string, unknown> = {
      tenant: t.id,
      pendientes: aviso.tareas.length,
      urgentes: aviso.urgente ? "sí" : "no",
      resumen: aviso.resumen,
      mensajeUrgente: aviso.urgente,
    };

    if (!destino) {
      fila.envio = "SIN ownerWhatsapp en el tenant: no hay a quién mandárselo";
    } else if (!encendido) {
      fila.envio = "APAGADO (GESTORIA_AVISO_DIARIO_ENABLED no está en true)";
    } else {
      const r1 = await sendWhatsAppText(destino, aviso.resumen, {
        tenantId: t.id, a: destino, motivo: "aviso_diario_resumen",
      });
      // El segundo mensaje solo sale si de verdad hay algo que vence.
      const r2 = aviso.urgente
        ? await sendWhatsAppText(destino, aviso.urgente, {
            tenantId: t.id, a: destino, motivo: "aviso_diario_urgente",
          })
        : null;
      fila.envio = `enviado a ${destino}`;
      fila.resultado = { resumen: !!r1, urgente: aviso.urgente ? !!r2 : "no hacía falta" };
    }

    console.log(`[cron/gestoria-aviso] ${t.id}: ${aviso.tareas.length} pendientes · ${fila.envio}`);
    salida.push(fila);
  }

  return NextResponse.json({ encendido, gestorias: salida.length, detalle: salida });
}
