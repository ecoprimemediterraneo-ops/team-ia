// GET /api/admin/carmen-auditoria — SOLO LECTURA, con CRON_SECRET.
//
// Para investigar una llamada de Carmen sin panel ni navegador: todas las citas
// guardadas de un teléfono (en CUALQUIER negocio y en cualquier estado, también
// anuladas) y los eventos de Google del calendario del negocio en un día.
//
//   ?telefono=<número>            citas de ese teléfono (últimas 9 cifras)
//   ?dia=YYYY-MM-DD&slug=<negocio> además, los eventos de Google de ese día
//
// No cambia nada. Los teléfonos salen enmascarados.
import { NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { listRecords, getBusinessBySlug, resolveCalendarEmail } from "@/lib/booking";
import { listEvents } from "@/lib/calendar";
import { getRedirectUri } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cola9 = (t?: string) => (t || "").replace(/\D/g, "").slice(-9);
const tapar = (t?: string) => (t ? `…${cola9(t).slice(-3)}` : "");

export async function GET(req: Request) {
  const err = cronAuthError(req);
  if (err) return err;
  const q = new URL(req.url).searchParams;
  const tel = cola9(q.get("telefono") || "");
  const out: Record<string, unknown> = { ok: true };

  if (tel.length === 9) {
    const citas = (await listRecords()).filter((r) => cola9(r.cliente?.telefono) === tel);
    out.citas = citas
      .sort((a, b) => (a.creadaEn || "").localeCompare(b.creadaEn || ""))
      .map((r) => ({
        id: r.id, slug: r.slug, tenantId: r.tenantId, startIso: r.startIso, servicio: r.servicioNombre, serviceId: r.serviceId,
        empleado: r.empleadoNombre, estado: r.estado, nombre: r.cliente?.nombre, telefono: tapar(r.cliente?.telefono),
        creadaEn: r.creadaEn, canceladaEn: r.canceladaEn, reprogramadaEn: r.reprogramadaEn, eventId: r.eventId, origen: r.origen,
      }));
  }

  const dia = q.get("dia");
  const slug = q.get("slug");
  if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) && slug) {
    const negocio = await getBusinessBySlug(slug);
    if (negocio) {
      const u = new URL(req.url);
      const email = await resolveCalendarEmail(negocio);
      const ev = await listEvents(email, getRedirectUri(u.host, u.protocol.replace(":", "")), `${dia}T00:00:00+02:00`, `${dia}T23:59:59+02:00`);
      out.google = ev.ok
        ? ev.events.map((e) => ({ id: e.id, inicio: e.start, titulo: (e.summary || "").replace(/\+?\d{9,}/g, "…") }))
        : { error: ev.reason };
    }
  }
  return NextResponse.json(out);
}
