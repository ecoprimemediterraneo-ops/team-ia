// POST /api/perfil/sector  body: { sector: "dental" | "estetica" | "vendedor" }
// Cambia el sector del agente conversacional del tenant del usuario.
// Single-tenant durante la beta → DEFAULT_TENANT_ID.

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID, setTenantSector } from "@/lib/tenants";
import { isSectorKey } from "@/lib/sector-prompts";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requireSession();
    const body = (await req.json().catch(() => ({}))) as { sector?: string };
    if (!isSectorKey(body.sector)) {
      return NextResponse.json({ error: "Sector no válido" }, { status: 400 });
    }
    const updated = await setTenantSector(DEFAULT_TENANT_ID, body.sector);
    if (!updated) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, sector: updated.sectorPrompt });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
