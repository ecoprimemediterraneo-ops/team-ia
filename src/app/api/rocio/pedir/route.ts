import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { generatePedirMessage, savePedirResena, listPedirResenas, markPedirEnviado } from "@/lib/rocio-inteligencia";
import { getRocioProfile } from "@/lib/rocio-profile";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const createSchema = z.object({
  cliente_nombre: z.string().optional(),
  cliente_contacto: z.string().min(3).max(255),
  canal: z.enum(["whatsapp", "sms", "email"]),
  link_resena: z.string().url(),
  programado_para: z.string().optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listPedirResenas(s.email);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "rocio-pedir", ip: getClientIp(req), limit: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });
  const body = await req.json();
  if (body.action === "enviado") {
    if (typeof body.id !== "string") return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await markPedirEnviado(body.id, s.email);
    return NextResponse.json({ ok: true });
  }
  const c = createSchema.safeParse(body);
  if (!c.success) return NextResponse.json({ error: c.error.issues[0].message }, { status: 400 });
  const profile = await getRocioProfile(s.email);
  const mensaje = await generatePedirMessage({ profile, canal: c.data.canal, cliente_nombre: c.data.cliente_nombre, link_resena: c.data.link_resena });
  const saved = await savePedirResena({ owner_email: s.email, ...c.data, mensaje });
  return NextResponse.json({ pedir: saved });
}
