// Disparar el aviso de la mañana AHORA, sin esperar al cron. Founder-only.
//
//   GET                    enseña lo que se mandaría y dice si se puede mandar
//   GET ?enviar=1          lo manda de verdad, si y solo si se puede
//   GET ?tenant=<id>       sobre otro tenant (por defecto, el del panel)
//
// POR QUÉ UNA RUTA Y NO UNA PANTALLA: la pantalla que había para esto se ha
// quitado —era una herramienta de revisión metida en Ajustes, donde no pinta
// nada—. Esto es lo que de verdad hacía falta: poder dispararlo y ver si sale.
//
// NO MANDA NADA SIN PEDÍRSELO. `GET` a secas es una lectura: enseña el mensaje y
// el diagnóstico. Hay que añadir `?enviar=1` para que salga. Un enlace que manda
// un WhatsApp al abrirlo es un enlace que alguien abre sin querer.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { avisoDelDia, avisoDiarioEnabled } from "@/lib/gestoria-aviso-diario";
import { sendWhatsAppText } from "@/lib/whatsapp-sender";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { getTenant } from "@/lib/tenants";
import { resolverSector } from "@/lib/sectores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** ¿Están los datos mínimos para que un WhatsApp salga de verdad? */
function chequeoEnvio(): { puede: boolean; falta: string[] } {
  const falta: string[] = [];
  if (!process.env.WHATSAPP_ACCESS_TOKEN) falta.push("WHATSAPP_ACCESS_TOKEN");
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) falta.push("WHATSAPP_PHONE_NUMBER_ID");
  return { puede: falta.length === 0, falta };
}

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const ctx = await contextoPanelODefecto();
  const tenantId = url.searchParams.get("tenant") || ctx.tenantId;
  const quiereEnviar = url.searchParams.get("enviar") === "1";

  const t = await getTenant(tenantId);
  if (!t) return NextResponse.json({ error: `No existe el tenant "${tenantId}".` }, { status: 404 });
  if (resolverSector(t) !== "gestoria") {
    return NextResponse.json({ error: `"${t.name}" no es una gestoría: no tiene aviso diario.` }, { status: 400 });
  }

  const aviso = await avisoDelDia(tenantId);
  const movil = t.ownerWhatsapp?.trim() || null;
  const chequeo = chequeoEnvio();
  const flag = avisoDiarioEnabled();

  // El diagnóstico va SIEMPRE, se envíe o no: la pregunta de quien abre esto es
  // "¿por qué no me llega?", y se contesta antes de que la haga.
  const diagnostico = {
    tenant: t.name,
    gestor: t.ownerName ?? null,
    movilDelGestor: movil ?? "FALTA en ownerWhatsapp",
    interruptor: flag ? "ENCENDIDO (GESTORIA_AVISO_DIARIO_ENABLED)" : "APAGADO (GESTORIA_AVISO_DIARIO_ENABLED)",
    credencialesDeWhatsApp: chequeo.puede ? "puestas" : `FALTAN: ${chequeo.falta.join(", ")}`,
    sePuedeEnviar: !!movil && chequeo.puede,
  };

  const mensajes = [
    { orden: 1, texto: aviso.resumen },
    ...(aviso.urgente ? [{ orden: 2, texto: aviso.urgente }] : []),
  ];

  if (!quiereEnviar) {
    return NextResponse.json({
      ok: true,
      enviado: false,
      comoEnviar: diagnostico.sePuedeEnviar
        ? "Añade ?enviar=1 a esta misma URL."
        : "Todavía no se puede enviar. Mira `diagnostico` y `queFalta`.",
      queFalta: diagnostico.sePuedeEnviar
        ? []
        : [
            ...(movil ? [] : ["El tenant no tiene móvil en `ownerWhatsapp`."]),
            ...chequeo.falta.map((v) => `Falta la variable de entorno ${v}.`),
          ],
      diagnostico,
      mensajes,
    });
  }

  // --- A partir de aquí, se ha pedido enviar ---

  if (!movil) {
    return NextResponse.json(
      { error: `"${t.name}" no tiene móvil en ownerWhatsapp: no hay a quién mandárselo.`, diagnostico, mensajes },
      { status: 400 },
    );
  }

  // NO SE INTENTA SIN CREDENCIALES. Sin esto, la llamada bajaría hasta
  // `whatsapp-sender`, volvería con "missing_credentials" y habría que ir a
  // buscar el motivo en un log. Se dice aquí, con nombre y apellidos.
  if (!chequeo.puede) {
    return NextResponse.json(
      {
        error: "No se ha intentado enviar: faltan credenciales de WhatsApp en este entorno.",
        queFalta: chequeo.falta.map((v) => `Falta la variable de entorno ${v}.`),
        diagnostico,
        mensajes,
      },
      { status: 412 },
    );
  }

  // El candado de `whatsapp-sender` sigue mandando: en local, sin META_GRAPH_URL
  // esto NO sale a Meta, devuelve un envío simulado. Es lo que se quiere.
  const resultados = [];
  for (const m of mensajes) {
    // El rastro deja el wamid guardado en el registro de envíos.
    const r = await sendWhatsAppText(movil, m.texto, {
      tenantId,
      a: movil,
      motivo: m.orden === 1 ? "aviso_diario_resumen" : "aviso_diario_urgente",
    });
    resultados.push({
      orden: m.orden,
      ok: r.ok,
      simulado: r.ok ? !!r.simulado : false,
      // EL ID QUE DEVUELVE META (`wamid.…`). Se guardaba en la respuesta de
      // `sendWhatsAppText` y aquí se tiraba: sin él, cuando alguien pregunta
      // "¿seguro que salió?" no hay nada que enseñar salvo un "ok: true", y con
      // eso no se puede buscar el mensaje en ningún sitio.
      messageId: r.ok ? r.messageId ?? null : null,
      detalle: r.ok ? (r.simulado ? "simulado en local, no ha salido a Meta" : "enviado") : r.detail,
    });
    if (r.ok && !r.simulado) {
      console.log(`[aviso-diario-ahora] mensaje ${m.orden} aceptado por Meta · id=${r.messageId ?? "(sin id)"}`);
    }
    if (!r.ok) break;
  }

  return NextResponse.json({
    ok: resultados.every((r) => r.ok),
    enviado: resultados.every((r) => r.ok),
    a: movil,
    diagnostico,
    mensajes,
    resultados,
  });
}
