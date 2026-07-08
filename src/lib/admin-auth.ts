// Autorización de rutas de administración (founder). Reutiliza el bypass de
// desarrollo local (getSessionLocal): en local entra el founder por defecto; en
// prod exige sesión con el email del fundador.
import { getSessionLocal } from "./auth";

const FOUNDER_EMAILS = [
  (process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com").toLowerCase(),
  "crisasky@gmail.com",
];

export type FounderAuth = { ok: true; email: string } | { ok: false; status: number; error: string };

export async function requireFounder(): Promise<FounderAuth> {
  const s = await getSessionLocal();
  if (!s) return { ok: false, status: 401, error: "unauthorized" };
  if (!FOUNDER_EMAILS.includes(s.email.toLowerCase())) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true, email: s.email };
}
