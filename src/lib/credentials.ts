// Credenciales de acceso usuario/contraseña (bcrypt). Sustituye al magic link como
// método de acceso principal. Almacenado en kv_store bajo "auth:credentials" (prod)
// o en data/credentials.json (dev local, sin Supabase).
//
// La SESIÓN sigue keyed por email (auth.ts), así que cada credencial mapea a un email
// que resuelve el usuario/tenant existente. El admin "cris" mapea al email fundador
// para conservar el acceso a /admin y a los paneles.
import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { kvGet, kvSet } from "./supabase";

export type Credential = {
  username: string;      // en minúsculas
  passwordHash: string;  // bcrypt
  email: string;         // identidad de sesión (mapea al usuario/tenant)
  role?: "admin" | "user";
  createdAt: string;
};

const KV_KEY = "auth:credentials";
const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "credentials.json");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

// Hash bcrypt PRECOMPUTADO de la contraseña inicial del admin "cris" (no guardamos la
// contraseña en claro en el código). Contraseña: "AiTeam2026".
const CRIS_HASH = "$2b$10$pciLQEuFJb5M1HY1bpiuC.Vw8C3juLcq4pXEfPKJeo2u2mRosXZP2";

type CredMap = Record<string, Credential>;

// Siembra de cero: admin "cris" con acceso de administrador.
function seed(): CredMap {
  return {
    cris: {
      username: "cris",
      passwordHash: CRIS_HASH,
      email: FOUNDER_EMAIL,
      role: "admin",
      createdAt: new Date().toISOString(),
    },
  };
}

async function readAll(): Promise<CredMap> {
  let data: CredMap | null = null;
  if (USE_SUPABASE) {
    data = await kvGet<CredMap>(KV_KEY);
  } else {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const raw = await fs.readFile(FILE, "utf-8").catch(() => "");
      data = raw.trim() ? (JSON.parse(raw) as CredMap) : null;
    } catch {
      data = null;
    }
  }
  // Seed idempotente: si no existe el admin "cris", lo creamos.
  if (!data || !data["cris"]) {
    data = { ...seed(), ...(data ?? {}) };
    await writeAll(data);
  }
  return data;
}

async function writeAll(map: CredMap): Promise<void> {
  if (USE_SUPABASE) {
    await kvSet(KV_KEY, map);
  } else {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(map, null, 2));
  }
}

export async function getCredential(username: string): Promise<Credential | null> {
  const all = await readAll();
  return all[username.trim().toLowerCase()] ?? null;
}

/** Verifica usuario+contraseña. Devuelve la credencial si es correcta, null si no. */
export async function verifyLogin(username: string, password: string): Promise<Credential | null> {
  const cred = await getCredential(username);
  if (!cred) return null;
  const ok = await bcrypt.compare(password, cred.passwordHash);
  return ok ? cred : null;
}

/** Alta/actualización de una credencial (hashea la contraseña con bcrypt). */
export async function upsertCredential(
  username: string,
  password: string,
  email: string,
  role: Credential["role"] = "user",
): Promise<Credential> {
  const all = await readAll();
  const cred: Credential = {
    username: username.trim().toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10),
    email,
    role,
    createdAt: new Date().toISOString(),
  };
  all[cred.username] = cred;
  await writeAll(all);
  return cred;
}
