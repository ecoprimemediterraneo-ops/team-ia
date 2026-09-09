// A DÓNDE SE VUELVE: la validación del parámetro `?volver=`, en un solo sitio.
//
// POR QUÉ EXISTE ESTE FICHERO
// ---------------------------
// Esta comprobación nació dentro de `/admin/ver-panel/[tenant]/route.ts`, para
// que cambiar de cuenta no te borrara la pantalla en la que estabas. Ahora hace
// falta lo mismo en el login: si cierras sesión con el panel en inglés y en una
// pestaña concreta, al volver a entrar tienes que aterrizar donde estabas —y no
// en `/dashboard` pelado y en castellano—, porque el vídeo del App Review de
// Meta se graba de una sentada y tiene que ir entero en inglés.
//
// Dos sitios que deciden a dónde redirigir con un parámetro de la URL son dos
// sitios donde se puede colar un destino ajeno. Y si la comprobación se copia,
// se arregla una copia y la otra se queda abierta. Por eso vive aquí sola.
//
// QUÉ SE RECHAZA, Y POR QUÉ CADA COSA:
//   · Otro dominio (`https://evil.example/x`): mandaría a la gente fuera con
//     nuestra dirección delante, que es la mitad de una estafa por enlace.
//   · Protocolo relativo (`//evil.example/x`): el navegador lo lee como
//     absoluto aunque empiece por barra. Es el que se cuela cuando la
//     comprobación se hace mirando si el texto empieza por "/".
//   · Cualquier ruta fuera de `/dashboard` (`/admin/secreto`): no es un agujero
//     de seguridad —esas pantallas comprueban la sesión por su cuenta— pero un
//     parámetro que puede apuntar a media aplicación es un parámetro que un día
//     apunta a donde no debe.
//
// Ante CUALQUIER duda se devuelve `/dashboard`. Nunca se lanza un error: esto
// decide a dónde va alguien que acaba de identificarse bien, y dejarle en una
// pantalla de fallo por un parámetro raro sería peor que llevarle a la portada.

/** El nombre del parámetro. Uno solo, para que no haya dos maneras de decirlo. */
export const PARAM_VOLVER = "volver";

/** El destino de siempre cuando no hay nada válido a lo que volver. */
export const DESTINO_POR_DEFECTO = "/dashboard";

/**
 * Convierte lo que venga en `?volver=` en una ruta segura de este mismo sitio.
 *
 * @param pedido lo que traía el parámetro (puede ser null, vacío o basura)
 * @param base   una URL de esta misma petición, para comparar el origen
 */
export function destinoSeguro(pedido: string | null | undefined, base: string | URL): string {
  if (!pedido) return DESTINO_POR_DEFECTO;
  try {
    // Se resuelve contra la petición: así una dirección absoluta a otro dominio
    // se detecta comparando el origen, y `//otrositio.com` —que el navegador
    // lee como absoluta— tampoco cuela.
    const u = new URL(pedido, base);
    const propio = new URL(base);
    if (u.origin !== propio.origin) return DESTINO_POR_DEFECTO;
    if (u.pathname !== "/dashboard" && !u.pathname.startsWith("/dashboard/")) return DESTINO_POR_DEFECTO;
    return `${u.pathname}${u.search}`;
  } catch {
    return DESTINO_POR_DEFECTO;
  }
}

/** Lo mismo, leyendo el parámetro de la propia petición. */
export function destinoSeguroDePeticion(req: Request): string {
  return destinoSeguro(new URL(req.url).searchParams.get(PARAM_VOLVER), req.url);
}
