// Cancelar / reprogramar una reserva desde el enlace (sin login).
//   GET  ?token=…  → resumen de la cita + si se puede cancelar (antelación).
//   POST { token } → cancela: borra el evento de Google (libera el hueco + padding)
//                    y marca la reserva como cancelada. Gratis siempre.
// La reprogramación = cancelar aquí y volver a /reservas/<slug> (lo hace el front).
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getRedirectUri } from "@/lib/gmail";
import { cancelarReservaPorToken, getRecordByToken, getBusinessBySlug, localToEpoch, notificarEsperaSiLibre } from "@/lib/booking";
import { fechaHumana, enviarAvisoEspera } from "@/lib/booking-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  const record = await getRecordByToken(token);
  if (!record) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const business = await getBusinessBySlug(record.slug);
  const tz = business?.timezone || "Europe/Madrid";
  const antelacion = business?.cancelAntelacionMin ?? 0;
  const startEpoch = localToEpoch(record.startIso, tz);
  const cancelable = record.estado === "confirmada" && (antelacion <= 0 || Date.now() <= startEpoch - antelacion * 60_000);

  return NextResponse.json({
    ok: true,
    cita: {
      slug: record.slug,
      negocio: business?.nombre || record.slug,
      servicio: [record.servicioNombre, record.varianteNombre].filter(Boolean).join(" · "),
      addons: record.addonsNombres || [],
      cuando: fechaHumana(record.startIso),
      estado: record.estado,
      cancelable,
      antelacionMin: antelacion,
    },
  });
}

export async function POST(req: Request) {
  let token = "";
  try {
    token = String(((await req.json()) as { token?: string })?.token || "");
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  if (!token) return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);

  const result = await cancelarReservaPorToken(token, redirectUri);
  if (!result.ok) {
    if (result.reason === "too_late") {
      return NextResponse.json({ ok: false, reason: "too_late", message: "Ya no se puede cancelar online tan cerca de la cita. Contacta con el negocio." }, { status: 409 });
    }
    const status = result.reason === "not_found" ? 404 : 500;
    return NextResponse.json({ ok: false, reason: result.reason, detail: result.detail }, { status });
  }
  // Aviso a quien esté en lista de espera de ese día (best-effort, no bloquea).
  try {
    await notificarEsperaSiLibre(result.record.slug, result.record.startIso.slice(0, 10), redirectUri, (entry, biz) => enviarAvisoEspera(entry, biz, `${proto}://${host}`));
  } catch (e) {
    console.error("[cancelar] aviso lista de espera falló (no crítico):", e);
  }

  const business = await getBusinessBySlug(result.record.slug);
  return NextResponse.json({
    ok: true,
    cita: {
      slug: result.record.slug,
      negocio: business?.nombre || result.record.slug,
      servicio: [result.record.servicioNombre, result.record.varianteNombre].filter(Boolean).join(" · "),
      cuando: fechaHumana(result.record.startIso),
    },
  });
}
