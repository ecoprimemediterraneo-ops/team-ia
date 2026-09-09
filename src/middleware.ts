// El único trabajo de este middleware: que llegar al login desde una pantalla
// del panel no borre la pantalla de la que venías.
//
// EL PROBLEMA
// -----------
// `dashboard/layout.tsx` hace `redirect("/login")` cuando no hay sesión válida.
// Un layout no conoce la URL de la petición, así que no puede decir de dónde
// venía nadie: se perdían la pantalla, la pestaña y el idioma. Con el panel en
// inglés eso significa que una sesión caducada a mitad de grabar el vídeo del
// App Review de Meta te devuelve a la portada en castellano.
//
// Un middleware sí ve la URL. Redirige a `/login?volver=…` y el login devuelve
// ahí después de identificarse.
//
// LO QUE ESTE MIDDLEWARE NO ES
// ----------------------------
// NO es la autorización del panel. `dashboard/layout.tsx` sigue comprobando la
// sesión exactamente igual que antes y sigue siendo quien manda: esto se limita
// a adelantar el mismo "no" para poder adjuntar el `volver`. Si algún día este
// fichero desaparece, el panel sigue igual de protegido.
//
// Solo mira `/dashboard`. Todo lo demás pasa sin tocarse.

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_SESION, getSecretSesion, isLocalDev } from "@/lib/sesion-jwt";
import { PARAM_VOLVER } from "@/lib/volver";

export async function middleware(req: NextRequest) {
  // El bypass de desarrollo local entra sin cookie (`getSessionLocal`). Si aquí
  // se redirigiera por no encontrarla, el panel dejaría de abrirse en local.
  if (isLocalDev()) return NextResponse.next();

  const token = req.cookies.get(COOKIE_SESION)?.value;
  let vale = false;
  if (token) {
    try {
      await jwtVerify(token, getSecretSesion());
      vale = true;
    } catch {
      // Caducado, firmado con otro secreto o manipulado. Da igual cuál de las
      // tres: para el usuario es "vuelve a entrar".
      vale = false;
    }
  }
  if (vale) return NextResponse.next();

  const volver = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const destino = new URL("/login", req.url);
  destino.searchParams.set(PARAM_VOLVER, volver);
  // El idioma va aparte: la pantalla de login tiene que salir en inglés aunque
  // el destino no llevara el parámetro.
  if (req.nextUrl.searchParams.get("lang") === "en") destino.searchParams.set("lang", "en");
  // Para poder decir por qué está aquí, en vez de soltarle un login a secas.
  destino.searchParams.set("caducada", "1");
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
