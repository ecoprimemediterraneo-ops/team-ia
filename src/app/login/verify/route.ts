import { NextResponse } from "next/server";
import { consumirMagicLink } from "@/lib/magic-link";
import { createSession } from "@/lib/auth";
import { getUser } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const base = `${url.protocol}//${url.host}`;

  if (!token) return NextResponse.redirect(`${base}/login?error=invalid`);

  const link = await consumirMagicLink(token);
  if (!link) return NextResponse.redirect(`${base}/login?error=expired`);

  await getUser(link.email);
  await createSession(link.email);
  return NextResponse.redirect(`${base}/dashboard`);
}
