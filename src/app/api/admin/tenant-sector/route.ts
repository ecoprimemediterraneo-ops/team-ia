// GET /api/admin/tenant-sector — founder-only. Ve y corrige el campo `sector`
// (SectorNegocio) guardado en cada tenant.
//
// Existe por un dato mal sembrado: `tenant_aiteam` (la cuenta comercial de
// AI-Team) tenía `sector: "estetica"` guardado en producción. `resolverSector()`
// mira primero ese campo, así que aunque `sectorPrompt` fuera "vendedor" (lo que
// debería devolver null, "esto no es un negocio de cliente"), ganaba el sector
// guardado y el panel abría con los KPIs y el rótulo de una clínica estética.
// No era un fallo de código — `briefing-panel.ts` ya unifica bien— sino un dato
// suelto en Supabase que ningún deploy corrige solo.
//
//   GET                                  lista todos los tenants con su sector
//   GET ?tenant=<id>&sector=null         BORRA el sector (cuenta comercial / sin sector fijado)
//   GET ?tenant=<id>&sector=<valida>     fija el sector a uno de los 5 válidos

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { listTenants, getTenant, upsertTenant, DEFAULT_TENANT_ID } from "@/lib/tenants";
import { resolverSector, esSectorNegocio } from "@/lib/sectores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function estadoTenants(tenants: Awaited<ReturnType<typeof listTenants>>) {
  return tenants.map((t) => ({
    id: t.id,
    nombre: t.name ?? t.id,
    sectorGuardado: t.sector ?? null,
    sectorPromptAntiguo: t.sectorPrompt ?? null,
    fichaSectorTexto: t.ficha?.sector ?? null,
    sectorResuelto: resolverSector(t),
    esCuentaComercial: t.id === DEFAULT_TENANT_ID,
    veredicto:
      t.id === DEFAULT_TENANT_ID
        ? t.sector
          ? `MAL: tiene sector "${t.sector}" guardado — el panel se lee como negocio de cliente, no como AI-Team.`
          : "BIEN: sin sector guardado, resuelve a null (cuenta comercial)."
        : resolverSector(t) === null
          ? "AVISO: es un tenant de cliente pero no resuelve a ningún sector — revisar sectorPrompt."
          : `sector "${resolverSector(t)}"`,
  }));
}

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const q = new URL(req.url).searchParams;
  const tenantId = q.get("tenant");
  const sectorParam = q.get("sector");

  if (tenantId && sectorParam !== null) {
    const t = await getTenant(tenantId);
    if (!t) {
      return NextResponse.json({ error: `No existe el tenant "${tenantId}".` }, { status: 400 });
    }

    if (sectorParam === "null") {
      const { sector: _fuera, ...resto } = t;
      await upsertTenant(resto as typeof t);
      const actualizado = await getTenant(tenantId);
      return NextResponse.json({
        veredicto: `Sector BORRADO en "${tenantId}". Resuelve ahora a: ${JSON.stringify(resolverSector(actualizado!))}.`,
        tenant: estadoTenants([actualizado!])[0],
      });
    }

    if (!esSectorNegocio(sectorParam)) {
      return NextResponse.json(
        { error: `"${sectorParam}" no es un sector válido (salon, estetica, dental, gestoria, restaurante) ni "null".` },
        { status: 400 },
      );
    }

    await upsertTenant({ ...t, sector: sectorParam });
    const actualizado = await getTenant(tenantId);
    return NextResponse.json({
      veredicto: `Sector fijado a "${sectorParam}" en "${tenantId}".`,
      tenant: estadoTenants([actualizado!])[0],
    });
  }

  const tenants = await listTenants();
  return NextResponse.json({
    ok: true,
    tenants: estadoTenants(tenants),
    comoSeArregla:
      `Para dejar tenant_aiteam como cuenta comercial (sector null): ` +
      `GET /api/admin/tenant-sector?tenant=${DEFAULT_TENANT_ID}&sector=null`,
  });
}
