// GET/POST /api/booking/[slug]/notificaciones — campanita del dueño (auth-gated).
//   GET  → notificaciones (nueva/cancelada/reprogramada, últimas 2 semanas) + nº no leídas.
//   POST → marca todas como leídas (guarda la marca de tiempo por dueño+negocio).
import { NextResponse } from "next/server";
import { authorizeOwner } from "@/lib/booking-owner";
import { listNotificaciones, getNotifSeen, setNotifSeen } from "@/lib/booking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const [notificaciones, lastSeenIso] = await Promise.all([
    listNotificaciones(slug),
    getNotifSeen(slug, a.email),
  ]);
  const noLeidas = notificaciones.filter((n) => n.eventoIso > lastSeenIso).length;
  return NextResponse.json({ ok: true, notificaciones, noLeidas, lastSeenIso });
}

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  await setNotifSeen(slug, a.email, new Date().toISOString());
  return NextResponse.json({ ok: true });
}
