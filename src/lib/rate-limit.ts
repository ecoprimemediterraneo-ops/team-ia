/**
 * Rate limiter en memoria, por IP + bucket.
 * Funciona dentro de UNA instancia serverless. Si Vercel escala a N lambdas,
 * cada una tiene su propio contador → el límite real es N × LIMIT.
 * Suficiente para V1 con tráfico bajo. Migrar a Upstash cuando haya volumen real.
 */

type Bucket = { count: number; resetAt: number };
const stores = new Map<string, Map<string, Bucket>>();

export function rateLimit(opts: {
  key: string; // bucket name, e.g. "diagnostico"
  ip: string;
  limit: number; // máx requests
  windowMs: number; // ventana en ms
}): { ok: boolean; remaining: number; resetIn: number } {
  const { key, ip, limit, windowMs } = opts;
  let store = stores.get(key);
  if (!store) {
    store = new Map();
    stores.set(key, store);
  }
  const now = Date.now();
  const bucket = store.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetIn: windowMs };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetIn: bucket.resetAt - now };
  }

  bucket.count++;
  return { ok: true, remaining: limit - bucket.count, resetIn: bucket.resetAt - now };
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
