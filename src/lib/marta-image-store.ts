// Almacén volátil en memoria de imágenes generadas por Marta.
//
// Las imágenes generadas (post arranque / posts programados) viven aquí con
// un id, y se sirven vía /api/admin/marta-image/[id] como image/jpeg. Esto
// nos da una URL accesible que podemos pasar a WhatsApp (para enseñar al
// cliente) e Instagram (para publicar).
//
// Persistencia: si hay Supabase configurado, la imagen se guarda como base64
// en kv_store (clave `marta-img:<id>`) para que la URL siga viva entre
// invocaciones serverless (p. ej. cuando se publica horas después de crearse
// la propuesta). En local sin Supabase cae a memoria de proceso (suficiente
// para revisar en el dev server).

import "server-only";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";

type StoredImage = {
  bytes: Buffer;
  mimeType: string;
  createdAt: number;
  // ttl para liberar memoria: ~24h por defecto.
  expiresAt: number;
};

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;

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

export async function storeImage(bytes: Buffer, mimeType = "image/jpeg"): Promise<string> {
  gc();
  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const now = Date.now();
  store.set(id, { bytes, mimeType, createdAt: now, expiresAt: now + TTL_MS });
  if (supabaseEnabled()) {
    try {
      await kvSet(kvKey(id), {
        b64: bytes.toString("base64"),
        mimeType,
        createdAt: now,
        expiresAt: now + TTL_MS,
      } satisfies PersistedImage);
    } catch (err) {
      console.error("[marta-image-store] no se pudo persistir en Supabase:", err);
    }
  }
  return id;
}

export async function getStoredImage(id: string): Promise<StoredImage | null> {
  // 1) memoria (rápido, mismo proceso)
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
        store.set(id, rebuilt); // cachea en memoria para siguientes lecturas
        return rebuilt;
      }
    } catch (err) {
      console.error("[marta-image-store] no se pudo leer de Supabase:", err);
    }
  }
  return null;
}

export function imageUrlFor(id: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/admin/marta-image/${id}`;
}
