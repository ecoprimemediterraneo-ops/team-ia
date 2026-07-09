// POST /api/admin/calendar-delete — founder-only.
// Borra un evento del Google Calendar del fundador por su eventId. Útil para
// limpiar eventos de prueba (p. ej. tests de la Function de agendado de Carmen),
// ya que la creación pasa por reservarSlot (evento crudo, sin token de cancelación).
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { requireFounder } from "@/lib/admin-auth";
import { deleteEvent } from "@/lib/calendar";
import { getRedirectUri } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";
const schema = z.object({ eventId: z.string().min(3).max(200) });

export async function POST(req: Request) {
  const a = await requireFounder();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "eventId requerido" }, { status: 400 });

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);

  const res = await deleteEvent(FOUNDER_EMAIL, redirectUri, parsed.data.eventId);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.detail || "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, eventId: parsed.data.eventId, borrado: true });
}
