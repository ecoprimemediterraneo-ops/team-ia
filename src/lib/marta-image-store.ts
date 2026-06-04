// Almacén volátil en memoria de imágenes generadas por Marta.
//
// Las imágenes generadas (post arranque / posts programados) viven aquí con
// un id, y se sirven vía /api/admin/marta-image/[id] como image/jpeg. Esto
// nos da una URL accesible que podemos pasar a WhatsApp (para enseñar al
// cliente) e Instagram (para publicar).
//
// IMPORTANTE: es memoria de proceso. Sobrevive a HMR de Next pero no a un
// restart del server ni a un cold start de serverless. Para producción real
// hay que mover esto a un object store (Supabase Storage / S3). Para la
// fase actual (arranque + calendario + stories en local + tenant fundador
// en prod) basta.

import "server-only";

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

export function storeImage(bytes: Buffer, mimeType = "image/jpeg"): string {
  gc();
  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  store.set(id, {
    bytes,
    mimeType,
    createdAt: Date.now(),
    expiresAt: Date.now() + TTL_MS,
  });
  return id;
}

export function getStoredImage(id: string): StoredImage | null {
  const e = store.get(id);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    store.delete(id);
    return null;
  }
  return e;
}

export function imageUrlFor(id: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/admin/marta-image/${id}`;
}
