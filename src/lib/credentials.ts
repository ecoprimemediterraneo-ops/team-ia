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
  pwdVersion?: number;   // versión de la contraseña sembrada desde el código (ver CRIS_PWD_VERSION)
};

const KV_KEY = "auth:credentials";
const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "credentials.json");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

// Hash bcrypt PRECOMPUTADO de la contraseña del admin "cris". La contraseña en claro
// NO se escribe aquí a propósito (este fichero va a git). Para cambiarla: genera el
// hash con `bcrypt.hashSync("<nueva>", 10)`, pégalo aquí y sube CRIS_PWD_VERSION.
const CRIS_HASH = "$2b$10$9shkbmuVLWCh0IgFL06RquLaS9S9s2SIKbw3Q4F5ezUAu4bGPOm76";

// Versión de la contraseña del admin sembrada desde el código. Al SUBIR este número,
// el siguiente arranque reescribe el hash almacenado aunque "cris" ya exista.
// Hace falta porque el seed solo crea la credencial si FALTA: sin esto, cambiar
// CRIS_HASH no tendría ningún efecto donde "cris" ya está guardado (p. ej. el
// kv_store de producción). Es el mecanismo de recuperación de acceso del admin.
const CRIS_PWD_VERSION = 2;

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
      pwdVersion: CRIS_PWD_VERSION,
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
  } else if ((data["cris"].pwdVersion ?? 1) < CRIS_PWD_VERSION) {
    // Reset de contraseña del admin pedido desde el código: "cris" ya existía con un
    // hash antiguo, lo reescribimos una sola vez (idempotente por versión).
    data["cris"] = { ...data["cris"], passwordHash: CRIS_HASH, pwdVersion: CRIS_PWD_VERSION, role: "admin" };
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
