/**
 * Pablo · Perfil del cliente.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key);
}

export type PabloProfile = {
  owner_email: string;
  nombre_negocio: string;
  sector: string;
  horario: string;
  servicios_destacados: string;
  tono_marca: string;
  reglas_custom: string;
  saludo_inicial: string;
  modo_activacion: "ruedines" | "auto";
  aprobaciones_count: number;
  rechazos_count: number;
  updated_at: string;
};

export function defaultPabloProfile(ownerEmail: string): PabloProfile {
  return {
    owner_email: ownerEmail,
    nombre_negocio: "",
    sector: "",
    horario: "L-V 9-19",
    servicios_destacados: "",
    tono_marca: "cercano y profesional",
    reglas_custom: "",
    saludo_inicial: "",
    modo_activacion: "ruedines",
    aprobaciones_count: 0,
    rechazos_count: 0,
    updated_at: new Date().toISOString(),
  };
}

export async function getPabloProfile(ownerEmail: string): Promise<PabloProfile> {
  const db = getClient();
  if (!db) return defaultPabloProfile(ownerEmail);
  const { data } = await (db as Row)
    .from("pablo_profiles")
    .select("*")
    .eq("owner_email", ownerEmail)
    .maybeSingle();
  return data ?? defaultPabloProfile(ownerEmail);
}

export async function upsertPabloProfile(
  ownerEmail: string,
  patch: Partial<Omit<PabloProfile, "owner_email" | "updated_at">>,
): Promise<PabloProfile> {
  const db = getClient();
  if (!db) throw new Error("Supabase no configurado");
  const current = await getPabloProfile(ownerEmail);
  const next = { ...current, ...patch, owner_email: ownerEmail, updated_at: new Date().toISOString() };
  const { data, error } = await (db as Row)
    .from("pablo_profiles")
    .upsert(next, { onConflict: "owner_email" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function incrementPabloCounter(ownerEmail: string, type: "aprobacion" | "rechazo"): Promise<void> {
  const db = getClient();
  if (!db) return;
  const current = await getPabloProfile(ownerEmail);
  const patch =
    type === "aprobacion"
      ? { aprobaciones_count: current.aprobaciones_count + 1 }
      : { rechazos_count: current.rechazos_count + 1 };
  await upsertPabloProfile(ownerEmail, patch);
}
