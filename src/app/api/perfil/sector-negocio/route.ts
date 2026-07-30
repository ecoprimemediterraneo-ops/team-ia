// POST /api/perfil/sector-negocio — cambia el sector de un cliente ya dado de alta.
//
// Cambiar de sector reordena el panel, cambia los KPIs, el vocabulario y las
// prohibiciones de las IAs. Lo que NO hace es tocarle sus datos: sus servicios,
// su horario y sus fotos se conservan (ver `aplicarAltaDeSector`).

import { NextResponse } from "next/server";
import { requireSessionLocal } from "@/lib/auth";
import { aplicarAltaDeSector } from "@/lib/alta-sector";
import { esSectorNegocio } from "@/lib/sectores";

export async function POST(req: Request) {
  try {
    const { email } = await requireSessionLocal();
    const { sector } = await req.json();
    if (!esSectorNegocio(sector)) {
      return NextResponse.json({ error: "Sector no válido" }, { status: 400 });
    }
    const r = await aplicarAltaDeSector({ email, sector });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
