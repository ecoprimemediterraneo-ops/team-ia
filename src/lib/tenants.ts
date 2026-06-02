// Tabla de tenants (clientes de AI-Team).
//
// Almacenado en kv_store bajo la clave "tenants" como Record<id, Tenant>.
// Fallback a fichero local data/tenants.json en dev (sin Supabase).
//
// Cimiento del informe mensual por cliente. Cada cliente AI-Team es un tenant:
// - Sus números de WhatsApp / cuentas IG → mapean a este tenant.
// - Sus leads en `pipeline` llevan `tenantId`.
// - Sus eventos van a `events:<tenantId>:<YYYY-MM>`.
//
// Durante la beta (50 plazas) la tabla cabe holgadamente en una sola clave.

import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "./supabase";

export type TenantPlan = "esencial" | "completo" | "pro";

export type Tenant = {
  id: string;                              // "tenant_aiteam", "tenant_clinicasonrisa", ...
  name: string;                            // "AI-Team (cuenta fundadora)"
  email: string;                           // contacto del propietario
  whatsappPhoneNumberId?: string;          // mapea Meta → tenant
  instagramUserId?: string;                // mapea Meta → tenant
  plan: TenantPlan;
  pricing: { monthlyEUR: number };
  startedAt: string;                       // ISO
  // Asunciones de cálculo (configurable por tenant):
  minutesPerInteraction: number;           // default 4
  conversionValueEUR: number;              // valor medio de un cliente cerrado (default 200)
};

const KV_KEY = "tenants";
const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "tenants.json");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

// Tenant por defecto al que se atribuye TODO lo existente y cualquier evento
// cuyo phone_number_id / instagram_user_id no resuelva a un tenant concreto.
export const DEFAULT_TENANT_ID = "tenant_aiteam";

// Seed inicial: AI-Team es el primer (y de momento único) tenant.
function seedTenants(): Record<string, Tenant> {
  return {
    [DEFAULT_TENANT_ID]: {
      id: DEFAULT_TENANT_ID,
      name: "AI-Team (cuenta fundadora)",
      email: process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com",
      whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      instagramUserId: process.env.INSTAGRAM_USER_ID,
      plan: "pro",
      pricing: { monthlyEUR: 0 },
      startedAt: new Date().toISOString(),
      minutesPerInteraction: 4,
      conversionValueEUR: 200,
    },
  };
}

type TenantMap = Record<string, Tenant>;

async function readAll(): Promise<TenantMap> {
  let data: TenantMap | null;
  if (USE_SUPABASE) {
    data = await kvGet<TenantMap>(KV_KEY);
  } else {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const raw = await fs.readFile(FILE, "utf-8").catch(() => "");
      data = raw.trim() ? (JSON.parse(raw) as TenantMap) : null;
    } catch {
      data = null;
    }
  }
  if (!data || !data[DEFAULT_TENANT_ID]) {
    // Seed idempotente: si no existe la clave o no contiene al fundador, lo creamos.
    data = { ...seedTenants(), ...(data ?? {}) };
    await writeAll(data);
  }
  return data;
}

async function writeAll(map: TenantMap): Promise<void> {
  if (USE_SUPABASE) {
    await kvSet(KV_KEY, map);
  } else {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(map, null, 2));
  }
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

export async function listTenants(): Promise<Tenant[]> {
  const all = await readAll();
  return Object.values(all);
}

export async function getTenant(id: string): Promise<Tenant | null> {
  const all = await readAll();
  return all[id] ?? null;
}

export async function upsertTenant(t: Tenant): Promise<Tenant> {
  const all = await readAll();
  all[t.id] = t;
  await writeAll(all);
  return t;
}

/**
 * Resuelve el tenantId a partir de un identificador de Meta (phone_number_id de
 * WhatsApp o instagram user id). Si no hay match, cae al tenant fundador.
 *
 * Se usa al recibir un webhook para imputar los eventos al cliente correcto.
 */
export async function resolveTenantFromMeta(input: {
  whatsappPhoneNumberId?: string;
  instagramUserId?: string;
}): Promise<string> {
  const all = await readAll();
  for (const t of Object.values(all)) {
    if (
      input.whatsappPhoneNumberId &&
      t.whatsappPhoneNumberId &&
      t.whatsappPhoneNumberId === input.whatsappPhoneNumberId
    ) {
      return t.id;
    }
    if (
      input.instagramUserId &&
      t.instagramUserId &&
      t.instagramUserId === input.instagramUserId
    ) {
      return t.id;
    }
  }
  return DEFAULT_TENANT_ID;
}
