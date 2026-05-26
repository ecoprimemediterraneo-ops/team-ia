/**
 * Endpoint temporal · genera magic link sin email para founder.
 * Protegido por ADMIN_DEV_TOKEN (env). Borrar tras uso.
 */
import { NextResponse } from "next/server";
import { crearMagicLink } from "@/lib/magic-link";
import { isFounder } from "@/lib/auth";

export async function POST(req: Request) {
  const auth = req.headers.get("x-admin-token");
  if (!auth || auth !== process.env.ADMIN_DEV_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { email } = await req.json();
  if (!email || typeof email !== "string") return NextResponse.json({ error: "email requerido" }, { status: 400 });
  // Permite cualquier email para testing del flujo cliente nuevo
  // if (!isFounder(email)) return NextResponse.json({ error: "no founder" }, { status: 403 });
  const link = await crearMagicLink(email);
  return NextResponse.json({ url: `https://aiteam.marketing/login/verify?token=${link.token}` });
}
