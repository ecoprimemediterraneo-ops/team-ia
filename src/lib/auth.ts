import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "team-ia-dev-secret-change-in-prod"
);
const COOKIE = "team_ia_session";

// Dueño por defecto para desarrollo local (coincide con el fallback de tenants.ts).
const DEV_OWNER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

/**
 * True SOLO en desarrollo local (nunca en Vercel/producción).
 * Doble candado por seguridad:
 *   - NODE_ENV !== "production": `next dev` es "development"; cualquier build
 *     desplegado (Vercel prod o preview) es "production".
 *   - !process.env.VERCEL: en Vercel esta variable está siempre presente.
 * Si CUALQUIERA de las dos falla, no hay bypass. Fail-safe: en la duda, protege.
 */
export function isLocalDev(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

export async function createSession(email: string) {
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
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
    const { payload } = await jwtVerify(token, SECRET);
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

let avisadoDevBypass = false;

/**
 * Como getSession(), pero en desarrollo local devuelve un dueño por defecto
 * cuando no hay sesión, para poder entrar al panel sin magic link.
 * En producción es idéntico a getSession() (el ramo dev nunca se ejecuta).
 */
export async function getSessionLocal(): Promise<{ email: string; dev?: boolean } | null> {
  const s = await getSession();
  if (s) return s;
  if (isLocalDev()) {
    if (!avisadoDevBypass) {
      console.warn(`[auth] ⚠️ BYPASS DE DESARROLLO LOCAL activo — sesión por defecto: ${DEV_OWNER_EMAIL}. Esto NUNCA ocurre en producción.`);
      avisadoDevBypass = true;
    }
    return { email: DEV_OWNER_EMAIL, dev: true };
  }
  return null;
}

/** Igual que requireSession(), con el mismo bypass de desarrollo local. */
export async function requireSessionLocal(): Promise<{ email: string; dev?: boolean }> {
  const s = await getSessionLocal();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}
