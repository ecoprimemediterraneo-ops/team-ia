// Lectura de un correo por Lucía.
//
// GESTORÍA: además del cuerpo, los adjuntos PDF e imagen de ese correo se
// guardan en el saco de facturas del cliente. El CUERPO se sigue tratando igual
// que siempre — esto solo añade el guardado de los ficheros.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { fetchMessageBody, fetchAdjuntos, getRedirectUri } from "@/lib/gmail";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { guardarAdjuntosEmail } from "@/lib/gestoria-adjuntos";
import { listarClientes, clienteIdDeTelefono } from "@/lib/gestoria-clientes";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { email } = await requireSession();
    const { id } = await params;
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const redirectUri = getRedirectUri(host, proto);

    const m = await fetchMessageBody(email, redirectUri, id);
    if (!m) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // --- Adjuntos al saco, solo en gestoría ---
    // A qué cliente se imputa: si quien llama lo dice (?clienteId=), a ese; si
    // no, se intenta casar el remitente del correo con un cliente conocido.
    //
    // Si no se sabe de quién es, se guarda IGUAL pero sin dueño (sin_asignar) y
    // el gestor la coloca a mano desde la bandeja. Nunca se adivina el cliente
    // por el contenido del PDF: una factura en el saco equivocado le concilia a
    // otro un cargo que no es suyo. Sin dueño no entra en el cruce.
    let adjuntosGuardados = 0;
    let clienteUsado: string | null = null;
    try {
      const ctx = await contextoPanelODefecto();
      if (tieneFuncion(ctx.sector, "estadoExpediente")) {
        const pedido = new URL(req.url).searchParams.get("clienteId");
        let clienteId = pedido ? clienteIdDeTelefono(pedido) || pedido : "";

        if (!clienteId) {
          const clientes = await listarClientes(ctx.tenantId);
          const remitente = (m.from || "").toLowerCase();
          const encontrado = clientes.find(
            (c) => remitente.includes(c.nombre.toLowerCase()) || remitente.includes(c.telefono),
          );
          clienteId = encontrado?.id ?? "";
        }

        const adjuntos = await fetchAdjuntos(email, redirectUri, id);
        if (adjuntos.length) {
          adjuntosGuardados = await guardarAdjuntosEmail({
            tenantId: ctx.tenantId,
            clienteId: clienteId || null,
            adjuntos,
            remitente: m.from,
            asunto: m.subject,
          });
          clienteUsado = clienteId || null;
        }
      }
    } catch (err) {
      // Nunca rompe la lectura del correo: Lucía sigue funcionando igual.
      console.error("[lucia/message] no se pudieron guardar los adjuntos:", err);
    }

    return NextResponse.json({ ...m, adjuntosGuardados, clienteUsado });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
