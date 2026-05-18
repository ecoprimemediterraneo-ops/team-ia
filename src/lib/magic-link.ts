/**
 * Magic link login sin contraseñas.
 *
 * Flujo:
 * 1. Usuario introduce email en /login → llamada server action
 * 2. Generamos token aleatorio + expiry (15 min)
 * 3. Guardamos {email, token, expiry, used} en data/magic-links.json
 * 4. Enviamos email vía Resend con link /login/verify?token=xxx
 * 5. Usuario abre el link → /login/verify valida token, crea session JWT, redirige a /dashboard
 *
 * En desarrollo, el link también se imprime en consola para poder probar sin email.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = process.env.VERCEL ? "/tmp/aiteam-data" : path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "magic-links.json");
const TTL_MS = 15 * 60 * 1000; // 15 min

export type MagicLink = {
  token: string;
  email: string;
  expiresAt: number;
  used: boolean;
  createdAt: number;
};

async function load(): Promise<MagicLink[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf-8"));
  } catch {
    return [];
  }
}

async function save(items: MagicLink[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2));
}

export async function crearMagicLink(email: string): Promise<MagicLink> {
  const items = await load();
  const ahora = Date.now();
  // Limpiar caducados o ya usados
  const limpios = items.filter((m) => !m.used && m.expiresAt > ahora);
  const token = crypto.randomBytes(32).toString("hex");
  const nuevo: MagicLink = {
    token,
    email: email.toLowerCase().trim(),
    expiresAt: ahora + TTL_MS,
    used: false,
    createdAt: ahora,
  };
  limpios.push(nuevo);
  await save(limpios);
  return nuevo;
}

export async function consumirMagicLink(token: string): Promise<MagicLink | null> {
  const items = await load();
  const ahora = Date.now();
  const idx = items.findIndex((m) => m.token === token);
  if (idx === -1) return null;
  const link = items[idx];
  if (link.used || link.expiresAt < ahora) return null;
  items[idx] = { ...link, used: true };
  await save(items);
  return link;
}
