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
// Durante la beta (20 plazas) la tabla cabe holgadamente en una sola clave.

import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "./supabase";
import type { StyleConfig } from "./image-style-presets";
import type { SectorKey } from "./sector-prompts";

export type TenantPlan = "esencial" | "completo" | "pro";
export type { StyleConfig } from "./image-style-presets";
export type { SectorKey } from "./sector-prompts";

// Ficha de marca / cliente. Una sola por tenant que alimenta a todos los
// agentes (Marta para captions de Instagram, Pablo para WhatsApp, etc).
export type Ficha = {
  nombreNegocio: string;
  sector: string;                          // "clínica dental", "peluquería", ...
  ciudad: string;
  tono: string;                            // "cercano y profesional", "elegante", ...
  serviciosClave: string[];                // 3-5 servicios que más quieren promocionar
  promosActuales?: string[];               // ofertas vigentes (opcional)
  publicoObjetivo?: string;                // a quién se dirigen (opcional)
  notasEstilo?: string;                    // qué evitar / incluir siempre (opcional)
  // Estilo visual del cliente — fuente única para TODAS las imágenes que
  // genera Marta. Si está aquí, el motor de imagen lo lee y lo aplica.
  estilo?: StyleConfig;
};

// Pauta de publicación de Marta por negocio: qué días de la semana publica el
// calendario automático y —CADA DÍA— a qué hora concreta (ej. Lunes 09:00,
// Jueves 17:00). Vive DENTRO del tenant (donde ya vive la ficha), no es un store
// nuevo. Si un tenant no la tiene, se usa PAUTA_DEFECTO (L-X-V a las 10:00).
export type PautaDia = {
  dow: number;     // 0=Domingo … 6=Sábado
  hora: number;    // 0-23, hora local Europe/Madrid
  minuto: number;  // 0-59
};

export type PautaPublicacion = {
  dias: PautaDia[]; // solo los días activos, cada uno con su hora
};

export const PAUTA_DEFECTO: PautaPublicacion = {
  dias: [
    { dow: 1, hora: 10, minuto: 0 },
    { dow: 3, hora: 10, minuto: 0 },
    { dow: 5, hora: 10, minuto: 0 },
  ],
};

// Identidad visual del negocio para las imágenes que pinta Marta (/api/og/post).
// Vive DENTRO del tenant (donde ya vive la ficha), no es un store nuevo. Si un
// tenant no tiene nada guardado, se usa MARCA_DEFECTO, que reproduce EXACTAMENTE
// los tokens de AI-Team que hay hoy a fuego en /api/og/post → sus posts no cambian.
// Plantilla de composición de la imagen:
//   "marcada" = estilo AI-Team (barras negras, caja con borde grueso, esquinas rectas).
//   "suave"   = neutro tipo Instagram (redondeado, sin borde grueso ni barras negras).
export type PlantillaMarca = "marcada" | "suave";

export type MarcaVisual = {
  fondo: string;             // color de fondo (hex)
  acento: string;            // color de acento (hex)
  texto: string;             // color de texto (hex)
  plantilla: PlantillaMarca; // composición
  cta: string;               // texto de la cinta inferior ("" = sin CTA)
  logoUrl?: string;          // logo del negocio (URL pública durable)
};

// OJO: estos valores son los que /api/og/post tiene hoy hardcodeados. No cambiar
// sin cambiar también el renderizador, o AI-Team dejaría de verse idéntico.
export const MARCA_DEFECTO: MarcaVisual = {
  fondo: "#FAF7F0",
  acento: "#F5C518",
  texto: "#0A0A0A",
  plantilla: "marcada",
  cta: "DIAGNÓSTICO GRATIS · 2 MIN",
};

// Default para un tenant CLIENTE que aún no ha configurado nada: estilo neutro.
const MARCA_DEFECTO_CLIENTE: MarcaVisual = { ...MARCA_DEFECTO, plantilla: "suave", cta: "RESERVA TU CITA" };

/** Marca por defecto según el tenant: AI-Team → marcada; cualquier cliente → suave. */
export function marcaPorDefecto(tenantId: string): MarcaVisual {
  return tenantId === DEFAULT_TENANT_ID ? { ...MARCA_DEFECTO } : { ...MARCA_DEFECTO_CLIENTE };
}

export type Tenant = {
  id: string;                              // "tenant_aiteam", "tenant_clinicasonrisa", ...
  name: string;                            // "AI-Team (cuenta fundadora)"
  email: string;                           // contacto del propietario
  whatsappPhoneNumberId?: string;          // mapea Meta → tenant (número EMISOR)
  ownerWhatsapp?: string;                  // WhatsApp del DUEÑO para recibir avisos (E.164, p.ej. 34656989373)
  instagramUserId?: string;                // mapea Meta → tenant
  plan: TenantPlan;
  pricing: { monthlyEUR: number };
  startedAt: string;                       // ISO
  // Asunciones de cálculo (configurable por tenant):
  minutesPerInteraction: number;           // default 4
  conversionValueEUR: number;              // valor medio de un cliente cerrado (default 200)
  // Sector del agente conversacional → qué prompt carga Pablo/Carmen/Eva.
  // "dental" | "estetica" | "vendedor". Default: "vendedor" (capta clínicas).
  sectorPrompt?: SectorKey;
  // Ficha de marca / cliente (alimenta a todos los agentes):
  ficha?: Ficha;
  // Pauta de publicación del calendario de Marta (días + horas). Opcional:
  // si falta, se usa PAUTA_DEFECTO.
  pautaPublicacion?: PautaPublicacion;
  // Identidad visual (colores + logo) para las imágenes de Marta. Opcional:
  // si falta, se usa MARCA_DEFECTO (los tokens de AI-Team).
  marcaVisual?: MarcaVisual;
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
      sectorPrompt: "vendedor",
      ficha: {
        nombreNegocio: "AI-Team",
        sector: "Software / SaaS (agentes IA para PYMES de servicios)",
        ciudad: "Marbella (operación remota, España)",
        tono: "Cercano, directo, profesional. Castellano de España, tuteo. Sin humo ni promesas exageradas.",
        serviciosClave: [
          "Pablo · WhatsApp 24/7 que cierra ventas",
          "Marta · Instagram y redes que captan",
          "Carmen · llamadas de voz que recogen citas",
          "Lucía · agenda y gestión de correo",
          "Rocío · respuestas automáticas a reseñas de Google",
          "Eva · email marketing con base de datos propia",
        ],
        promosActuales: [
          "Beta fundadores: 20 plazas con 6 meses gratis sin tarjeta, precio fundador para siempre",
        ],
        publicoObjetivo:
          "Dueños/as de PYMES de servicios en España: clínicas dentales y estéticas, peluquerías, restaurantes, fisios, podólogos, gimnasios. 1-50 empleados.",
        notasEstilo:
          "Nunca decir 'garantizado' ni '100%'. Nunca prometer integraciones no listadas. CTA siempre a https://aiteam.marketing/beta. Nunca mencionar al fundador por nombre. Cierre comercial sin agresividad.",
        estilo: { preset: "natural" },
      },
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

// -----------------------------------------------------------------------------
// Pauta de publicación de Marta (vive dentro del tenant)
// -----------------------------------------------------------------------------

// Orden de la semana empezando en Lunes (para mostrar y ordenar).
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

/**
 * Normaliza una pauta y MIGRA el formato viejo sin romperlo:
 *   - Nuevo:  { dias: [{dow,hora,minuto}, …] }
 *   - Viejo:  { diasSemana: number[], horas: number[] } → cada día pasa a tener
 *             la PRIMERA hora de la lista (una hora por día).
 * Devuelve días únicos por dow, válidos (dow 0-6, hora 0-23, min 0-59), en
 * orden de semana (Lunes primero).
 */
export function normalizarPauta(p: unknown): PautaPublicacion {
  const raw = (p ?? {}) as { dias?: unknown; diasSemana?: unknown; horas?: unknown };
  const porDow = new Map<number, PautaDia>();

  const add = (dow: unknown, hora: unknown, minuto: unknown) => {
    const d = Number(dow), h = Number(hora), m = Number(minuto);
    if (!Number.isInteger(d) || d < 0 || d > 6) return;
    if (porDow.has(d)) return; // un día, una hora
    porDow.set(d, {
      dow: d,
      hora: Number.isInteger(h) && h >= 0 && h <= 23 ? h : 10,
      minuto: Number.isInteger(m) && m >= 0 && m <= 59 ? m : 0,
    });
  };

  if (Array.isArray(raw.dias)) {
    // Formato nuevo.
    for (const d of raw.dias as Array<{ dow?: unknown; hora?: unknown; minuto?: unknown }>) {
      add(d?.dow, d?.hora, d?.minuto);
    }
  } else if (Array.isArray(raw.diasSemana)) {
    // Formato viejo → migración: una hora por día (la primera de la lista).
    const horas = (raw.horas as unknown[] | undefined)?.map(Number).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23) ?? [];
    const hora = horas.length ? horas[0] : 10;
    for (const dow of raw.diasSemana as unknown[]) add(dow, hora, 0);
  }

  const dias = ORDEN_SEMANA.filter((d) => porDow.has(d)).map((d) => porDow.get(d)!);
  return { dias: dias.length ? dias : PAUTA_DEFECTO.dias.map((d) => ({ ...d })) };
}

/** Pauta guardada del tenant, o PAUTA_DEFECTO si no tiene ninguna. */
export async function getPautaPublicacion(tenantId: string): Promise<PautaPublicacion> {
  const t = await getTenant(tenantId);
  return t?.pautaPublicacion ? normalizarPauta(t.pautaPublicacion) : { ...PAUTA_DEFECTO };
}

/** Guarda la pauta en el tenant. Devuelve la pauta normalizada, o null si el tenant no existe. */
export async function savePautaPublicacion(
  tenantId: string,
  pauta: unknown,
): Promise<PautaPublicacion | null> {
  const t = await getTenant(tenantId);
  if (!t) return null;
  const limpia = normalizarPauta(pauta);
  await upsertTenant({ ...t, pautaPublicacion: limpia });
  return limpia;
}

// -----------------------------------------------------------------------------
// Identidad visual de Marta (vive dentro del tenant)
// -----------------------------------------------------------------------------

function esHex(v: unknown): v is string {
  return typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}

/**
 * Normaliza una marca. `base` son los valores por defecto a usar cuando falte un
 * campo (por tenant: AI-Team=marcada, cliente=suave). El `cta` admite cadena
 * vacía ("" = sin llamada a la acción).
 */
export function normalizarMarca(raw: unknown, base: MarcaVisual = MARCA_DEFECTO): MarcaVisual {
  const m = (raw ?? {}) as Partial<MarcaVisual>;
  const logo = typeof m.logoUrl === "string" && m.logoUrl.trim() ? m.logoUrl.trim() : undefined;
  return {
    fondo: esHex(m.fondo) ? m.fondo!.trim() : base.fondo,
    acento: esHex(m.acento) ? m.acento!.trim() : base.acento,
    texto: esHex(m.texto) ? m.texto!.trim() : base.texto,
    plantilla: m.plantilla === "suave" || m.plantilla === "marcada" ? m.plantilla : base.plantilla,
    cta: typeof m.cta === "string" ? m.cta.trim().slice(0, 60) : base.cta,
    ...(logo ? { logoUrl: logo } : {}),
  };
}

/** Marca guardada del tenant, o la de por defecto según el tenant (AI-Team marcada, cliente suave). */
export async function getMarcaVisual(tenantId: string): Promise<MarcaVisual> {
  const base = marcaPorDefecto(tenantId);
  const t = await getTenant(tenantId);
  return t?.marcaVisual ? normalizarMarca(t.marcaVisual, base) : base;
}

/**
 * Guarda (fusiona) la marca del tenant. `patch` puede traer solo algunos campos
 * (p.ej. solo el logo). Lo que falte cae al default del tenant. Devuelve la marca
 * normalizada o null.
 */
export async function saveMarcaVisual(tenantId: string, patch: Partial<MarcaVisual>): Promise<MarcaVisual | null> {
  const t = await getTenant(tenantId);
  if (!t) return null;
  const base = marcaPorDefecto(tenantId);
  const actual = t.marcaVisual ? normalizarMarca(t.marcaVisual, base) : base;
  const fusion = normalizarMarca({ ...actual, ...patch }, base);
  await upsertTenant({ ...t, marcaVisual: fusion });
  return fusion;
}

/** Devuelve el sector del agente conversacional del tenant (default vendedor). */
export async function getTenantSector(tenantId: string): Promise<SectorKey> {
  const t = await getTenant(tenantId);
  return t?.sectorPrompt ?? "vendedor";
}

/** Cambia el sector del tenant. Devuelve el tenant actualizado o null. */
export async function setTenantSector(tenantId: string, sector: SectorKey): Promise<Tenant | null> {
  const t = await getTenant(tenantId);
  if (!t) return null;
  return upsertTenant({ ...t, sectorPrompt: sector });
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
