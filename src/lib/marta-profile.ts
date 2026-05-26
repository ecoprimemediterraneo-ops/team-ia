/**
 * Marta · Capa de perfil del cliente.
 * Lee/escribe en `marta_profiles` (Supabase) o cae a defaults si no hay BD.
 */

import type { NegocioConfig } from "./marta-ig-responder";

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

export type MartaProfile = {
  owner_email: string;
  nombre_negocio: string;
  sector: string;
  horario: string;
  servicios_destacados: string;
  tono_marca: string;
  reglas_custom: string;
  modo_activacion: "ruedines" | "auto";
  fecha_activacion: string;
  aprobaciones_count: number;
  rechazos_count: number;
  updated_at: string;
};

export function defaultProfile(ownerEmail: string): MartaProfile {
  return {
    owner_email: ownerEmail,
    nombre_negocio: "",
    sector: "",
    horario: "L-V 9-19, S 10-14",
    servicios_destacados: "",
    tono_marca: "cercano y profesional",
    reglas_custom: "",
    modo_activacion: "ruedines",
    fecha_activacion: new Date().toISOString(),
    aprobaciones_count: 0,
    rechazos_count: 0,
    updated_at: new Date().toISOString(),
  };
}

export async function getMartaProfile(ownerEmail: string): Promise<MartaProfile> {
  const db = getClient();
  if (!db) return defaultProfile(ownerEmail);

  const { data } = await (db as Row)
    .from("marta_profiles")
    .select("*")
    .eq("owner_email", ownerEmail)
    .maybeSingle();
  return data ?? defaultProfile(ownerEmail);
}

export async function upsertMartaProfile(
  ownerEmail: string,
  patch: Partial<Omit<MartaProfile, "owner_email" | "updated_at">>,
): Promise<MartaProfile> {
  const db = getClient();
  if (!db) throw new Error("Supabase no configurado");

  const current = await getMartaProfile(ownerEmail);
  const next: MartaProfile = {
    ...current,
    ...patch,
    owner_email: ownerEmail,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (db as Row)
    .from("marta_profiles")
    .upsert(next, { onConflict: "owner_email" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function incrementApprovalCounter(
  ownerEmail: string,
  type: "aprobacion" | "rechazo",
): Promise<void> {
  const db = getClient();
  if (!db) return;
  const current = await getMartaProfile(ownerEmail);
  const patch =
    type === "aprobacion"
      ? { aprobaciones_count: current.aprobaciones_count + 1 }
      : { rechazos_count: current.rechazos_count + 1 };
  await upsertMartaProfile(ownerEmail, patch);
}

/** Convierte el perfil persistido al `NegocioConfig` que usa el responder. */
export function profileToNegocioConfig(p: MartaProfile): NegocioConfig {
  return {
    nombreNegocio: p.nombre_negocio || "tu negocio",
    sector: p.sector || undefined,
    horario: p.horario || undefined,
    serviciosDestacados: p.servicios_destacados || undefined,
    tonoMarca: p.tono_marca || undefined,
    reglasCustom: p.reglas_custom || undefined,
  };
}
