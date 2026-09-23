// GET /api/admin/tenant-whatsapp-numero — founder-only. Asigna a un tenant SU
// número de WhatsApp (el `phone_number_id` de Meta) y la cuenta de WhatsApp
// Business (WABA) a la que pertenece. Es lo que hace que Pablo sepa de quién es
// cada mensaje: `resolveTenantFromMeta` busca ese id en los tenants.
//
//   GET                                          lista los tenants con su número
//   GET ?tenant=<id>&numero=<phone_number_id>&waba=<waba_id>   lo asigna
//   GET ?tenant=<id>&quitar=1                    lo quita
//
// Comprueba que ese número no sea ya de OTRO tenant (409, no cambia nada). No
// llama a Meta ni suscribe nada: solo guarda el dato. La suscripción de la app a
// la WABA es otro paso (docs/alta-numero-cliente.md).

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { listTenants } from "@/lib/tenants";
import { asignarNumeroWhatsapp, quitarNumeroWhatsapp } from "@/lib/tenant-whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const q = new URL(req.url).searchParams;
  const tenant = q.get("tenant");

  if (tenant && q.get("quitar") === "1") {
    const r = await quitarNumeroWhatsapp(tenant);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, veredicto: `Número quitado de "${tenant}".` });
  }

  if (tenant && q.get("numero")) {
    const r = await asignarNumeroWhatsapp(tenant, q.get("numero") as string, q.get("waba") || undefined);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({
      ok: true,
      veredicto: `Número ${r.valor.whatsappPhoneNumberId} asignado a "${tenant}".`,
      waba: r.valor.whatsappBusinessAccountId ?? null,
      siguiente: "Falta suscribir la app a esa WABA (docs/alta-numero-cliente.md, paso 5). Sin eso Meta no manda nada al webhook.",
    });
  }

  const tenants = (await listTenants()).map((t) => ({
    id: t.id,
    negocio: t.name,
    whatsappPhoneNumberId: t.whatsappPhoneNumberId ?? null,
    waba: t.whatsappBusinessAccountId ?? null,
  }));
  return NextResponse.json({
    ok: true,
    tenants,
    comoSeAsigna: "GET /api/admin/tenant-whatsapp-numero?tenant=<id>&numero=<phone_number_id>&waba=<waba_id>",
  });
}
