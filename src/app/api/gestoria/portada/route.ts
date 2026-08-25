// Lo que la portada necesita para pintarse: la frase urgente y el resumen del día.
//
// El resumen viene cacheado una hora (ver `gestoria-resumen`). `?forzar=1`
// vuelve a pedírselo a la IA, para poder probarlo sin esperar sesenta minutos.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { estadoDeLaGestoria, fraseUrgente } from "@/lib/gestoria-estado";
import { resumenDelDia } from "@/lib/gestoria-resumen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const s = await getSessionLocal();
  if (!s) {
    return NextResponse.json({ error: "Tu sesión ha caducado. Vuelve a entrar en el panel." }, { status: 401 });
  }
  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "estadoExpediente")) {
    return NextResponse.json({ error: "Esto es para gestorías." }, { status: 403 });
  }

  const gestoria = ctx.tenant?.name || "tu gestoría";
  const estado = await estadoDeLaGestoria(ctx.tenantId, gestoria);
  const forzar = new URL(req.url).searchParams.get("forzar") === "1";
  const resumen = await resumenDelDia(ctx.tenantId, estado, { forzar });

  return NextResponse.json({
    ok: true,
    gestoria,
    hoy: estado.hoy,
    /** Cuántos asuntos hay en total, para poder decir "y N más". */
    asuntos: estado.agenda.total,
    urgente: fraseUrgente(estado),
    resumen,
    // Los números NO se pintan en la portada (es prosa, no un cuadro de mandos).
    // Van aquí para poder comprobar de dónde sale cada frase del resumen.
    datos: {
      agenda: {
        total: estado.agenda.total,
        vencidas: estado.agenda.vencidas.length,
        urgentes: estado.agenda.urgentes.length,
        estaSemana: estado.agenda.estaSemana.length,
        criticas: estado.agenda.criticas.length,
        delCorreo: estado.agenda.delCorreo.length,
      },
      documentos: estado.documentos,
      banco: {
        cargosSinFactura: estado.banco.cargosSinFactura,
        importeSinJustificar: estado.banco.importeSinJustificar,
        pagadoSinFactura: estado.banco.pagadoSinFactura,
      },
      clientes: estado.clientes,
      clientesSinNif: estado.clientesSinNif,
    },
  });
}
