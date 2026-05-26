/**
 * Lucía · Perfil del cliente (cómo quiere que escriba sus borradores).
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

export type LuciaProfile = {
  owner_email: string;
  nombre_persona: string;
  cargo: string;
  empresa: string;
  firma: string;
  tono_marca: string;
  reglas_custom: string;
  idiomas: string;
  modo_activacion: "drafts" | "auto";
  aprobaciones_count: number;
  rechazos_count: number;
  updated_at: string;
};

export function defaultLuciaProfile(ownerEmail: string): LuciaProfile {
  return {
    owner_email: ownerEmail,
    nombre_persona: "",
    cargo: "",
    empresa: "",
    firma: "",
    tono_marca: "cercano y profesional",
    reglas_custom: "",
    idiomas: "español",
    modo_activacion: "drafts",
    aprobaciones_count: 0,
    rechazos_count: 0,
    updated_at: new Date().toISOString(),
  };
}

export async function getLuciaProfile(ownerEmail: string): Promise<LuciaProfile> {
  const db = getClient();
  if (!db) return defaultLuciaProfile(ownerEmail);
  const { data } = await (db as Row)
    .from("lucia_profiles")
    .select("*")
    .eq("owner_email", ownerEmail)
    .maybeSingle();
  return data ?? defaultLuciaProfile(ownerEmail);
}

export async function upsertLuciaProfile(
  ownerEmail: string,
  patch: Partial<Omit<LuciaProfile, "owner_email" | "updated_at">>,
): Promise<LuciaProfile> {
  const db = getClient();
  if (!db) throw new Error("Supabase no configurado");
  const current = await getLuciaProfile(ownerEmail);
  const next = { ...current, ...patch, owner_email: ownerEmail, updated_at: new Date().toISOString() };
  const { data, error } = await (db as Row)
    .from("lucia_profiles")
    .upsert(next, { onConflict: "owner_email" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function incrementLuciaCounter(ownerEmail: string, type: "aprobacion" | "rechazo"): Promise<void> {
  const db = getClient();
  if (!db) return;
  const current = await getLuciaProfile(ownerEmail);
  const patch =
    type === "aprobacion"
      ? { aprobaciones_count: current.aprobaciones_count + 1 }
      : { rechazos_count: current.rechazos_count + 1 };
  await upsertLuciaProfile(ownerEmail, patch);
}
