/**
 * Verificación uniforme de autenticación para crons.
 * - Acepta `Authorization: Bearer <CRON_SECRET>` (formato Vercel Cron)
 * - Si `CRON_SECRET` no está definido en producción, devuelve 401 (cerrado por defecto).
 * - En dev (NODE_ENV !== production) permite la llamada para facilitar testing local.
 */
export function checkCronAuth(req: Request): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "CRON_SECRET no configurado" };
    }
    return { ok: true };
  }
  if (auth === `Bearer ${secret}` || auth.includes(secret)) {
    return { ok: true };
  }
  return { ok: false, reason: "Unauthorized" };
}
