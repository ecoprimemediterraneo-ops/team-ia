// La vuelta de Instagram. NO ES FOUNDER-ONLY: aquí aterriza cualquier cliente
// que acabe de autorizar su cuenta.
//
// Recibe el `code`, lo canjea por el token de 60 días y lo guarda A NOMBRE DEL
// TENANT. Después DEVUELVE AL CLIENTE A SU PANEL, a /dashboard/marta/conectar.
// Antes esta ruta pintaba una página HTML de diagnóstico con permisos, fbtrace y
// enlaces a rutas de administración: útil para el fundador, pero un cliente que
// acaba de conectar su Instagram tiene que aterrizar en su panel, no en una
// pantalla de servicio.
//
// DE QUIÉN ES ESTA CONEXIÓN LO DICE EL `state`, NO LA SESIÓN NI LA COOKIE.
// El `state` viene firmado con el tenantId dentro (ver `crearState`), así que la
// vuelta se atribuye bien aunque el navegador haya perdido la sesión por el
// camino —que entre dominios pasa—. La cookie se comprueba además, como segundo
// candado contra vueltas que no ha empezado el usuario. Sin firma válida no se
// guarda nada: si no, cualquiera podría hacer que la cuenta que autoriza acabe
// colgada del tenant de otro.
//
// LO QUE VIAJA EN LA URL DE VUELTA ES UN CÓDIGO CORTO, NO EL ERROR DE META.
// El mensaje de Instagram puede traer el token dentro, y una URL se queda en el
// historial del navegador, en los logs del proxy y en la barra de direcciones
// mientras se graba un vídeo. El motivo entero, ya tapado, va al log del
// servidor; al cliente se le enseña una frase en cristiano (ver ERRORES en la
// pantalla).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { canjearCodigo, leerState, tapar, COOKIE_STATE } from "@/lib/instagram-login";
import { idiomaDe, COOKIE_IDIOMA } from "@/lib/idioma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PANTALLA = "/dashboard/marta/conectar";

async function volver(req: Request, params: Record<string, string>): Promise<NextResponse> {
  const destino = new URL(PANTALLA, req.url);
  for (const [k, v] of Object.entries(params)) destino.searchParams.set(k, v);

  // El idioma con el que se empezó, recuperado de la galleta que puso el login.
  // Sin esto, la grabación del App Review volvería en español justo al aterrizar
  // de Instagram, que es el momento que hay que enseñar.
  const idioma = idiomaDe((await cookies()).get(COOKIE_IDIOMA)?.value);
  if (idioma === "en") destino.searchParams.set("lang", "en");

  return NextResponse.redirect(destino, { status: 302 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    console.error(
      `[instagram-login] callback RECHAZADO por Instagram tenant=${leerState(state)?.tenantId ?? "?"}: ` +
        `${tapar(error)} · ${tapar(url.searchParams.get("error_reason") ?? "")} · ` +
        `${tapar(url.searchParams.get("error_description") ?? "")}`,
    );
    return await volver(req, { error: "cancelado" });
  }

  if (!code) {
    // Alguien ha abierto esta dirección a mano. No es un fallo del cliente.
    console.warn("[instagram-login] callback abierto sin código");
    return await volver(req, { error: "vuelta" });
  }

  // 1. La FIRMA del `state`: es quien dice de qué cliente es esta conexión.
  const firmado = leerState(state);
  if (!firmado) {
    console.error("[instagram-login] callback con state sin firma válida — no se guarda nada");
    return await volver(req, { error: "vuelta" });
  }
  const tenantId = firmado.tenantId;

  // 2. La cookie, como segundo candado. Aunque la firma cuadre, esta vuelta
  //    tiene que ser la misma que salió de este navegador hace menos de diez
  //    minutos.
  const galletas = await cookies();
  const esperado = galletas.get(COOKIE_STATE)?.value;
  if (!esperado || esperado !== state) {
    console.error(`[instagram-login] callback FALLIDO tenant=${tenantId}: la cookie de state no cuadra`);
    return await volver(req, { error: "vuelta" });
  }
  galletas.delete(COOKIE_STATE);

  const r = await canjearCodigo(tenantId, code);

  if (!r.ok) {
    // El error de Meta, literal y con el tenant delante. `tapar` le quita el
    // token, el código y los secretos: sin esto, un fallo de canje escribe el
    // token entero en los logs de Vercel.
    console.error(`[instagram-login] callback FALLIDO tenant=${tenantId}: ${tapar(r.error)}`);

    // Tres causas que al cliente le pasan cosas distintas, así que se separan.
    const motivo = /INSTAGRAM_APP_ID|INSTAGRAM_APP_SECRET/.test(r.error)
      ? "credenciales"
      : /no se puede guardar|NO se ha guardado|Supabase/.test(r.error)
        ? "guardado"
        : "canje";
    return await volver(req, { error: motivo });
  }

  console.log(
    `[instagram-login] callback OK tenant=${tenantId} cuenta=@${r.valor.usuario ?? "?"} ` +
      `ig_user_id=${r.valor.user_id || "?"} caduca=${r.valor.caduca_en} ` +
      `permisos=${r.valor.permisos.join("|") || "ninguno"}`,
  );

  return await volver(req, { ok: "1", ...(r.valor.usuario ? { cuenta: r.valor.usuario } : {}) });
}
