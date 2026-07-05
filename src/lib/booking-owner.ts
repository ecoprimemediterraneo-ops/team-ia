// Autorización del panel del negocio (Biz): el usuario logueado debe ser el
// dueño (su email = la cuenta Google del negocio). En desarrollo local,
// requireSessionLocal entra con el dueño por defecto (ver auth.ts).
import { headers } from "next/headers";
import { requireSessionLocal } from "./auth";
import { getBusinessBySlug, resolveCalendarEmail, type BusinessBooking } from "./booking";
import { getRedirectUri } from "./gmail";

export type OwnerAuth =
  | { ok: true; business: BusinessBooking; email: string }
  | { ok: false; status: number; error: string };

export async function authorizeOwner(slug: string): Promise<OwnerAuth> {
  let email: string;
  try {
    ({ email } = await requireSessionLocal());
  } catch {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  const business = await getBusinessBySlug(slug);
  if (!business) return { ok: false, status: 404, error: "not_found" };
  const owner = await resolveCalendarEmail(business);
  if (email.toLowerCase() !== owner.toLowerCase()) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true, business, email };
}

/** redirectUri de Google coherente con el resto de rutas booking (host/proto reales). */
export async function ownerRedirectUri(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return getRedirectUri(host, proto);
}
