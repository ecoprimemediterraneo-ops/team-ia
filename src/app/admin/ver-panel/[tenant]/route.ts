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
//
// ?volver=<ruta> — A DÓNDE SE VUELVE DESPUÉS.
//
// Antes se volvía SIEMPRE a `/dashboard` pelado, y eso borraba la pantalla en la
// que estabas y todos sus parámetros. Los dos que duelen: `?lang=en`, que dejaba
// el panel en castellano a mitad de grabar el vídeo del App Review de Meta, y
// `?tab=…`, que te devolvía a la portada en vez de a la pestaña que estabas
// enseñando. Lo pone el selector de cuenta (`EnlaceCuenta.tsx`).
//
// Se valida: solo rutas de este mismo sitio y solo dentro de `/dashboard`. Un
// parámetro que dice a dónde redirigir y no se comprueba es un sitio desde el
// que mandar a la gente a cualquier parte con nuestro dominio delante.

import { NextResponse } from "next/server";
import { getSessionLocal } from "@/lib/auth";
import { getTenant } from "@/lib/tenants";
// La lista de emails con permiso vive en panel-contexto y se importa: aquí había una
// copia y en el selector de cuenta habría hecho falta una tercera.
import { COOKIE_VER_PANEL, esFundadorEmail as esFundador, esLocal } from "@/lib/panel-contexto";

export const dynamic = "force-dynamic";

/** A qué pantalla se vuelve. `/dashboard` ante cualquier cosa que no convenza. */
function aDondeVolver(req: Request): string {
  const pedido = new URL(req.url).searchParams.get("volver");
  if (!pedido) return "/dashboard";
  try {
    // Se resuelve contra la petición: así una dirección absoluta a otro dominio
    // se detecta comparando el origen, y `//otrositio.com` —que el navegador
    // lee como absoluta— tampoco cuela.
    const u = new URL(pedido, req.url);
    const propio = new URL(req.url);
    if (u.origin !== propio.origin) return "/dashboard";
    if (u.pathname !== "/dashboard" && !u.pathname.startsWith("/dashboard/")) return "/dashboard";
    return `${u.pathname}${u.search}`;
  } catch {
    return "/dashboard";
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const s = await getSessionLocal();
  if (!s) return NextResponse.redirect(new URL("/login", req.url));
  if (!esFundador(s.email) && !esLocal()) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const { tenant } = await params;
  const destino = NextResponse.redirect(new URL(aDondeVolver(req), req.url));

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
