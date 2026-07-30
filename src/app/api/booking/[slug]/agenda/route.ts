// GET/POST /api/booking/[slug]/agenda — panel del negocio (Biz), auth-gated.
//   GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD → citas + bloqueos del rango.
//   POST { action: "estado" | "cita" | "bloqueo", ... } → gestiona la agenda.
// Todo pasa por el MISMO motor (reservarSlot + Google) que Lucía/Carmen/Pablo.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { authorizeOwner, ownerRedirectUri } from "@/lib/booking-owner";
import { listRecordsForRange, cambiarEstadoRecord, crearReservaManual, crearBloqueo, reprogramarRecord, notificarEsperaSiLibre } from "@/lib/booking";
import { enviarAvisoEspera } from "@/lib/booking-email";
import { procesarHuecoLiberado } from "@/lib/booking-waitlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const url = new URL(req.url);
  const today = new Date().toISOString().slice(0, 10);
  const from = RE_DATE.test(url.searchParams.get("from") || "") ? url.searchParams.get("from")! : today;
  const to = RE_DATE.test(url.searchParams.get("to") || "") ? url.searchParams.get("to")! : from;
  const records = await listRecordsForRange(slug, from, to);
  return NextResponse.json({ ok: true, timezone: a.business.timezone, from, to, records });
}

const estadoSchema = z.object({
  action: z.literal("estado"),
  recordId: z.string().min(1).max(80),
  estado: z.enum(["pendiente", "confirmada", "completada", "cancelada", "no_show"]),
});
const citaSchema = z.object({
  action: z.literal("cita"),
  serviceId: z.string().max(40).optional(),
  variantId: z.string().max(40).optional(),
  addonIds: z.array(z.string().max(40)).max(12).optional(),
  customDurationMin: z.number().int().min(5).max(600).optional(),
  customNombre: z.string().max(120).optional(),
  startIso: z.string().regex(RE_DATETIME),
  cliente: z.object({
    nombre: z.string().max(120).optional(),
    telefono: z.string().max(40).optional(),
    email: z.string().email().max(200).optional().or(z.literal("")).transform((v) => v || undefined),
  }),
  empleadoId: z.string().max(40).optional(),
  nota: z.string().max(400).optional(),
});
const bloqueoSchema = z.object({
  action: z.literal("bloqueo"),
  startIso: z.string().regex(RE_DATETIME),
  durationMin: z.number().int().min(5).max(1440),
  nota: z.string().max(200).optional(),
});
const reprogramarSchema = z.object({
  action: z.literal("reprogramar"),
  recordId: z.string().min(1).max(80),
  startIso: z.string().regex(RE_DATETIME),
  durationMin: z.number().int().min(5).max(1440).optional(),
});
const bodySchema = z.discriminatedUnion("action", [estadoSchema, citaSchema, bloqueoSchema, reprogramarSchema]);

function statusFor(reason?: string): number {
  switch (reason) {
    case "not_found": return 404;
    case "transicion_invalida": case "no_movible": return 409;
    case "slot_taken": case "locked": return 409;
    case "no_calendar": return 424;
    case "service_not_found": return 400;
    default: return 500;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await authorizeOwner(slug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;
  const redirectUri = await ownerRedirectUri();

  if (d.action === "estado") {
    const res = await cambiarEstadoRecord(d.recordId, d.estado, redirectUri, slug);
    if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason, detail: res.detail }, { status: statusFor(res.reason) });
    // Cancelar libera un hueco → avisar a la lista de espera de ese día (best-effort).
    if (d.estado === "cancelada") {
      try {
        const h = await headers();
        const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
        const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
        await notificarEsperaSiLibre(slug, res.record.startIso.slice(0, 10), redirectUri, (entry, biz) => enviarAvisoEspera(entry, biz, `${proto}://${host}`));
      } catch (e) {
        console.error("[agenda] aviso lista de espera falló (no crítico):", e);
      }
      // Lista de espera INTELIGENTE (WhatsApp): ofrecer el hueco liberado a UNA clienta.
      // Gateado por WAITLIST_SEND_ENABLED (off por defecto → solo registra, no envía).
      try {
        await procesarHuecoLiberado(slug, {
          startIso: res.record.startIso,
          serviceId: res.record.serviceId,
          servicioNombre: res.record.servicioNombre,
          empleadoId: res.record.empleadoId,
        }, redirectUri);
      } catch (e) {
        console.error("[agenda] oferta lista de espera WhatsApp falló (no crítico):", e);
      }
    }
    return NextResponse.json({ ok: true, record: res.record });
  }

  if (d.action === "cita") {
    const res = await crearReservaManual({
      slug,
      serviceId: d.serviceId || undefined,
      variantId: d.variantId || undefined,
      addonIds: d.addonIds,
      customDurationMin: d.customDurationMin,
      customNombre: d.customNombre,
      startIso: d.startIso,
      cliente: { nombre: d.cliente.nombre || "", telefono: d.cliente.telefono || "", email: d.cliente.email },
      empleadoId: d.empleadoId || undefined,
      nota: d.nota,
      redirectUri,
    });
    if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason, detail: res.detail }, { status: statusFor(res.reason) });
    return NextResponse.json({ ok: true, record: res.record });
  }

  if (d.action === "bloqueo") {
    const res = await crearBloqueo({ slug, startIso: d.startIso, durationMin: d.durationMin, nota: d.nota, redirectUri });
    if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason, detail: res.detail }, { status: statusFor(res.reason) });
    return NextResponse.json({ ok: true, record: res.record });
  }

  // d.action === "reprogramar"
  const res = await reprogramarRecord(d.recordId, d.startIso, d.durationMin, redirectUri, slug);
  if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason, detail: res.detail }, { status: statusFor(res.reason) });
  return NextResponse.json({ ok: true, record: res.record });
}
