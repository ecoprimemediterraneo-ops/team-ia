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

export type EvaProfile = {
  owner_email: string;
  nombre_marca: string;
  sector: string;
  remitente_nombre: string;
  remitente_email: string;
  firma: string;
  tono_marca: string;
  reglas_custom: string;
  audiencia_target: string;
  cta_principal: string;
  aprobaciones_count: number;
  rechazos_count: number;
  updated_at: string;
};

export function defaultEvaProfile(ownerEmail: string): EvaProfile {
  return {
    owner_email: ownerEmail,
    nombre_marca: "",
    sector: "",
    remitente_nombre: "",
    remitente_email: "",
    firma: "",
    tono_marca: "cercano y profesional",
    reglas_custom: "",
    audiencia_target: "",
    cta_principal: "",
    aprobaciones_count: 0,
    rechazos_count: 0,
    updated_at: new Date().toISOString(),
  };
}

export async function getEvaProfile(ownerEmail: string): Promise<EvaProfile> {
  const db = getClient();
  if (!db) return defaultEvaProfile(ownerEmail);
  const { data } = await (db as Row)
    .from("eva_profiles")
    .select("*")
    .eq("owner_email", ownerEmail)
    .maybeSingle();
  return data ?? defaultEvaProfile(ownerEmail);
}

export async function upsertEvaProfile(
  ownerEmail: string,
  patch: Partial<Omit<EvaProfile, "owner_email" | "updated_at">>,
): Promise<EvaProfile> {
  const db = getClient();
  if (!db) throw new Error("Supabase no configurado");
  const current = await getEvaProfile(ownerEmail);
  const next = { ...current, ...patch, owner_email: ownerEmail, updated_at: new Date().toISOString() };
  const { data, error } = await (db as Row)
    .from("eva_profiles")
    .upsert(next, { onConflict: "owner_email" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function incrementEvaCounter(ownerEmail: string, type: "aprobacion" | "rechazo"): Promise<void> {
  const db = getClient();
  if (!db) return;
  const current = await getEvaProfile(ownerEmail);
  const patch =
    type === "aprobacion"
      ? { aprobaciones_count: current.aprobaciones_count + 1 }
      : { rechazos_count: current.rechazos_count + 1 };
  await upsertEvaProfile(ownerEmail, patch);
}
