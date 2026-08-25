// Manda a autorizar en Instagram. LA ABRE CUALQUIER CLIENTE CON SESIÓN.
//
// YA NO ES UNA RUTA DE FUNDADOR. Lo era mientras solo existía una cuenta
// conectada, la de la casa, y el token se guardaba en una clave única. Eso es
// justo lo que hacía que dar de alta a un cliente fueran horas de trabajo a
// mano. Ahora cada cliente entra aquí, autoriza SU cuenta de Instagram, y el
// token se guarda a su nombre en `instagram_login_token:<tenantId>`.
//
// Abrir esta dirección lleva a instagram.com, sale la pantalla de permisos de la
// cuenta del cliente, y al aceptar vuelve a /api/instagram/callback.
//
// EL `state` LLEVA EL TENANT DENTRO, FIRMADO. Antes era una cadena al azar que
// solo vivía en una cookie; con un cliente daba igual, con muchos no: a la
// vuelta hay que saber de quién es la conexión, y una cookie perdida entre
// dominios convertiría la cuenta de un cliente en la de otro. La cookie se sigue
// comprobando, pero como segundo candado.

import { NextResponse } from "next/server";
import { resolverContextoPanel } from "@/lib/panel-contexto";
import {
  configurado,
  credenciales,
  crearState,
  urlDeAutorizacion,
  REDIRECT_URI,
  SCOPES,
  COOKIE_STATE,
} from "@/lib/instagram-login";
import { idiomaDe, conIdioma, COOKIE_IDIOMA } from "@/lib/idioma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Sin sesión no hay tenant, y sin tenant no se sabe a nombre de quién guardar
  // el token. Se manda al login normal de la aplicación, no un 401 en JSON: aquí
  // aterriza un navegador, no una integración.
  // EL IDIOMA TIENE QUE SOBREVIVIR AL VIAJE A INSTAGRAM. Es el único punto del
  // flujo en el que se sale de la aplicación, así que se guarda en una galleta
  // con la misma vida que el `state` y el callback la recoge. Si se perdiera
  // aquí, la grabación del App Review volvería en español justo en el momento
  // más importante: el de la confirmación.
  const idioma = idiomaDe(new URL(req.url).searchParams.get("lang"));

  const ctx = await resolverContextoPanel();
  if (!ctx) {
    return NextResponse.redirect(new URL("/login", req.url), { status: 302 });
  }

  if (!configurado()) {
    // Al cliente se le devuelve a su pantalla con un aviso en cristiano, no un
    // JSON con nombres de variables: no es cosa suya y no puede arreglarlo. El
    // detalle exacto de qué falta va al log del servidor.
    const falta = [
      credenciales().appId ? null : "INSTAGRAM_APP_ID",
      credenciales().secret ? null : "INSTAGRAM_APP_SECRET",
    ].filter(Boolean);
    console.error(
      `[instagram-login] no se puede iniciar el login tenant=${ctx.tenantId}: faltan ${falta.join(", ")}. ` +
        `OJO: son los de Instagram (App Dashboard > Instagram > API setup with Instagram login), ` +
        `NO los de Meta. redirect que se usaría: ${REDIRECT_URI}`,
    );
    return NextResponse.redirect(
      new URL(conIdioma("/dashboard/marta/conectar?error=credenciales", idioma), req.url),
      { status: 302 },
    );
  }

  const state = crearState(ctx.tenantId);
  console.log(`[instagram-login] salida a autorizar tenant=${ctx.tenantId}`);

  // SameSite=Lax y no Strict: la vuelta la manda instagram.com, y con Strict la
  // cookie no viajaría en esa navegación. Entonces el callback vería un `state`
  // que no cuadra y culparía a un ataque que no existe.
  const seguro = REDIRECT_URI.startsWith("https://") ? " Secure;" : "";

  // Dos galletas = dos cabeceras `Set-Cookie`. Van con `append`, no juntas en
  // una sola cadena: un único `Set-Cookie` con las dos separadas por coma es
  // ambiguo —la fecha de caducidad también lleva comas— y hay proxies que se lo
  // comen entero.
  const cabeceras = new Headers({ "x-scopes-pedidos": SCOPES.join(",") });
  const galleta = `HttpOnly;${seguro} SameSite=Lax; Path=/; Max-Age=600`;
  cabeceras.append("Set-Cookie", `${COOKIE_STATE}=${state}; ${galleta}`);
  cabeceras.append("Set-Cookie", `${COOKIE_IDIOMA}=${idioma}; ${galleta}`);

  return NextResponse.redirect(urlDeAutorizacion(state), { status: 302, headers: cabeceras });
}
