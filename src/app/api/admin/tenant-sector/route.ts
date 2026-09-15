// GET /api/admin/tenant-sector — founder-only. Ve y corrige el campo `sector`
// (SectorNegocio) guardado en cada tenant.
//
// Existe por un dato mal sembrado: `tenant_aiteam` (la cuenta comercial de
// AI-Team) tenía `sector: "estetica"` guardado en producción. `resolverSector()`
// mira primero ese campo, y si no lo encuentra cae al campo antiguo
// `sectorPrompt` — que en producción también estaba mal sembrado
// (`"estetica"` en vez de `"vendedor"`), así que borrar solo `sector` no
// basta: sigue resolviendo al sector de cliente. `ficha.sector` es un tercer
// campo, de texto libre, que NO participa en `resolverSector()` pero SÍ se
// usa como rótulo de pantalla cuando no hay sector resuelto (dashboard/page.tsx),
// así que si también está mal sembrado ("clínica dental") el panel lo sigue
// enseñando aunque los KPIs ya sean los genéricos. No era un fallo de código
// — `briefing-panel.ts` ya unifica bien — sino tres datos sueltos en Supabase
// que ningún deploy corrige solo.
//
//   GET                                  lista todos los tenants con su sector
//   GET ?tenant=<id>&sector=null         BORRA sector + sectorPrompt/ficha.sector si es la cuenta comercial
//   GET ?tenant=<id>&sector=<valida>     fija el sector a uno de los 5 válidos

import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/admin-auth";
import { listTenants, getTenant, upsertTenant, DEFAULT_TENANT_ID } from "@/lib/tenants";
import { resolverSector, esSectorNegocio } from "@/lib/sectores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mismo texto que `seedTenants()` en tenants.ts para tenant_aiteam — la
// descripción correcta de la cuenta comercial, no la de un cliente.
const FICHA_SECTOR_AITEAM = "Software / SaaS (agentes IA para PYMES de servicios)";

function estadoTenants(tenants: Awaited<ReturnType<typeof listTenants>>) {
  return tenants.map((t) => {
    const resuelto = resolverSector(t);
    const esComercial = t.id === DEFAULT_TENANT_ID;
    const limpio = !t.sector && (!esComercial || t.sectorPrompt === "vendedor");
    return {
      id: t.id,
      nombre: t.name ?? t.id,
      sectorGuardado: t.sector ?? null,
      sectorPromptAntiguo: t.sectorPrompt ?? null,
      fichaSectorTexto: t.ficha?.sector ?? null,
      sectorResuelto: resuelto,
      esCuentaComercial: esComercial,
      veredicto: esComercial
        ? limpio && resuelto === null
          ? "BIEN: sin sector guardado ni sectorPrompt de cliente, resuelve a null (cuenta comercial)."
          : `MAL: resuelve a ${JSON.stringify(resuelto)} — sector=${JSON.stringify(t.sector ?? null)}, sectorPrompt=${JSON.stringify(t.sectorPrompt ?? null)}. El panel se lee como negocio de cliente, no como AI-Team.`
        : resuelto === null
          ? "AVISO: es un tenant de cliente pero no resuelve a ningún sector — revisar sectorPrompt."
          : `sector "${resuelto}"`,
    };
  });
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
      let limpio = resto as typeof t;
      // Solo para la cuenta comercial: "null" significa de verdad "esto no es
      // un negocio de cliente", así que además del `sector` hay que dejar
      // `sectorPrompt` en "vendedor" (lo único que resolverSector() traduce a
      // null) y el texto de `ficha.sector` con la descripción correcta —
      // ambos pueden llevar sembrado un sector de cliente por el mismo motivo
      // que `sector`.
      if (tenantId === DEFAULT_TENANT_ID) {
        limpio = {
          ...limpio,
          sectorPrompt: "vendedor",
          ficha: limpio.ficha ? { ...limpio.ficha, sector: FICHA_SECTOR_AITEAM } : limpio.ficha,
        };
      }
      await upsertTenant(limpio);
      const actualizado = await getTenant(tenantId);
      const estado = estadoTenants([actualizado!])[0];
      return NextResponse.json({
        veredicto: `Sector BORRADO en "${tenantId}". Resuelve ahora a: ${JSON.stringify(estado.sectorResuelto)}.`,
        tenant: estado,
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
