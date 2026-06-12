import { NextResponse } from "next/server";
import { getStoredImage } from "@/lib/marta-image-store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const e = await getStoredImage(id);
  if (!e) return new NextResponse("not found", { status: 404 });
  return new NextResponse(e.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": e.mimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
