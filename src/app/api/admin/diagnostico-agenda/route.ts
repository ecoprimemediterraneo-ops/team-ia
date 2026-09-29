// GET /api/admin/diagnostico-agenda — ¿están Carmen, Pablo y el panel mirando
// la MISMA agenda? Solo el fundador (sesión del panel).
//
// Para cada tenant con agenda dice, sin enseñar datos de clientes:
//   - a qué base de datos se escribe (host de Supabase, o "ficheros locales");
//   - qué negocio usan Carmen, Pablo y el panel (tiene que ser el mismo) y si el
//     tenant lo fija (`negocioAgenda`) o se toma el primero;
//   - si el número de Carmen y el de WhatsApp están dados de alta (sin ellos,
//     Carmen dice "no puedo acceder a la agenda" y Pablo ignora el mensaje);
//   - si la agenda es interna o de Google y, si es de Google, si Google responde
//     (un permiso caducado tumba TODAS las reservas de ese negocio);
//   - cuánto tarda leer las citas y coger/soltar el candado.
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireFounder } from "@/lib/admin-auth";
import { listTenants } from "@/lib/tenants";
import { getBusinessesForTenant, listRecordsDeNegocio, resolveCalendarEmail } from "@/lib/booking";
import { agendaTryLock, agendaUnlock } from "@/lib/booking-orchestrator";
import { calendarioConectado, freeBusyQuery } from "@/lib/calendar";
import { supabaseEnabled } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const tapar = (s?: string) => (s ? `…${s.replace(/\D/g, "").slice(-3)}` : null);
/** Ejecuta `fn` y dice cuánto ha tardado (y el error, si falla). */
async function ms<T>(fn: () => Promise<T>): Promise<{ ms: number; valor?: T; error?: string }> {
  const t0 = Date.now();
  try {
    const valor = await fn();
    return { ms: Date.now() - t0, valor };
  } catch (e) {
    return { ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: Request) {
  const a = await requireFounder();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  const redirectUri = `${new URL(req.url).origin}/api/lucia/callback`;
  const almacen = supabaseEnabled()
    ? `supabase:${(process.env.SUPABASE_URL || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`
    : "ficheros locales (data/)";

  const t0 = Date.now();
  const lockKey = `lock:diagnostico:${crypto.randomUUID()}`;
  const dueno = `diag:${crypto.randomUUID()}`;
  const cogido = await agendaTryLock(lockKey, 10_000, dueno).catch(() => false);
  if (cogido) await agendaUnlock(lockKey, dueno);
  const candado = { ok: cogido, ms: Date.now() - t0 };

  const tenants = [];
  for (const t of await listTenants()) {
    const negocios = await getBusinessesForTenant(t.id).catch(() => []);
    if (!negocios.length) continue;
    const agenda = negocios[0];
    const email = await resolveCalendarEmail(agenda);
    const google = await calendarioConectado(email).catch(() => false);
    let googleEstado = "no se usa (agenda interna)";
    if (google) {
      const ahora = new Date();
      const fb = await freeBusyQuery(email, redirectUri, ahora.toISOString(), new Date(ahora.getTime() + 3600_000).toISOString()).catch((e) => ({ ok: false as const, reason: "error", detail: String(e) }));
      googleEstado = fb.ok ? "conectado y responde" : `ROTO: ${"reason" in fb ? fb.reason : ""} ${"detail" in fb ? String(fb.detail).slice(0, 120) : ""} → reconecta Google o esa agenda no reserva`;
    }
    const lectura = await ms(() => listRecordsDeNegocio(agenda.slug));
    const avisos: string[] = [];
    if (negocios.length > 1 && !t.negocioAgenda) avisos.push(`tiene ${negocios.length} negocios y no fija cuál es la agenda (negocioAgenda): se usa "${agenda.slug}"`);
    if (!t.carmenPhoneNumber) avisos.push("sin número de Carmen (carmenPhoneNumber): las llamadas a este negocio no encuentran agenda");
    if (!t.whatsappPhoneNumberId) avisos.push("sin número de WhatsApp (whatsappPhoneNumberId): Pablo no recibe los mensajes de este negocio");
    if (lectura.error) avisos.push(`no se pueden leer las citas: ${lectura.error}`);
    else if (lectura.ms > 3000) avisos.push(`leer las citas tarda ${lectura.ms} ms (lento: riesgo de tiempos agotados en Retell/Meta)`);
    if (googleEstado.startsWith("ROTO")) avisos.push(googleEstado);
    tenants.push({
      tenant: t.id,
      agenda: agenda.slug,
      otrosNegocios: negocios.slice(1).map((b) => b.slug),
      agendaFijada: !!t.negocioAgenda,
      carmen: { numero: tapar(t.carmenPhoneNumber), usaAgenda: t.carmenPhoneNumber ? agenda.slug : null },
      pablo: { whatsapp: t.whatsappPhoneNumberId ? tapar(t.whatsappPhoneNumberId) : null, usaAgenda: t.whatsappPhoneNumberId ? agenda.slug : null },
      panel: { usaAgenda: agenda.slug },
      profesionales: (agenda.empleados || []).filter((e) => e.activo).length,
      calendario: google ? "google" : "interna",
      google: googleEstado,
      citas: lectura.error ? null : (lectura.valor as unknown[]).length,
      leerCitasMs: lectura.ms,
      avisos,
    });
  }
  return NextResponse.json({ ok: true, almacen, candado, tenants }, { headers: { "Cache-Control": "no-store" } });
}
