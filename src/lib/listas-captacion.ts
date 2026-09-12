// Las dos listas que llena la web pública: plazas beta y newsletter.
//
// POR QUÉ EXISTE ESTE ARCHIVO
// ---------------------------
// Cada una guardaba en un sitio distinto, y ninguno servía en producción:
//
//   - La lista beta escribía en `/tmp/aiteam-data/waitlist.json`. En Vercel
//     `/tmp` vive y muere con la función: la petición siguiente cae en otra
//     máquina y ese archivo no existe. El apuntado se perdía; lo único que
//     salvaba al interesado era el correo de aviso al fundador.
//   - La newsletter escribía en `data/` dentro del proyecto, que en Vercel es
//     de SOLO LECTURA: el guardado reventaba y el visitante recibía un error
//     500 después de darnos su correo.
//
// Ahora las dos van a Supabase (una clave por apuntado, como los diagnósticos),
// con el archivo local como respaldo SOLO cuando no hay credenciales, que es el
// caso de desarrollo.
//
// Una clave por apuntado, y no una lista entera en una sola clave, porque dos
// personas apuntándose a la vez se pisarían: leer-modificar-escribir hace que
// gane el último y el otro desaparezca.

import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, kvListByPrefix, supabaseEnabled } from "./supabase";

export type Lista = "waitlist" | "newsletter";

export type ApuntadoWaitlist = {
  email: string;
  name?: string;
  phone?: string;
  sector?: string;
  city?: string;
  createdAt: string;
};

export type ApuntadoNewsletter = {
  email: string;
  date: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const ARCHIVO: Record<Lista, string> = {
  waitlist: path.join(DATA_DIR, "waitlist.json"),
  newsletter: path.join(DATA_DIR, "newsletter.json"),
};

/** Clave de Supabase. El email va normalizado, así que apuntarse dos veces no duplica. */
function clave(lista: Lista, email: string): string {
  return `${lista}:${email.trim().toLowerCase()}`;
}

function prefijo(lista: Lista): string {
  return `${lista}:`;
}

// -----------------------------------------------------------------------------
// Respaldo local (solo desarrollo: sin credenciales de Supabase)
// -----------------------------------------------------------------------------
async function leerLocal<T>(lista: Lista): Promise<T[]> {
  try {
    const raw = await fs.readFile(ARCHIVO[lista], "utf-8");
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

async function escribirLocal<T>(lista: Lista, filas: T[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ARCHIVO[lista], JSON.stringify(filas, null, 2));
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

/**
 * Apunta a alguien en una lista. Devuelve `duplicado: true` si ya estaba (no se
 * sobrescribe: la fecha del primer apuntado es un dato, no ruido).
 *
 * NO se traga los errores. Si el guardado falla, quien llama tiene que saberlo
 * para no decirle a alguien "estás dentro" cuando no lo está.
 */
export async function apuntar<T extends { email: string }>(
  lista: Lista,
  fila: T,
): Promise<{ ok: true; duplicado: boolean; donde: "supabase" | "local" }> {
  const email = fila.email.trim().toLowerCase();
  const dato = { ...fila, email };

  if (supabaseEnabled()) {
    const existe = await kvGet<T>(clave(lista, email));
    if (existe) return { ok: true, duplicado: true, donde: "supabase" };
    await kvSet(clave(lista, email), dato);
    return { ok: true, duplicado: false, donde: "supabase" };
  }

  const filas = await leerLocal<T>(lista);
  if (filas.some((f) => (f.email || "").trim().toLowerCase() === email)) {
    return { ok: true, duplicado: true, donde: "local" };
  }
  filas.push(dato);
  await escribirLocal(lista, filas);
  return { ok: true, duplicado: false, donde: "local" };
}

/** Todos los apuntados de una lista, del más reciente al más antiguo. */
export async function listar<T extends Record<string, unknown>>(
  lista: Lista,
  campoFecha: string,
): Promise<T[]> {
  const filas = supabaseEnabled()
    ? (await kvListByPrefix<T>(prefijo(lista))).map((r) => r.value)
    : await leerLocal<T>(lista);

  return filas.sort((a, b) =>
    String(b[campoFecha] ?? "").localeCompare(String(a[campoFecha] ?? "")),
  );
}
