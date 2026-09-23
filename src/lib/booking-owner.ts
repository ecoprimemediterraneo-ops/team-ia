// Autorización del panel del negocio (Biz): quien mira tiene que ser del
// MISMO TENANT que el negocio, no "su email = el email del calendario".
//
// Antes comparaba `email de sesión` contra `resolveCalendarEmail(business)`
// (el email de la cuenta de Google del negocio, con caída a
// `tenant.email` o al del fundador). Eso confundía dos cosas distintas: quién
// es dueño del negocio en AI-Team (el tenant) y de qué cuenta de Google cuelga
// su calendario — un dato que ni siquiera tiene por qué coincidir con el email
// de quien entra al panel (agencias, empleados con su propio login…). En los
// tenants demo directamente NUNCA coincidía (`demo-estetica@aiteam.local` no es
// el email de sesión de nadie), así que Pacientes daba 403 siempre, en
// producción igual que en local — no era un caso raro, era el camino normal.
//
// Ahora usa el MISMO criterio que ya resuelve el resto del panel
// (`resolverContextoPanel`, la que decide qué tenant ve `/dashboard`): sesión
// → tenant propio por `resolverTenantDeUsuario`, con la suplantación de solo
// lectura del fundador/local vía la cookie `aiteam_ver_panel` — la misma con la
// que ya se mira el panel de otro sector desde `/admin/ver-panel/<tenant>`. Un
// negocio autoriza a quien esté mirando el panel de SU tenant, y a nadie más.
import { headers } from "next/headers";
import { resolverContextoPanel } from "./panel-contexto";
import { getBusinessBySlug, type BusinessBooking } from "./booking";
import { getRedirectUri } from "./gmail";

export type OwnerAuth =
  | { ok: true; business: BusinessBooking; email: string }
  | { ok: false; status: number; error: string };

export async function authorizeOwner(slug: string): Promise<OwnerAuth> {
  const ctx = await resolverContextoPanel();
  if (!ctx) return { ok: false, status: 401, error: "unauthorized" };
  const business = await getBusinessBySlug(slug);
  if (!business) return { ok: false, status: 404, error: "not_found" };
  if (business.tenantId !== ctx.tenantId) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true, business, email: ctx.email };
}

/** redirectUri de Google coherente con el resto de rutas booking (host/proto reales). */
export async function ownerRedirectUri(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return getRedirectUri(host, proto);
}
