// /dashboard/redes/conectar → la pestaña "Empezar cuenta" de Marta.
//
// AQUÍ HABÍA UN MANUAL DE INSTRUCCIONES, NO UNA HERRAMIENTA. Le decía al cliente
// que fuera a business.facebook.com, verificara la empresa, creara una app en
// developers.facebook.com, sacara un long-lived token del Graph API Explorer y
// lo pegara en las variables de entorno de Vercel. Enseñaba, literalmente, un
// bloque `META_ACCESS_TOKEN=EAAxxxxx…` para copiar.
//
// Eso ya no es como se conecta una cuenta: desde los bloques 1 a 3, el cliente
// pulsa un botón, autoriza en Instagram y confirma su cuenta, sin ver un token
// en su vida. Y sobre todo, esta pantalla dice a un revisor de Meta exactamente
// lo contrario de lo que el App Review quiere ver — que la aplicación tiene un
// flujo de login propio y no se apaña con tokens pegados a mano.
//
// LA RUTA NO SE BORRA, REDIRIGE. Borrarla dejaría un 404 en cualquier marcador o
// enlace antiguo; redirigiendo, quien llegue acaba donde se conecta de verdad.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConectarRedesPage() {
  redirect("/dashboard/marta?tab=arranque");
}
