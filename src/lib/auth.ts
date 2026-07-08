import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "team_ia_session";

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
function getSecret(): Uint8Array {
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
