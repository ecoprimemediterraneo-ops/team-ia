// GET /admin/ver-panel/<tenantId> — mira el panel como ese cliente.
//
// Deja una cookie con el tenant a mirar y lleva al panel. Sirve para revisar los
// cuatro sectores sin crear cuatro cuentas.
//
// Solo para el fundador (o en desarrollo local). La cookie por sí sola no vale:
// `resolverContextoPanel()` vuelve a comprobar quién eres en cada carga.
//
//   /admin/ver-panel/tenant_demo_salon    → panel de salón de belleza
//   /admin/ver-panel/propio               → vuelve a tu propio panel

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { getTenant } from "@/lib/tenants";
// La lista de emails con permiso vive en panel-contexto y se importa: aquí había una
// copia y en el selector de cuenta habría hecho falta una tercera.
import { COOKIE_VER_PANEL, esFundadorEmail as esFundador, esLocal } from "@/lib/panel-contexto";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const s = await getSessionLocal();
  if (!s) return NextResponse.redirect(new URL("/login", req.url));
  if (!esFundador(s.email) && !esLocal()) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const { tenant } = await params;
  const destino = NextResponse.redirect(new URL("/dashboard", req.url));

  if (tenant === "propio") {
    destino.cookies.delete(COOKIE_VER_PANEL);
    return destino;
  }

  if (!(await getTenant(tenant))) {
    return NextResponse.json({ error: `El tenant "${tenant}" no existe` }, { status: 404 });
  }

  destino.cookies.set(COOKIE_VER_PANEL, tenant, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return destino;
}
