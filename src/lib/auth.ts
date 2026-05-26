import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Lazy: solo verifica al usar la sesión, no al cargar el módulo (evita romper el build).
let _SECRET: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (_SECRET) return _SECRET;
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    // En runtime de producción real, esto SÍ debe romper.
    if (process.env.VERCEL_ENV === "production") {
      throw new Error("AUTH_SECRET no configurado (mínimo 16 chars)");
    }
    _SECRET = new TextEncoder().encode("team-ia-dev-secret-change-in-prod-padding-extra");
    return _SECRET;
  }
  _SECRET = new TextEncoder().encode(s);
  return _SECRET;
}
const COOKIE = "team_ia_session";

export async function createSession(email: string) {
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const c = await cookies();
  c.delete(COOKIE);
}

export async function getSession(): Promise<{ email: string } | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { email: payload.email as string };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<{ email: string }> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}

/**
 * Lista de emails con permisos founder/admin.
 * Centralizado aquí — único lugar a editar si añadimos co-founders.
 */
const FOUNDER_EMAILS = new Set([
  (process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com").toLowerCase(),
  "crisasky@gmail.com",
]);

export function isFounder(email: string | null | undefined): boolean {
  if (!email) return false;
  return FOUNDER_EMAILS.has(email.toLowerCase());
}

export function getFounderEmails(): string[] {
  return [...FOUNDER_EMAILS];
}
