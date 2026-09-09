// Cerrar sesión.
//
// DOS COSAS CAMBIAN AQUÍ, Y LA PRIMERA ERA UN FALLO A SECAS:
//
//   1. Antes devolvía `{"ok":true}` como JSON. El botón del panel es un `<form>`
//      nativo sin JavaScript, así que al pulsar SALIR el navegador se quedaba
//      enseñando ese JSON en una página en blanco. Ahora redirige al login, que
//      es lo que espera cualquiera que pulsa "salir".
//   2. Se lleva puesta la pantalla en la que estabas (`volver`) y el idioma,
//      para que al volver a entrar aterrices donde estabas y en el mismo idioma.
//      Sin eso, cerrar sesión a mitad de grabar el vídeo del App Review de Meta
//      te devolvía a la portada en castellano.
//
// El destino NO se comprueba aquí: se pasa tal cual al login y es él quien lo
// valida al redirigir, con `destinoSeguro`. Comprobarlo en los dos sitios sería
// tener la misma regla en dos manos.

import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { PARAM_VOLVER } from "@/lib/volver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await destroySession();

  const form = await req.formData().catch(() => null);
  const q = new URLSearchParams();
  const volver = String(form?.get(PARAM_VOLVER) || "");
  const lang = String(form?.get("lang") || "");
  if (volver) q.set(PARAM_VOLVER, volver);
  if (lang === "en") q.set("lang", "en");

  const destino = q.toString() ? `/login?${q.toString()}` : "/login";
  // 303 y no 307: tras un POST hay que forzar que el navegador pida la página
  // siguiente con GET. Con 307 repetiría el POST contra el login.
  return NextResponse.redirect(new URL(destino, req.url), 303);
}
