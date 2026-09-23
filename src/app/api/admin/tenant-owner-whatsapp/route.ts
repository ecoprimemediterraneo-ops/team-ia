// GET /api/admin/tenant-owner-whatsapp — founder-only. Ve y pone el WhatsApp del
// DUEÑO de un tenant (a quien van los avisos). Mismo estilo que tenant-sector:
// todo por la URL, nada que pegar en un chat.
//
//   GET                                lista los tenants y si tienen dueño con WhatsApp
//   GET ?tenant=<id>&numero=<n>        lo pone (dígitos con prefijo de país, p.ej. 34600000000)
//   GET ?tenant=<id>&quitar=1          lo borra
//
// El número NUNCA se devuelve entero: solo principio y final. Poner un número
// tampoco manda nada: los avisos los gobiernan sus propios interruptores
// (GESTORIA_AVISO_DIARIO_ENABLED…), que salen apagados.

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { listTenants } from "@/lib/tenants";
import { fijarOwnerWhatsapp, enmascarar } from "@/lib/tenant-whatsapp";
import { avisoDiarioEnabled } from "@/lib/gestoria-aviso-diario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function estado() {
  return (await listTenants()).map((t) => ({
    id: t.id,
    negocio: t.name,
    ownerWhatsapp: enmascarar(t.ownerWhatsapp),
    gestor: t.ownerName ?? null,
  }));
}

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const q = new URL(req.url).searchParams;
  const tenant = q.get("tenant");
  const numero = q.get("numero");
  const interruptor = avisoDiarioEnabled() ? "ENCENDIDO" : "apagado (GESTORIA_AVISO_DIARIO_ENABLED): no sale ningún aviso aunque haya número";

  if (tenant && (numero !== null || q.get("quitar") === "1")) {
    const r = await fijarOwnerWhatsapp(tenant, q.get("quitar") === "1" ? null : (numero as string));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({
      ok: true,
      veredicto: numero !== null
        ? `WhatsApp del dueño de "${tenant}" puesto: ${enmascarar(r.valor.ownerWhatsapp)}.`
        : `WhatsApp del dueño de "${tenant}" BORRADO.`,
      ...(r.aviso ? { aviso: r.aviso } : {}),
      avisoDiario: interruptor,
    });
  }

  return NextResponse.json({
    ok: true,
    avisoDiario: interruptor,
    tenants: await estado(),
    comoSePone: "GET /api/admin/tenant-owner-whatsapp?tenant=tenant_demo_gestoria&numero=34600000000",
  });
}
