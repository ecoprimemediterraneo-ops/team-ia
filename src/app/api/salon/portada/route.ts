// La barra roja de "lo que aprieta" del panel del salón, y los números de las
// pestañas. Mismo formato que usa `BarraUrgente` ({texto, href} | null).
//
// En un salón lo que aprieta es el hueco vacío: alguien esperando un día en el que
// YA hay hueco libre es dinero que se está perdiendo ahora mismo. El resto de
// números (cuántas esperan, cuántas clientas dormidas) va en las pestañas.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { getBusinessesForTenant, listEspera, listClientasDormidasCompleto, computeFreeSlots, resolverServicio } from "@/lib/booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const ctx = await contextoPanelODefecto();
  if (ctx.perfil.id !== "salon") return NextResponse.json({ ok: false }, { status: 403 });

  let urgente: { texto: string; href: string } | null = null;
  let espera = 0;
  let dormidas = 0;

  try {
    const negocio = (await getBusinessesForTenant(ctx.tenantId))[0];
    if (negocio) {
      const esperando = (await listEspera(negocio.slug)).filter((e) => e.estado === "esperando");
      espera = esperando.length;
      dormidas = (await listClientasDormidasCompleto(negocio.slug)).length;

      // ¿Hay alguien esperando un día en el que ya se ha abierto hueco?
      const hoy = new Date().toLocaleDateString("en-CA", { timeZone: negocio.timezone || "Europe/Madrid" });
      let conHueco = 0;
      for (const e of esperando.filter((x) => x.fecha >= hoy).slice(0, 20)) {
        const sv = negocio.servicios.find((x) => x.id === e.serviceId);
        if (!sv) continue;
        const r = await computeFreeSlots(negocio, resolverServicio(sv, { variantId: e.variantId }), e.fecha, "https://aiteam.marketing/api/lucia/callback", undefined, e.empleadoId);
        if (r.ok && r.slots.length > 0) conHueco++;
      }
      if (conHueco > 0) {
        urgente = {
          texto: conHueco === 1 ? "1 clienta espera un día en el que ya hay hueco." : `${conHueco} clientas esperan un día en el que ya hay hueco.`,
          href: "/dashboard/lista-espera",
        };
      }
    }
  } catch { /* si falla, se sigue sin barra en vez de romper el panel */ }

  return NextResponse.json({ ok: true, urgente, espera, dormidas });
}
