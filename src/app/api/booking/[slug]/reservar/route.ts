// POST /api/booking/[slug]/reservar
// Body: { serviceId, variantId?, addonIds?[], startIso, nombre, telefono, email? }
// Crea la cita de verdad (reservarSlot → Google Calendar del negocio, con
// footprint de padding) y envía la confirmación. Sin dobles reservas.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getRedirectUri } from "@/lib/gmail";
import { crearReserva, getBusinessBySlug } from "@/lib/booking";
import { enviarConfirmacion } from "@/lib/booking-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  serviceId: z.string().min(1),
  variantId: z.string().max(40).optional(),
  addonIds: z.array(z.string().max(40)).max(10).optional(),
  empleadoId: z.string().max(40).optional(),
  startIso: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "Fecha/hora no válida"),
  nombre: z.string().min(1).max(120),
  telefono: z.string().min(6).max(30),
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);
  const baseUrl = `${proto}://${host}`;

  const startIso = parsed.data.startIso.length === 16 ? `${parsed.data.startIso}:00` : parsed.data.startIso;

  const result = await crearReserva({
    slug,
    serviceId: parsed.data.serviceId,
    variantId: parsed.data.variantId,
    addonIds: parsed.data.addonIds,
    empleadoId: parsed.data.empleadoId,
    startIso,
    cliente: { nombre: parsed.data.nombre.trim(), telefono: parsed.data.telefono.trim(), email: parsed.data.email },
    redirectUri,
  });

  if (!result.ok) {
    const map: Record<string, { status: number; msg: string }> = {
      not_found: { status: 404, msg: "Negocio no encontrado." },
      service_not_found: { status: 404, msg: "Servicio o variante no disponible." },
      empleado_invalido: { status: 400, msg: "Ese profesional no realiza este servicio." },
      slot_taken: { status: 409, msg: "Ese hueco acaba de ocuparse. Elige otro, por favor." },
      locked: { status: 423, msg: "Otra persona está reservando ese hueco. Prueba de nuevo en unos segundos." },
      no_calendar: { status: 503, msg: "La agenda de este negocio no está conectada ahora mismo." },
      error: { status: 500, msg: "No se pudo completar la reserva." },
    };
    const e = map[result.reason] || map.error;
    return NextResponse.json({ ok: false, reason: result.reason, message: e.msg, suggested: result.suggested }, { status: e.status });
  }

  const business = await getBusinessBySlug(slug);
  let notif = null;
  try {
    if (business) notif = await enviarConfirmacion(result.record, business, baseUrl);
  } catch (err) {
    console.error("[booking/reservar] confirmación falló (no crítico):", err);
  }

  const r = result.record;
  return NextResponse.json({
    ok: true,
    bookingId: r.id,
    cancelUrl: `${baseUrl}/reservas/cancelar/${r.token}`,
    cita: {
      servicio: r.servicioNombre,
      variante: r.varianteNombre,
      addons: r.addonsNombres,
      empleado: r.empleadoNombre,
      durationMin: r.durationMin,
      precioEUR: r.precioEUR,
      startIso: r.startIso,
      nombre: r.cliente.nombre,
    },
    notif,
  });
}
