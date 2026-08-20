// Pedirle al CLIENTE DE LA GESTORÍA las facturas que faltan.
//
// El mensaje va SIEMPRE al cliente de Jose. NUNCA al proveedor que emitió la
// factura: el sistema no tiene su contacto y escribir a un tercero en nombre de
// otro no es algo que se haga solo.
//
// TRES CANDADOS, y ninguno sobra:
//   1. Solo se manda lo que Jose ha marcado. Nada viene marcado de serie.
//   2. El disparo es su clic. No hay cron, no hay envío al conciliar.
//   3. GESTORIA_RECLAMACION_SEND_ENABLED apagado —como sale de fábrica— genera
//      el texto y lo devuelve para que lo lea, pero no sale nada.
//
// El canal lo decide el dato del cliente, no una preferencia: si hay móvil va
// por WhatsApp (Pablo); si solo hay email, por correo (Lucía).

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { listarMovimientos, guardarMovimientos } from "@/lib/gestoria-facturas";
import {
  textoReclamacion, reclamacionSendEnabled, paramsReclamacion,
  RECLAMACION_TEMPLATE, RECLAMACION_TEMPLATE_LANG,
} from "@/lib/gestoria-conciliacion";
import { listarClientes, canalDe } from "@/lib/gestoria-clientes";
import { sendWhatsAppTemplate } from "@/lib/whatsapp-sender";
import { logEvent, makeEventId } from "@/lib/event-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar en el panel." }, { status: 401 });
  const ctx = await contextoPanelODefecto();

  const body = (await req.json().catch(() => ({}))) as {
    ids?: string[];
    /** Texto editado por Jose, por movimiento. Si no viene, se usa el de fábrica. */
    textos?: Record<string, string>;
    /** true = solo enseñar lo que se mandaría, sin marcar nada. */
    soloVista?: boolean;
  };
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length) return NextResponse.json({ error: "no has marcado ningún cargo" }, { status: 400 });

  const movimientos = await listarMovimientos(ctx.tenantId);
  const elegidos = movimientos.filter((m) => ids.includes(m.id) && m.signo === "cargo");
  if (!elegidos.length) return NextResponse.json({ error: "no encontrados" }, { status: 404 });

  const clientes = await listarClientes(ctx.tenantId);
  const porCliente = new Map(clientes.map((c) => [c.id, c]));
  const nombreGestoria = ctx.tenant?.name || "tu gestoría";

  const puedeEnviar = reclamacionSendEnabled();
  const ahora = new Date().toISOString();
  const mensajes = [];
  const marcados = new Map<string, { a: string; canal: "whatsapp" | "email" }>();

  for (const mov of elegidos) {
    const cliente = porCliente.get(mov.cliente_id);
    const canal = cliente ? canalDe(cliente) : null;
    const destino = canal === "whatsapp" ? cliente!.telefono : canal === "email" ? cliente!.email ?? "" : "";
    const texto = body.textos?.[mov.id]?.trim() || textoReclamacion(mov);
    let enviado = false;

    // Va por PLANTILLA, no por texto libre. Se le escribe al cliente semanas
    // después de su última conversación, o sea fuera de la ventana de 24 h de
    // WhatsApp: ahí Meta solo acepta plantillas aprobadas y un texto suelto se
    // rechaza sin más. El texto de arriba es el que Jose lee y copia si el envío
    // está apagado; lo que sale por el cable es la plantilla.
    if (!body.soloVista && puedeEnviar && canal === "whatsapp" && destino) {
      const r = await sendWhatsAppTemplate(
        destino,
        RECLAMACION_TEMPLATE,
        RECLAMACION_TEMPLATE_LANG,
        paramsReclamacion(cliente?.nombre ?? "", nombreGestoria, mov),
      ).catch(() => ({ ok: false }));
      enviado = !!r.ok;
      if (enviado) {
        await logEvent(ctx.tenantId, {
          id: makeEventId("reclamacion_factura", "pablo", mov.id, String(Date.now())),
          type: "message_out",
          channel: "pablo",
          senderId: destino,
          meta: { kind: "reclamacion_factura", movimiento: mov.id, importe: mov.importe },
        }).catch(() => {});
      }
    }

    // Se marca como pedido aunque el envío esté apagado: Jose ha pulsado y se
    // lleva el texto. Si no se marcase, la siguiente pasada volvería a ofrecerle
    // el mismo cargo como si no hubiera hecho nada.
    if (!body.soloVista && canal && destino) marcados.set(mov.id, { a: destino, canal });

    mensajes.push({
      movimientoId: mov.id, importe: mov.importe, fecha: mov.fecha, concepto: mov.concepto,
      cliente: cliente?.nombre ?? mov.cliente_id, canal, destino, texto, enviado,
      yaSePidio: mov.pedido_en ?? null,
      // Lo que se le manda a Meta, para poder comprobarlo sin adivinar.
      plantilla: RECLAMACION_TEMPLATE,
      parametros: paramsReclamacion(cliente?.nombre ?? "", nombreGestoria, mov),
    });
  }

  if (marcados.size) {
    await guardarMovimientos(
      ctx.tenantId,
      movimientos.map((m) =>
        marcados.has(m.id)
          ? { ...m, pedido_a: marcados.get(m.id)!.a, pedido_canal: marcados.get(m.id)!.canal, pedido_en: ahora }
          : m,
      ),
    );
  }

  const sinCanal = mensajes.filter((m) => !m.canal).length;

  return NextResponse.json({
    ok: true,
    total: mensajes.length,
    enviados: mensajes.filter((m) => m.enviado).length,
    marcados: marcados.size,
    modo: puedeEnviar
      ? `encendido · plantilla ${RECLAMACION_TEMPLATE} (${RECLAMACION_TEMPLATE_LANG})`
      : "APAGADO — el mensaje se prepara y lo mandas tú",
    aviso: sinCanal ? `${sinCanal} cliente(s) sin teléfono ni email en su ficha: ahí no hay por dónde escribir.` : "",
    mensajes,
  });
}
