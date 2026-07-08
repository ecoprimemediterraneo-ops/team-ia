// POST /api/admin/marta-upload — founder-only.
// Recibe los BYTES de una imagen YA convertida a JPEG (1080px, q90) en el cliente
// (canvas) y la HOSTEA en una URL pública para que Meta pueda descargarla al publicar.
//
// Hosting: si hay un blob store real configurado (@vercel/blob + BLOB_READ_WRITE_TOKEN)
// lo usa; si no, cae al host de imágenes propio de Marta (marta-image-store), que ya
// sirve /api/admin/marta-image/[id] con Content-Type correcto (KV en prod, memoria en
// dev). Así funciona HOY sin dependencias nuevas y queda preparado para @vercel/blob.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireFounder } from "@/lib/admin-auth";
import { storeImage, imageUrlFor } from "@/lib/marta-image-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: Request) {
  const a = await requireFounder();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  if (buf.length > MAX_BYTES) return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });

  // 1) Blob store real si está preparado (@vercel/blob). Si no está instalado o no hay
  //    token, cae al host propio sin romper.
  const blobUrl = await tryVercelBlob(buf).catch(() => null);
  if (blobUrl) return NextResponse.json({ ok: true, url: blobUrl, host: "vercel-blob", bytes: buf.length });

  // 2) Host propio de Marta (marta-image-store → /api/admin/marta-image/[id]).
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const id = await storeImage(buf, "image/jpeg");
  const url = imageUrlFor(id, `${proto}://${host}`);
  const localhost = /^https?:\/\/localhost|127\.0\.0\.1/.test(url);
  return NextResponse.json({ ok: true, url, host: "marta-image-store", bytes: buf.length, localhost });
}

/** Sube a @vercel/blob si el paquete está instalado y hay token. Devuelve la URL pública o null. */
async function tryVercelBlob(buf: Buffer): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const mod = (await import(/* webpackIgnore: true */ "@vercel/blob" as string).catch(() => null)) as
    | { put?: (name: string, body: Buffer, opts: Record<string, unknown>) => Promise<{ url?: string }> }
    | null;
  if (!mod?.put) return null;
  const rand = Math.floor(performance.now()).toString(36) + Math.round(performance.now() * 1000).toString(36);
  const res = await mod.put(`marta/${rand}.jpg`, buf, { access: "public", contentType: "image/jpeg" });
  return res?.url ?? null;
}
