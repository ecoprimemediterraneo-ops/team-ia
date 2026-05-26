/**
 * Tomás 2.0 · Recopila contexto completo del cliente para que la IA
 * pueda dar respuestas específicas (no genéricas).
 */
import { getUser } from "@/lib/store";

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

export type ClientContext = {
  email: string;
  business_name: string | null;
  sector: string | null;
  agents_status: Record<string, { active: boolean; configured: boolean; issues: string[] }>;
  recent_errors: string[];
  active_tickets: number;
  plan: string | null;
};

async function getTableExists(table: string): Promise<boolean> {
  const db = getClient();
  if (!db) return false;
  try {
    const { error } = await (db as Row).from(table).select("*").limit(1);
    return !error;
  } catch { return false; }
}

async function safeCount(table: string, owner_email: string, filter?: Record<string, unknown>): Promise<number> {
  const db = getClient();
  if (!db) return 0;
  try {
    let q = (db as Row).from(table).select("*", { count: "exact", head: true }).eq("owner_email", owner_email);
    if (filter) for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
    const { count } = await q;
    return count ?? 0;
  } catch { return 0; }
}

async function safeMaybeGet(table: string, owner_email: string): Promise<Row | null> {
  const db = getClient();
  if (!db) return null;
  try {
    const { data } = await (db as Row).from(table).select("*").eq("owner_email", owner_email).maybeSingle();
    return data;
  } catch { return null; }
}

export async function getClientContext(owner_email: string): Promise<ClientContext> {
  const user = await getUser(owner_email);

  const agents_status: Record<string, { active: boolean; configured: boolean; issues: string[] }> = {};

  // Marta
  const martaProfile = await safeMaybeGet("marta_profiles", owner_email);
  agents_status.marta = {
    active: !!martaProfile,
    configured: !!(martaProfile?.nombre_negocio),
    issues: martaProfile && !martaProfile.nombre_negocio ? ["editor sin completar"] : [],
  };

  // Pablo
  const pabloProfile = await safeMaybeGet("pablo_profiles", owner_email);
  agents_status.pablo = {
    active: !!pabloProfile,
    configured: !!(pabloProfile?.nombre_negocio),
    issues: pabloProfile && !pabloProfile.nombre_negocio ? ["editor sin completar"] : [],
  };

  // Lucía
  const luciaProfile = await safeMaybeGet("lucia_profiles", owner_email);
  agents_status.lucia = {
    active: !!luciaProfile,
    configured: !!(luciaProfile?.nombre_persona),
    issues: [],
  };

  // Eva
  const evaProfile = await safeMaybeGet("eva_profiles", owner_email);
  agents_status.eva = {
    active: !!evaProfile,
    configured: !!(evaProfile?.nombre_marca),
    issues: evaProfile && !evaProfile.remitente_email ? ["dominio sin configurar"] : [],
  };

  // Rocío
  const rocioProfile = await safeMaybeGet("rocio_profiles", owner_email);
  agents_status.rocio = {
    active: !!rocioProfile,
    configured: !!(rocioProfile?.nombre_negocio),
    issues: [],
  };

  // Carmen
  const carmenProfile = await safeMaybeGet("carmen_profiles", owner_email);
  agents_status.carmen = {
    active: !!carmenProfile,
    configured: !!(carmenProfile?.twilio_phone_number),
    issues: carmenProfile && !carmenProfile.twilio_phone_number ? ["sin número Twilio asignado"] : carmenProfile && !carmenProfile.whatsapp_dueno ? ["sin WhatsApp dueño configurado"] : [],
  };

  // Sergio (multi-tenant table existe en migration 001)
  const sergioCount = await safeCount("competidores", owner_email);
  agents_status.sergio = {
    active: true,
    configured: sergioCount > 0,
    issues: sergioCount === 0 ? ["sin competidores configurados"] : [],
  };

  // Diana y Tomás están siempre activos (no requieren config por cliente)
  agents_status.diana = { active: true, configured: true, issues: [] };
  agents_status.tomas = { active: true, configured: true, issues: [] };

  // Tickets abiertos
  const active_tickets = await safeCount("tomas_tickets", owner_email, { status: "abierto" });
  void getTableExists;

  return {
    email: owner_email,
    business_name: user?.business?.nombre ?? null,
    sector: user?.business?.sector ?? null,
    agents_status,
    recent_errors: [],
    active_tickets,
    plan: null,
  };
}

export function contextToPromptString(ctx: ClientContext): string {
  const agents = Object.entries(ctx.agents_status).map(([name, s]) => {
    const status = !s.active ? "no activo" : !s.configured ? "activo SIN configurar" : "activo y configurado";
    const issues = s.issues.length > 0 ? ` (issues: ${s.issues.join(", ")})` : "";
    return `- ${name}: ${status}${issues}`;
  }).join("\n");
  return `=== CONTEXTO DEL CLIENTE ===
Email: ${ctx.email}
Negocio: ${ctx.business_name || "sin definir"}
Sector: ${ctx.sector || "sin definir"}
Plan: ${ctx.plan || "sin plan"}
Tickets abiertos: ${ctx.active_tickets}

Estado de los 9 agentes:
${agents}`;
}
