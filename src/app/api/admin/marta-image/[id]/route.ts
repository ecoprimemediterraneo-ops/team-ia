import { NextResponse } from "next/server";
import { getStoredImage } from "@/lib/marta-image-store";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const e = await getStoredImage(id);
  if (!e) return new NextResponse("not found", { status: 404 });
  // Vídeos de Marta: el navegador (Safari sobre todo) pide trozos con Range.
  const rango = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (rango && e.mimeType.startsWith("video/")) {
    const total = e.bytes.length;
    const ini = rango[1] ? Number(rango[1]) : Math.max(0, total - Number(rango[2] || 0));
    const fin = rango[1] && rango[2] ? Math.min(Number(rango[2]), total - 1) : total - 1;
    if (ini >= total || ini > fin) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    return new NextResponse(e.bytes.subarray(ini, fin + 1) as unknown as BodyInit, {
      status: 206,
      headers: { "Content-Type": e.mimeType, "Content-Range": `bytes ${ini}-${fin}/${total}`, "Accept-Ranges": "bytes", "Content-Length": String(fin - ini + 1), "Cache-Control": "public, max-age=3600" },
    });
  }
  return new NextResponse(e.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": e.mimeType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
