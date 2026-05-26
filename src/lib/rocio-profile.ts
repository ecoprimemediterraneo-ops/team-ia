/**
 * Rocío · Perfil del cliente (config personalizable).
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

export type RocioProfile = {
  owner_email: string;
  nombre_negocio: string;
  tono_marca: string;
  firma_respuesta: string;
  reglas_custom: string;
  modo_activacion: "ruedines" | "auto";
  aprobaciones_count: number;
  rechazos_count: number;
  updated_at: string;
};

export function defaultRocioProfile(ownerEmail: string): RocioProfile {
  return {
    owner_email: ownerEmail,
    nombre_negocio: "",
    tono_marca: "cordial y profesional",
    firma_respuesta: "",
    reglas_custom: "",
    modo_activacion: "ruedines",
    aprobaciones_count: 0,
    rechazos_count: 0,
    updated_at: new Date().toISOString(),
  };
}

export async function getRocioProfile(ownerEmail: string): Promise<RocioProfile> {
  const db = getClient();
  if (!db) return defaultRocioProfile(ownerEmail);
  const { data } = await (db as Row)
    .from("rocio_profiles")
    .select("*")
    .eq("owner_email", ownerEmail)
    .maybeSingle();
  return data ?? defaultRocioProfile(ownerEmail);
}

export async function upsertRocioProfile(
  ownerEmail: string,
  patch: Partial<Omit<RocioProfile, "owner_email" | "updated_at">>,
): Promise<RocioProfile> {
  const db = getClient();
  if (!db) throw new Error("Supabase no configurado");
  const current = await getRocioProfile(ownerEmail);
  const next: RocioProfile = { ...current, ...patch, owner_email: ownerEmail, updated_at: new Date().toISOString() };
  const { data, error } = await (db as Row)
    .from("rocio_profiles")
    .upsert(next, { onConflict: "owner_email" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function incrementRocioCounter(ownerEmail: string, type: "aprobacion" | "rechazo"): Promise<void> {
  const db = getClient();
  if (!db) return;
  const current = await getRocioProfile(ownerEmail);
  const patch =
    type === "aprobacion"
      ? { aprobaciones_count: current.aprobaciones_count + 1 }
      : { rechazos_count: current.rechazos_count + 1 };
  await upsertRocioProfile(ownerEmail, patch);
}
