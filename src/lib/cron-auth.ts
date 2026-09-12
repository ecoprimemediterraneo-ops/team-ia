import { NextResponse } from "next/server";

/**
 * Autorización de los endpoints de cron. ÚNICA PUERTA: no hay dos maneras de
 * hacer esto.
 *
 * POR QUÉ ESTÁ CENTRALIZADO
 * -------------------------
 * Convivían dos patrones. Uno cerraba bien; el otro era
 * `if (expected && !auth.includes(expected))`, que sin `CRON_SECRET` en el
 * entorno NO COMPRUEBA NADA y deja la ruta abierta a cualquiera. Con ese
 * patrón estaban `/api/cron/eva-dispatcher` —que manda correos a clientes
 * finales— y `/api/cron/eval`. Una ruta que escribe a clientes no puede
 * depender de que alguien se acuerde de poner una variable.
 *
 * REGLAS
 * ------
 * - En Vercel (producción y preview) SIEMPRE se exige secreto.
 * - Si `CRON_SECRET` no está configurada, se RECHAZA con 500. Nunca se cae a
 *   un valor por defecto ni se abre "porque no hay secreto".
 * - En desarrollo local (sin VERCEL) no se exige nada: probar a mano no puede
 *   costar un token.
 *
 * El secreto se acepta por las tres vías que ya se usaban, para no romper los
 * disparos de n8n que llevan meses funcionando:
 *   - `Authorization: Bearer <secreto>`  ← la que manda Vercel Cron sola
 *   - cabecera `x-cron-secret: <secreto>`
 *   - parámetro `?secret=<secreto>`
 *
 * Devuelve un NextResponse de error si NO está autorizado, o null si OK.
 */
export function cronAuthError(req: Request): NextResponse | null {
  if (!process.env.VERCEL) return null; // dev local: sin auth

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Nunca autenticar con un secreto por defecto conocido. Fail-safe.
    return NextResponse.json({ error: "cron_secret_no_configurado" }, { status: 500 });
  }

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const cabecera = req.headers.get("x-cron-secret") || "";
  let queryParam = "";
  try {
    queryParam = new URL(req.url).searchParams.get("secret") || "";
  } catch {
    /* url rara: se queda vacío y no autoriza */
  }

  if (bearer !== secret && cabecera !== secret && queryParam !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
