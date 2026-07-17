// POST /api/booking/[slug]/upload — subida de imágenes del negocio (logo / portada),
// autorizada por el DUEÑO del negocio (misma auth que /config).
//
// Reutiliza el MISMO mecanismo de imágenes que Marta: si hay @vercel/blob configurado
// lo usa; si no, cae al host propio (marta-image-store → /api/admin/marta-image/[id],
// que es público). No inventa almacenamiento nuevo. A diferencia de marta-upload,
// respeta el tipo REAL (png/webp/jpeg) para no perder la transparencia de los logos.
//
// Body: bytes crudos de la imagen. Header Content-Type = image/jpeg|png|webp.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { authorizeOwner } from "@/lib/booking-owner";
import { storeImage, imageUrlFor } from "@/lib/marta-image-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TIPOS_OK = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const h = await headers();
  const tipo = (h.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!TIPOS_OK.has(tipo)) {
    return NextResponse.json({ ok: false, error: "Formato no admitido. Sube JPG, PNG o WEBP." }, { status: 415 });
  }

  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "La imagen supera el máximo de 5 MB." }, { status: 413 });
  }

  // 1) Blob store real (@vercel/blob) si está preparado; si no, host propio de imágenes.
  const blobUrl = await tryVercelBlob(buf, tipo).catch(() => null);
  if (blobUrl) return NextResponse.json({ ok: true, url: blobUrl, host: "vercel-blob", bytes: buf.length });

  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const id = await storeImage(buf, tipo);
  const url = imageUrlFor(id, `${proto}://${host}`);
  return NextResponse.json({ ok: true, url, host: "marta-image-store", bytes: buf.length });
}

/** Sube a @vercel/blob si el paquete está instalado y hay token. Devuelve URL pública o null. */
async function tryVercelBlob(buf: Buffer, mime: string): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const mod = (await import(/* webpackIgnore: true */ "@vercel/blob" as string).catch(() => null)) as
    | { put?: (name: string, body: Buffer, opts: Record<string, unknown>) => Promise<{ url?: string }> }
    | null;
  if (!mod?.put) return null;
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const rand = Math.floor(performance.now()).toString(36) + Math.round(performance.now() * 1000).toString(36);
  const res = await mod.put(`booking/${rand}.${ext}`, buf, { access: "public", contentType: mime });
  return res?.url ?? null;
}
