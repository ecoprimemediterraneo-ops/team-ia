import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { COOKIE_SESION, getSecretSesion, isLocalDev } from "./sesion-jwt";

// El nombre de la cookie, el secreto y `isLocalDev` viven en `sesion-jwt.ts`,
// que no importa `next/headers`: el middleware necesita esos tres y no puede
// cargar este módulo. Se reexportan para no romper a quien ya los importaba de
// aquí.
const COOKIE = COOKIE_SESION;
const getSecret = getSecretSesion;
export { isLocalDev };

// Dueño por defecto para desarrollo local (coincide con el fallback de tenants.ts).
const DEV_OWNER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

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
 *
 * TODO el panel (`/dashboard/**`) usa ESTA y no `getSession()`. Antes iba a medias
 * —el layout con bypass y la mayoría de páginas sin él— y el resultado en local era
 * que entrabas al panel pero cada página te echaba al login; peor aún, cambiar de
 * cuenta parecía roto porque el redirigido aterriza en `/dashboard`, que era una de
 * las que echaba. Fuera del panel (rutas de admin, API) cada sitio elige.
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
