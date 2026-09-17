// HOY — la pantalla con la que un dentista abre el ordenador: quién viene hoy,
// a qué hora, con qué tratamiento, y debajo los huecos libres de hoy y mañana
// para poder llamar y rellenarlos.
//
// NADA nuevo por debajo: `listRecordsForRange` y `computeFreeSlots` son el
// mismo motor de reservas que ya usan la agenda semanal y la página pública de
// reserva — aquí solo se acota a "hoy" y "mañana" y se presenta como lista en
// vez de como rejilla.

import "server-only";
import { headers } from "next/headers";
import {
  getBusinessesForTenant,
  listRecordsForRange,
  computeFreeSlots,
  resolverServicio,
  type BookingRecord,
} from "@/lib/booking";
import { getRedirectUri } from "@/lib/gmail";
import { urgenciasSinCita } from "@/lib/dental-urgencias";

function hoyEnTZ(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}
function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function hora(iso: string): string {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : iso;
}
function nombreServicio(r: BookingRecord): string {
  return [r.servicioNombre, r.varianteNombre].filter(Boolean).join(" · ") || "Cita";
}

export default async function ContenidoHoyDental({ tenantId }: { tenantId: string }) {
  const negocios = await getBusinessesForTenant(tenantId);
  const negocio = negocios[0];

  if (!negocio) {
    return (
      <div className="card-hard bg-white p-6 text-sm text-black/70">
        Todavía no hay una agenda conectada. Configúrala desde{" "}
        <a href="/dashboard/citas" className="underline font-bold">Agenda</a>.
      </div>
    );
  }

  const hoy = hoyEnTZ(negocio.timezone || "Europe/Madrid");
  const manana = sumarDias(hoy, 1);

  const citasHoy = (await listRecordsForRange(negocio.slug, hoy, hoy)).filter(
    (r) => r.tipo === "cita" && (r.estado === "pendiente" || r.estado === "confirmada"),
  );

  // RUTA DE URGENCIA. Va ANTES de las citas de hoy, a propósito: es lo que
  // más aprieta, y aprieta más cuanto más tiempo lleva esperando.
  const urgencias = await urgenciasSinCita(tenantId);

  // Huecos libres: se calculan con la duración del PRIMER servicio activo,
  // como referencia — es el mismo criterio que "¿tenéis hueco?" sin más
  // detalle: un hueco de sobra para el servicio más corto puede no bastar
  // para uno largo, pero da una foto real y no una cifra inventada.
  const servicioRef = negocio.servicios.find((s) => s.activo);
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);

  let huecosHoy: string[] | null = null;
  let huecosManana: string[] | null = null;
  let motivoSinHuecos: string | undefined;
  if (servicioRef) {
    const sel = resolverServicio(servicioRef, {});
    const [rHoy, rManana] = await Promise.all([
      computeFreeSlots(negocio, sel, hoy, redirectUri),
      computeFreeSlots(negocio, sel, manana, redirectUri),
    ]);
    if (rHoy.ok) huecosHoy = rHoy.slots; else motivoSinHuecos = rHoy.detail;
    if (rManana.ok) huecosManana = rManana.slots;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Hoy</h1>
        <p className="text-sm text-black/60 mt-1">
          {citasHoy.length === 0
            ? "No hay citas para hoy."
            : `${citasHoy.length} ${citasHoy.length === 1 ? "cita" : "citas"} hoy.`}
        </p>
      </div>

      {urgencias.length > 0 && (
        <div>
          <h2 className="font-stencil text-xl mb-2 text-[color:var(--red)]">Urgencias sin cita</h2>
          <div className="space-y-2">
            {urgencias.map((u) => (
              <div key={u.telefono} className="card-hard bg-[color:var(--red)] text-white p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="font-bold text-sm">{u.nombre || "Sin nombre"} · {u.telefono}</div>
                  <span className="text-[10px] font-mono uppercase tracking-widest border-2 border-white px-1.5 py-0.5 whitespace-nowrap">
                    {u.diasEsperando === 0 ? "hoy mismo" : `${u.diasEsperando} ${u.diasEsperando === 1 ? "día" : "días"} esperando`}
                  </span>
                </div>
                {u.texto && <div className="text-xs opacity-90 mt-1 leading-snug">"{u.texto}"</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {citasHoy.length > 0 && (
        <div className="space-y-2">
          {citasHoy.map((r) => (
            <div key={r.id} className="card-hard bg-white p-3 flex items-center gap-3 flex-wrap">
              <div className="font-stencil text-2xl leading-none w-16 shrink-0">{hora(r.startIso)}</div>
              <div className="flex-1 min-w-[10rem]">
                <div className="font-bold text-sm">{r.cliente.nombre || "Sin nombre"}</div>
                <div className="text-xs text-black/60">{nombreServicio(r)}</div>
              </div>
              <span
                className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 border-2 border-black ${
                  r.estado === "confirmada" ? "bg-white" : "bg-[color:var(--mustard)]"
                }`}
              >
                {r.estado}
              </span>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="font-stencil text-xl mb-2">Huecos libres</h2>
        {!servicioRef ? (
          <div className="border-2 border-dashed border-black p-4 text-sm text-black/60">
            Todavía no hay ningún servicio configurado en{" "}
            <a href="/dashboard/citas" className="underline">Agenda</a>, así que no se pueden calcular huecos.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card-hard bg-white p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-2">Hoy</div>
              {huecosHoy === null ? (
                <p className="text-sm text-black/50">— {motivoSinHuecos || "No se ha podido consultar la agenda."}</p>
              ) : huecosHoy.length === 0 ? (
                <p className="text-sm text-black/60">Sin huecos libres hoy.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {huecosHoy.map((s) => (
                    <span key={s} className="text-xs font-mono border-2 border-black px-1.5 py-0.5">{hora(s)}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="card-hard bg-white p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-2">Mañana</div>
              {huecosManana === null ? (
                <p className="text-sm text-black/50">—</p>
              ) : huecosManana.length === 0 ? (
                <p className="text-sm text-black/60">Sin huecos libres mañana.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {huecosManana.map((s) => (
                    <span key={s} className="text-xs font-mono border-2 border-black px-1.5 py-0.5">{hora(s)}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
