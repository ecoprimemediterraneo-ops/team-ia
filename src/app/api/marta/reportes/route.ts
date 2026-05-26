import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateReporte, listReportes } from "@/lib/marta-reportes";
import { getMartaProfile } from "@/lib/marta-profile";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listReportes(s.email);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = rateLimit({ key: "marta-rep", ip: getClientIp(req), limit: 5, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: `Espera ${Math.ceil(rl.resetIn / 1000)}s` }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const periodo: string | undefined = typeof body?.periodo === "string" ? body.periodo : undefined;
  const profile = await getMartaProfile(s.email);
  const r = await generateReporte({ owner_email: s.email, profile, periodo });
  if (!r) return NextResponse.json({ error: "No se pudo generar" }, { status: 500 });
  return NextResponse.json({ reporte: r });
}
