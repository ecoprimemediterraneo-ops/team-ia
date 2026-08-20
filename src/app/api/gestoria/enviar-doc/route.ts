// Mandarle un documento al cliente por su WhatsApp.
//
// Con el envío apagado devuelve el mensaje que saldría, sin mandarlo. Así se
// puede ver exactamente qué le va a llegar al cliente antes de encenderlo.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { listarClientes } from "@/lib/gestoria-clientes";
import { enviarDocumentoAlCliente, envioDocsEnabled, modoSugerido, type ModoEnvio } from "@/lib/gestoria-envio-docs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar en el panel." }, { status: 401 });
  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return NextResponse.json({ error: "no es una gestoría" }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const clienteId = String(form.get("clienteId") || "").trim();
    const descripcion = String(form.get("descripcion") || "").trim();
    const modoPedido = String(form.get("modo") || "").trim() as ModoEnvio | "";
    const f = form.get("documento");

    if (!clienteId) return NextResponse.json({ error: "falta clienteId" }, { status: 400 });
    if (!(f instanceof File)) return NextResponse.json({ error: "no llegó ningún documento" }, { status: 400 });

    const cliente = (await listarClientes(ctx.tenantId)).find((c) => c.id === clienteId);
    if (!cliente) return NextResponse.json({ error: "ese cliente no existe" }, { status: 404 });

    const r = await enviarDocumentoAlCliente({
      tenantId: ctx.tenantId,
      clienteId,
      telefono: cliente.telefono,
      nombreGestoria: ctx.tenant?.name ?? "tu gestoría",
      nombre: f.name,
      contenido: Buffer.from(await f.arrayBuffer()),
      mime: f.type || "application/octet-stream",
      descripcion,
      modo: modoPedido === "fichero" || modoPedido === "enlace" ? modoPedido : undefined,
    });

    return NextResponse.json({
      ...r,
      cliente: cliente.nombre,
      telefono: cliente.telefono,
      envioEncendido: envioDocsEnabled(),
      modoSugerido: modoSugerido(f.name),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
