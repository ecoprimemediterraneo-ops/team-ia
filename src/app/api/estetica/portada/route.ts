// La barra roja de "lo que aprieta" del panel de estética. Mismo formato que
// usa `BarraUrgente` en gestoría ({texto, href} | null), con el dato que aquí
// más aprieta: leads calientes que siguen sin respuesta. En una clínica
// estética llegan pocos leads y el ticket es alto — uno sin contestar es la
// pérdida más cara del día, mucho más que un hueco vacío.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { leadsCalientesSinContestar } from "@/lib/estetica-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const ctx = await contextoPanelODefecto();
  if (ctx.perfil.id !== "estetica") return NextResponse.json({ ok: false }, { status: 403 });

  let urgente: { texto: string; href: string } | null = null;
  let cuantos = 0;

  try {
    const calientes = await leadsCalientesSinContestar(ctx.tenantId);
    cuantos = calientes.length;
    if (cuantos > 0) {
      urgente = {
        texto:
          cuantos === 1
            ? "1 lead caliente sigue sin contestar."
            : `${cuantos} leads calientes siguen sin contestar.`,
        href: "/dashboard/leads-valoraciones",
      };
    }
  } catch { /* si falla, se sigue sin barra en vez de romper el panel */ }

  return NextResponse.json({ ok: true, urgente, calientes: cuantos });
}
