// GET /api/booking/[slug]/slots?serviceId=&variantId=&addons=a1,a2&date=YYYY-MM-DD
// Huecos LIBRES reales según la duración TOTAL (servicio + variante + add-ons)
// y el padding, consultando la agenda de Google.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getBusinessBySlug, computeFreeSlots, resolverServicio, empleadosDeServicio } from "@/lib/booking";
import { getRedirectUri } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId") || "";
  const variantId = url.searchParams.get("variantId") || undefined;
  const addonIds = (url.searchParams.get("addons") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const empleadoId = url.searchParams.get("empleadoId") || undefined;
  const date = url.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, reason: "bad_date" }, { status: 400 });
  }

  const b = await getBusinessBySlug(slug);
  if (!b) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  const svc = b.servicios.find((s) => s.id === serviceId && s.activo);
  if (!svc) return NextResponse.json({ ok: false, reason: "service_not_found" }, { status: 404 });

  const sel = resolverServicio(svc, { variantId, addonIds });

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);

  // Modelo B: si el negocio tiene personal, los huecos se calculan POR empleado.
  // - empleadoId concreto → huecos de esa persona.
  // - sin empleadoId ("cualquiera") → unión de los huecos de todos los elegibles.
  // - negocio sin personal → cálculo global (como siempre).
  const eligibles = empleadosDeServicio(b, svc.id);
  let slots: string[] = [];
  if (eligibles.length === 0) {
    const r = await computeFreeSlots(b, sel, date, redirectUri);
    if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason, detail: r.detail });
    slots = r.slots;
  } else if (empleadoId) {
    if (!eligibles.find((e) => e.id === empleadoId)) return NextResponse.json({ ok: false, reason: "empleado_invalido" }, { status: 400 });
    const r = await computeFreeSlots(b, sel, date, redirectUri, undefined, empleadoId);
    if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason, detail: r.detail });
    slots = r.slots;
  } else {
    const set = new Set<string>();
    for (const e of eligibles) {
      const r = await computeFreeSlots(b, sel, date, redirectUri, undefined, e.id);
      if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason, detail: r.detail });
      r.slots.forEach((s) => set.add(s));
    }
    slots = [...set].sort();
  }

  return NextResponse.json({
    ok: true,
    date,
    timezone: b.timezone,
    durationMin: sel.durationMin,
    precioEUR: sel.precioEUR,
    slots,
    empleados: eligibles.map((e) => ({ id: e.id, nombre: e.nombre, color: e.color })),
  });
}
