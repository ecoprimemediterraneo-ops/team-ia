import { NextResponse } from "next/server";

/**
 * Autorización de endpoints de cron. En Vercel (prod/preview) exige
 * `Authorization: Bearer <CRON_SECRET>`. Fail-closed: si CRON_SECRET NO está
 * configurada en producción, RECHAZA (500) en vez de caer a un valor por defecto
 * público. En desarrollo local (sin VERCEL) no exige nada.
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
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
