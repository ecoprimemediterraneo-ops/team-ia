// Contexto del panel: a qué tenant pertenece quien mira y, por tanto, qué
// sector manda.
//
// Existe porque el layout del panel NO recibe los parámetros de la URL (en el
// App Router los layouts no ven searchParams). Para poder enseñar los cuatro
// sectores en local sin crear cuatro logins, el tenant a mirar se guarda en una
// cookie que pone `/admin/ver-panel/<tenant>`.
//
// La cookie SOLO se respeta si quien mira es el fundador o si estamos en
// desarrollo local. Un cliente nunca puede mirar el panel de otro cambiando una
// cookie.

import "server-only";
import { cookies } from "next/headers";
import { getSessionLocal } from "./auth";
import { getTenant, resolverTenantDeUsuario, DEFAULT_TENANT_ID, type Tenant } from "./tenants";
import {
  getPerfilSector,
  resolverSector,
  VOCABULARIO_NEUTRO,
  type PerfilSector,
  type SectorNegocio,
  type Vocabulario,
} from "./sectores";

export const COOKIE_VER_PANEL = "aiteam_ver_panel";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
const esFundador = (email: string) => email === FOUNDER_EMAIL || email === "crisasky@gmail.com";

function esLocal(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

export type ContextoPanel = {
  email: string;
  tenantId: string;
  tenant: Tenant | null;
  /** null = cuenta comercial de AI-Team (no es un negocio de cliente). */
  sector: SectorNegocio | null;
  perfil: PerfilSector;
  /**
   * Palabras a usar en los textos del panel. SIEMPRE esta, nunca
   * `perfil.vocabulario` directamente: sin sector, el perfil cae al del salón y
   * le hablaría de "clientas" a una clínica.
   */
  vocabulario: Vocabulario;
  /** true si se está mirando el panel de OTRO tenant con la cookie de prueba. */
  mirandoOtro: boolean;
};

/** Neutro si el negocio no tiene sector; el del sector si lo tiene. */
function vocabularioDe(sector: SectorNegocio | null): Vocabulario {
  return sector ? getPerfilSector(sector).vocabulario : VOCABULARIO_NEUTRO;
}

/** Resuelve a quién pertenece el panel que se está pintando. Nunca lanza. */
export async function resolverContextoPanel(): Promise<ContextoPanel | null> {
  const s = await getSessionLocal();
  if (!s) return null;

  const propio = await resolverTenantDeUsuario(s.email);
  let tenantId = propio;
  let mirandoOtro = false;

  // Suplantación de solo lectura, para revisar cada sector.
  if (esFundador(s.email) || esLocal()) {
    const c = await cookies();
    const pedido = c.get(COOKIE_VER_PANEL)?.value;
    if (pedido && pedido !== propio && (await getTenant(pedido))) {
      tenantId = pedido;
      mirandoOtro = true;
    }
  }

  const tenant = await getTenant(tenantId);
  const sector = tenant ? resolverSector(tenant) : null;

  return {
    email: s.email,
    tenantId,
    tenant,
    sector,
    perfil: getPerfilSector(sector),
    vocabulario: vocabularioDe(sector),
    mirandoOtro,
  };
}

/** Contexto con caída al tenant por defecto, para pantallas que no pueden fallar. */
export async function contextoPanelODefecto(): Promise<ContextoPanel> {
  const c = await resolverContextoPanel();
  if (c) return c;
  const tenant = await getTenant(DEFAULT_TENANT_ID);
  const sector = tenant ? resolverSector(tenant) : null;
  return {
    email: "",
    tenantId: DEFAULT_TENANT_ID,
    tenant,
    sector,
    perfil: getPerfilSector(sector),
    vocabulario: vocabularioDe(sector),
    mirandoOtro: false,
  };
}
