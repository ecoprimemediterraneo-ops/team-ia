// GET /api/booking/[slug]/agenda/externos?from=YYYY-MM-DD&to=YYYY-MM-DD
// Eventos EXTERNOS del Google Calendar del owner (los que NO son reservas nuestras),
// para pintarlos como "ocupado" de solo lectura en la agenda. Reutiliza listEvents()
// y resta los eventId que ya tenemos en nuestras reservas.
import { NextResponse } from "next/server";
import { authorizeOwner, ownerRedirectUri } from "@/lib/booking-owner";
import { listEvents } from "@/lib/calendar";
import { resolveCalendarEmail, listRecordsForRange } from "@/lib/booking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const url = new URL(req.url);
  const today = new Date().toISOString().slice(0, 10);
  const from = RE_DATE.test(url.searchParams.get("from") || "") ? url.searchParams.get("from")! : today;
  const to = RE_DATE.test(url.searchParams.get("to") || "") ? url.searchParams.get("to")! : from;

  const calendarEmail = await resolveCalendarEmail(a.business);
  const redirectUri = await ownerRedirectUri();
  // Rango con margen de 1 día para captar eventos que cruzan medianoche.
  const fromIso = `${from}T00:00:00`;
  const toIso = `${to}T23:59:59`;

  const res = await listEvents(calendarEmail, redirectUri, new Date(fromIso).toISOString(), new Date(toIso).toISOString());
  if (!res.ok) {
    // Sin calendario conectado → simplemente no hay externos que pintar (no es error fatal para la agenda).
    return NextResponse.json({ ok: true, eventos: [], sinCalendario: res.reason === "no_tokens" });
  }

  // Restar los eventos que YA son reservas nuestras (por eventId).
  const recs = await listRecordsForRange(slug, from, to);
  const nuestrosEventIds = new Set(recs.map((r) => r.eventId).filter(Boolean) as string[]);

  const eventos = res.events
    .filter((e) => !nuestrosEventIds.has(e.id))
    .map((e) => ({ id: e.id, titulo: e.summary, start: e.start, end: e.end, allDay: e.allDay }));

  return NextResponse.json({ ok: true, eventos });
}
