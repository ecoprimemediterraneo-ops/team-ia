// El nombre de la cookie de sesión y su clave de firma, SIN `next/headers`.
//
// POR QUÉ ESTÁ SEPARADO DE `auth.ts`
// ----------------------------------
// `auth.ts` importa `cookies()` de `next/headers`, y eso no se puede usar desde
// un middleware. El middleware necesita las dos mismas cosas —el nombre de la
// cookie y el secreto con el que se firma— para saber si una sesión sirve antes
// de dejar pasar a `/dashboard`.
//
// La alternativa era copiar el nombre y el secreto en el middleware, y ese es
// justo el tipo de copia que un día se queda vieja: se rota `AUTH_SECRET` en un
// sitio y el otro sigue validando contra el anterior. Aquí hay una sola verdad y
// la importan los dos.

/** El nombre de la cookie de sesión. Un solo sitio donde se escribe. */
export const COOKIE_SESION = "team_ia_session";

/**
 * True SOLO en desarrollo local (nunca en Vercel/producción).
 * Doble candado: `next dev` es "development", y en Vercel siempre existe VERCEL.
 * Si CUALQUIERA de las dos falla, no hay bypass. Fail-safe: en la duda, protege.
 */
export function isLocalDev(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

// Clave de firma de los JWT de sesión. En producción DEBE venir de AUTH_SECRET;
// si falta, abortamos (fail-safe) en vez de firmar con un secreto público conocido
// —eso permitiría a cualquiera forjar sesiones—. En desarrollo local se admite un
// valor por defecto para poder arrancar sin configurar nada.
//
// LAZY a propósito: se resuelve al firmar/verificar (runtime), NO al importar el
// módulo. Así el `next build` (que importa este módulo para recopilar metadatos, en
// un entorno donde AUTH_SECRET puede no estar) no rompe; solo una petición real en
// producción sin AUTH_SECRET fallará.
let _secret: Uint8Array | null = null;
export function getSecretSesion(): Uint8Array {
  if (_secret) return _secret;
  const raw = process.env.AUTH_SECRET || (isLocalDev() ? "team-ia-dev-secret-change-in-prod" : null);
  if (!raw) {
    throw new Error(
      "AUTH_SECRET no está configurada en producción. Abortando: no firmamos JWT con un secreto por defecto público.",
    );
  }
  _secret = new TextEncoder().encode(raw);
  return _secret;
}
