// EL CANDADO: en desarrollo no se sale a Meta. Nunca.
//
// POR QUÉ EXISTE
// --------------
// Media docena de ficheros construían la URL del Graph a mano
// (`https://graph.facebook.com/v21.0/...`). Con eso, en cuanto hubiera un token
// de verdad en el `.env.local` del portátil, cualquier botón del panel —mandar
// un documento, contestar un WhatsApp, publicar en Instagram— salía a Meta DE
// VERDAD, a clientes de verdad, desde una máquina de desarrollo. Y no había
// forma de darse cuenta hasta que el cliente contestaba.
//
// Ahora la URL se pide aquí y aquí se decide:
//   - en producción, el Graph real, pase lo que pase;
//   - en local con META_GRAPH_URL, el Graph de mentira (127.0.0.1:4545);
//   - en local sin META_GRAPH_URL, NADA: quien llama tiene que simular.
//
// `META_GRAPH_URL` se ignora en Vercel A PROPÓSITO: una variable capaz de
// redirigir llamadas que llevan el token dentro sería un agujero en producción.
//
// LO QUE ESTE CANDADO NO TAPA, Y NO DEBE TAPAR
// --------------------------------------------
// Las rutas de diagnóstico de /api/admin (marta-test-calls, instagram-app-review,
// meta-firma). Existen justamente para hablar con el Meta REAL y comprobar qué
// host y qué token responden: son las que se graban para el App Review. Meterlas
// aquí las convertiría en un espejo que siempre dice que sí.

/**
 * Doble candado, el mismo que usan `auth.ts` y `gestoria-adjuntos.ts`:
 * NODE_ENV no es production Y no existe VERCEL. Las dos cosas juntas no pueden
 * darse en producción.
 */
export function esLocal(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

/** La versión del Graph que usa todo el repo. Un solo sitio. */
export const GRAPH_VERSION = "v21.0";

/**
 * La base del Graph de Facebook, o `null` si estamos en local y no hay Graph de
 * mentira configurado.
 *
 * `null` significa "no llames a nadie": quien lo recibe tiene que escribir en
 * consola y devolver un resultado simulado. Devolver la URL real ahí sería
 * exactamente el fallo que este fichero viene a cerrar.
 */
export function baseGraph(version: string = GRAPH_VERSION): string | null {
  if (esLocal()) {
    const falso = process.env.META_GRAPH_URL;
    return falso ? falso.replace(/\/+$/, "") : null;
  }
  return `https://graph.facebook.com/${version}`;
}

/** Igual que `baseGraph`, para el host de Instagram. */
export function baseGraphInstagram(version: string = GRAPH_VERSION): string | null {
  if (esLocal()) {
    const falso = process.env.META_GRAPH_URL;
    return falso ? falso.replace(/\/+$/, "") : null;
  }
  return `https://graph.instagram.com/${version}`;
}

/**
 * Lo que se devuelve cuando en local no hay a quién llamar. Se escribe en
 * consola para que en el terminal se vea EXACTAMENTE lo que habría salido.
 */
export function simulado(quien: string, que: unknown): { simulado: true; enviado: false } {
  console.warn(`[${quien}] LOCAL sin META_GRAPH_URL: no se llama a Meta. Simulado:`, JSON.stringify(que));
  return { simulado: true, enviado: false };
}
