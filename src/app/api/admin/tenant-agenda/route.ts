// GET /api/admin/tenant-agenda — founder-only. Dice a un tenant cuál es SU
// agenda y a qué número llaman sus clientes a Carmen. Es lo que hace que
// Carmen, Pablo y el panel miren la misma agenda (ver /api/admin/diagnostico-agenda).
//
//   GET                                                   lista los tenants con su agenda y su número de Carmen
//   GET ?tenant=<id>&carmen=<+34...>                      asigna el número de Carmen
//   GET ?tenant=<id>&agenda=<slug>                        fija el negocio que es su agenda
//   (se pueden pasar los dos a la vez)
//
// Comprueba que el número no sea ya de OTRO tenant y que el negocio sea de ese
// tenant (409 / 404, sin cambiar nada). Mismo patrón que tenant-whatsapp-numero.
import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { getTenant, listTenants, mismoTelefono, upsertTenant } from "@/lib/tenants";
import { getBusinessesForTenant } from "@/lib/booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const aE164 = (n: string): string | null => {
  const d = n.replace(/\D/g, "");
  if (d.length === 9) return `+34${d}`;
  if (d.length === 11 && d.startsWith("34")) return `+${d}`;
  return null;
};

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const q = new URL(req.url).searchParams;
  const tenantId = q.get("tenant");
  const carmen = q.get("carmen");
  const agenda = q.get("agenda");

  if (tenantId && (carmen || agenda)) {
    const t = await getTenant(tenantId);
    if (!t) return NextResponse.json({ error: `no existe el tenant "${tenantId}"` }, { status: 404 });
    const cambios: Record<string, string> = {};
    if (carmen) {
      const numero = aE164(carmen);
      if (!numero) return NextResponse.json({ error: `"${carmen}" no es un teléfono español válido` }, { status: 400 });
      const otro = (await listTenants()).find((x) => x.id !== tenantId && x.carmenPhoneNumber && mismoTelefono(x.carmenPhoneNumber, numero));
      if (otro) return NextResponse.json({ error: `el número ${numero} ya es de "${otro.id}"` }, { status: 409 });
      cambios.carmenPhoneNumber = numero;
    }
    if (agenda) {
      const negocios = await getBusinessesForTenant(tenantId);
      if (!negocios.some((b) => b.slug === agenda)) {
        return NextResponse.json({ error: `"${agenda}" no es un negocio de ${tenantId} (tiene: ${negocios.map((b) => b.slug).join(", ") || "ninguno"})` }, { status: 404 });
      }
      cambios.negocioAgenda = agenda;
    }
    const antes = { carmenPhoneNumber: t.carmenPhoneNumber ?? null, negocioAgenda: t.negocioAgenda ?? null };
    // Se relee justo antes de guardar para no pisar un cambio hecho entre medias.
    const fresco = (await getTenant(tenantId)) ?? t;
    await upsertTenant({ ...fresco, ...cambios });
    const despues = await getTenant(tenantId);
    return NextResponse.json({ ok: true, tenant: tenantId, antes, despues: { carmenPhoneNumber: despues?.carmenPhoneNumber ?? null, negocioAgenda: despues?.negocioAgenda ?? null } });
  }

  const tenants = [];
  for (const t of await listTenants()) {
    const negocios = (await getBusinessesForTenant(t.id)).map((b) => b.slug);
    if (!negocios.length) continue;
    tenants.push({ id: t.id, negocios, negocioAgenda: t.negocioAgenda ?? null, carmenPhoneNumber: t.carmenPhoneNumber ?? null });
  }
  return NextResponse.json({ ok: true, tenants, comoSeAsigna: "GET /api/admin/tenant-agenda?tenant=<id>&carmen=<+34...>&agenda=<slug>" });
}
