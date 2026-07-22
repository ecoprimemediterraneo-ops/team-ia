// Almacén de imágenes generadas por Marta (posts del calendario, arranque,
// subidas del panel). Se sirven vía /api/admin/marta-image/[id], una URL
// pública que Meta puede descargar para publicar en Instagram.
//
// POR QUÉ ESTE FICHERO IMPORTA: el calendario mensual programa posts hasta 30
// días por delante. Si la imagen caduca antes de que le toque publicarse, la
// URL responde 404 y publishToInstagram falla con invalid_media. Antes el TTL
// era de 24 h, así que TODO lo posterior al primer día se publicaba roto.
//
// Capas de almacenamiento, de más a menos durable:
//   1. Vercel Blob (@vercel/blob, BLOB_READ_WRITE_TOKEN) → URL pública PERMANENTE,
//      sin caducidad y servida por CDN. Es el mismo mecanismo que ya usaba la
//      subida de logo/portada de booking. Se usa vía storeImageDurable().
//   2. Supabase kv_store (`marta-img:<id>`, base64) → sobrevive a cold starts
//      serverless. TTL largo (45 días) para cubrir un mes completo + margen.
//   3. Fichero local en data/marta-images/ → en dev sin Supabase, sobrevive a
//      reinicios del dev server (antes se perdían al reiniciar).
//   + memoria de proceso como caché por delante de todas.
//
// IDEMPOTENCIA: el id se deriva del SHA-256 del contenido, así que guardar dos
// veces la misma imagen devuelve el mismo id y no re-sube ni duplica nada.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";

type StoredImage = {
  bytes: Buffer;
  mimeType: string;
  createdAt: number;
  expiresAt: number;
};

/**
 * 45 días: cubre un mes de calendario completo (hasta 31 días por delante) más
 * dos semanas de margen para reprogramaciones. Antes eran 24 h — ese era el bug.
 */
export const TTL_MS = 45 * 24 * 60 * 60 * 1000;

/** Solo acota la CACHÉ en memoria; el respaldo (kv/fichero) no se poda. */
const MAX_ENTRIES = 500;

const DATA_DIR = path.join(process.cwd(), "data", "marta-images");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
if (!g.__martaImageStore) g.__martaImageStore = new Map<string, StoredImage>();
const store: Map<string, StoredImage> = g.__martaImageStore;

function gc() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt < now) store.delete(k);
  }
  if (store.size > MAX_ENTRIES) {
    const sorted = [...store.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
    while (sorted.length > MAX_ENTRIES) {
      const [k] = sorted.shift()!;
      store.delete(k);
    }
  }
}

type PersistedImage = { b64: string; mimeType: string; createdAt: number; expiresAt: number };
const kvKey = (id: string) => `marta-img:${id}`;
const filePath = (id: string) => path.join(DATA_DIR, `${id}.json`);

/** Id determinista por contenido → guardar lo mismo dos veces no duplica. */
function idFor(bytes: Buffer): string {
  return `img_${createHash("sha256").update(bytes).digest("hex").slice(0, 32)}`;
}

async function readLocal(id: string): Promise<PersistedImage | null> {
  try {
    const raw = await fs.readFile(filePath(id), "utf-8");
    return JSON.parse(raw) as PersistedImage;
  } catch {
    return null;
  }
}

async function writeLocal(id: string, p: PersistedImage): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filePath(id), JSON.stringify(p));
}

// -----------------------------------------------------------------------------
// Guardar / leer
// -----------------------------------------------------------------------------

/**
 * Guarda la imagen y devuelve su id. Idempotente: el id sale del hash del
 * contenido, así que si ya estaba guardada NO se reescribe.
 */
export async function storeImage(
  bytes: Buffer,
  mimeType = "image/jpeg",
  opts: { ttlMs?: number } = {},
): Promise<string> {
  gc();
  const id = idFor(bytes);
  const now = Date.now();
  const expiresAt = now + (opts.ttlMs ?? TTL_MS);

  // Ya guardada y todavía viva → no re-subimos nada.
  const existente = await getStoredImage(id);
  if (existente) {
    store.set(id, existente);
    return id;
  }

  store.set(id, { bytes, mimeType, createdAt: now, expiresAt });
  const persisted: PersistedImage = { b64: bytes.toString("base64"), mimeType, createdAt: now, expiresAt };

  if (supabaseEnabled()) {
    try {
      await kvSet(kvKey(id), persisted);
    } catch (err) {
      console.error("[marta-image-store] no se pudo persistir en Supabase:", err);
    }
  } else {
    // Dev sin Supabase: a disco, para que sobreviva a reinicios del dev server.
    try {
      await writeLocal(id, persisted);
    } catch (err) {
      console.error("[marta-image-store] no se pudo persistir en disco:", err);
    }
  }
  return id;
}

export async function getStoredImage(id: string): Promise<StoredImage | null> {
  // 1) memoria (mismo proceso)
  const e = store.get(id);
  if (e && e.expiresAt >= Date.now()) return e;
  if (e) store.delete(id);

  // 2) Supabase (sobrevive a cold starts / otra invocación)
  if (supabaseEnabled()) {
    try {
      const p = await kvGet<PersistedImage>(kvKey(id));
      if (p && p.expiresAt >= Date.now()) {
        const rebuilt: StoredImage = {
          bytes: Buffer.from(p.b64, "base64"),
          mimeType: p.mimeType,
          createdAt: p.createdAt,
          expiresAt: p.expiresAt,
        };
        store.set(id, rebuilt);
        return rebuilt;
      }
    } catch (err) {
      console.error("[marta-image-store] no se pudo leer de Supabase:", err);
    }
    return null;
  }

  // 3) disco local (dev)
  const p = await readLocal(id);
  if (p && p.expiresAt >= Date.now()) {
    const rebuilt: StoredImage = {
      bytes: Buffer.from(p.b64, "base64"),
      mimeType: p.mimeType,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
    };
    store.set(id, rebuilt);
    return rebuilt;
  }
  return null;
}

export function imageUrlFor(id: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/admin/marta-image/${id}`;
}

// -----------------------------------------------------------------------------
// Capa DURABLE: Vercel Blob (mismo patrón que la subida de logo/portada)
// -----------------------------------------------------------------------------

/**
 * Sube a @vercel/blob si el paquete está instalado y hay BLOB_READ_WRITE_TOKEN.
 * Devuelve una URL pública PERMANENTE (sin caducidad) o null si no está listo.
 * Extraído de /api/booking/[slug]/upload para no duplicar el mecanismo.
 */
export async function putPublicBlob(
  bytes: Buffer,
  mimeType: string,
  prefix = "marta",
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const mod = (await import(/* webpackIgnore: true */ "@vercel/blob" as string).catch(() => null)) as
    | { put?: (name: string, body: Buffer, opts: Record<string, unknown>) => Promise<{ url?: string }> }
    | null;
  if (!mod?.put) return null;
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  // Nombre por hash → subir dos veces lo mismo no crea copias distintas.
  const nombre = `${prefix}/${idFor(bytes)}.${ext}`;
  const res = await mod.put(nombre, bytes, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: false,
  });
  return res?.url ?? null;
}

export type ImagenDurable = {
  url: string;
  /** "vercel-blob" = permanente · "marta-image-store" = respaldo con TTL de 45 días. */
  host: "vercel-blob" | "marta-image-store";
  id?: string;
};

/**
 * Guarda una imagen que tiene que seguir descargable SEMANAS después (posts del
 * calendario mensual) y devuelve su URL pública.
 *
 * Prioriza Vercel Blob (URL permanente de CDN). Si no está configurado, cae al
 * store propio, que ahora aguanta 45 días — suficiente para un mes de calendario.
 */
export async function storeImageDurable(
  bytes: Buffer,
  mimeType = "image/png",
  baseUrl?: string,
): Promise<ImagenDurable> {
  const blobUrl = await putPublicBlob(bytes, mimeType, "marta-calendario").catch(() => null);
  if (blobUrl) return { url: blobUrl, host: "vercel-blob" };

  const id = await storeImage(bytes, mimeType);
  return { url: imageUrlFor(id, baseUrl), host: "marta-image-store", id };
}
