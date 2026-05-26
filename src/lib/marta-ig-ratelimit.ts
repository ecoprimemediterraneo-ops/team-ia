/**
 * Rate limit específico para envío de respuestas IG.
 * Reglas del prompt:
 *  - máx 1 mensaje cada 8s al MISMO usuario
 *  - máx 100 mensajes/hora globales
 *
 * En memoria por instancia. Para multi-instancia migrar a Redis/Supabase.
 */

type UserBucket = { lastAt: number };
type GlobalBucket = { count: number; resetAt: number };

const perUser = new Map<string, UserBucket>();
let global: GlobalBucket = { count: 0, resetAt: Date.now() + 3600_000 };

const USER_COOLDOWN_MS = 8_000;
const GLOBAL_LIMIT = 100;
const HOUR = 3600_000;

export function canSendIgMessage(igUserId: string): {
  ok: boolean;
  reason?: "user_cooldown" | "global_limit";
  waitMs?: number;
} {
  const now = Date.now();

  // Reset bucket global si expiró la ventana
  if (now >= global.resetAt) {
    global = { count: 0, resetAt: now + HOUR };
  }

  if (global.count >= GLOBAL_LIMIT) {
    return { ok: false, reason: "global_limit", waitMs: global.resetAt - now };
  }

  const user = perUser.get(igUserId);
  if (user && now - user.lastAt < USER_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "user_cooldown",
      waitMs: USER_COOLDOWN_MS - (now - user.lastAt),
    };
  }

  perUser.set(igUserId, { lastAt: now });
  global.count++;
  return { ok: true };
}
