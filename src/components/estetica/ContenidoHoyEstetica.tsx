// HOY — la pantalla con la que se abre el ordenador en una clínica estética:
// quién viene hoy, a qué hora y a qué, y debajo los huecos libres de hoy y
// mañana.
//
// NADA nuevo por debajo: `listRecordsForRange` y `computeFreeSlots` son el
// mismo motor de reservas que ya usan la agenda semanal y la página pública de
// reserva — aquí solo se acota a "hoy" y "mañana".
//
// DIFERENCIA CON `ContenidoHoyDental`: no hay bloque de "urgencias sin cita".
// Una urgencia es de dental (alguien con dolor que hay que meter hoy). Lo que
// aquí aprieta es otra cosa: un lead caliente al que nadie ha contestado. Se
// pinta arriba, con el mismo peso visual que tenían las urgencias, porque con
// pocos leads y ticket alto es la pérdida más cara del día.

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
import { leadsCalientesSinContestar } from "@/lib/estetica-leads";

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
function esperando(horas: number): string {
  if (horas < 1) return "ahora mismo";
  if (horas < 24) return `${horas} h esperando`;
  const dias = Math.floor(horas / 24);
  return `${dias} ${dias === 1 ? "día" : "días"} esperando`;
}

export default async function ContenidoHoyEstetica({
  tenantId,
  vocCita = "cita",
  vocCitaPlural = "citas",
}: {
  tenantId: string;
  /** Del vocabulario del perfil ("valoración"/"valoraciones"), no a fuego. */
  vocCita?: string;
  vocCitaPlural?: string;
}) {
  const negocios = await getBusinessesForTenant(tenantId);
  const negocio = negocios[0];

  // Los leads calientes se leen SIEMPRE, haya agenda conectada o no: son el
  // dato propio de este panel y no dependen del motor de reservas.
  const calientes = await leadsCalientesSinContestar(tenantId).catch(() => []);

  if (!negocio) {
    return (
      <div className="space-y-6">
        <AvisoCalientes calientes={calientes} />
        <div className="card-hard bg-white p-6 text-sm text-black/70">
          Todavía no hay una agenda conectada. Configúrala desde{" "}
          <a href="/dashboard/agenda-estetica" className="underline font-bold">Agenda</a>.
        </div>
      </div>
    );
  }

  const hoy = hoyEnTZ(negocio.timezone || "Europe/Madrid");
  const manana = sumarDias(hoy, 1);

  const citasHoy = (await listRecordsForRange(negocio.slug, hoy, hoy)).filter(
    (r) => r.tipo === "cita" && (r.estado === "pendiente" || r.estado === "confirmada"),
  );

  // Huecos libres: se calculan con la duración del PRIMER tratamiento activo,
  // como referencia — da una foto real y no una cifra inventada.
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
            ? `No hay ${vocCitaPlural} para hoy.`
            : `${citasHoy.length} ${citasHoy.length === 1 ? vocCita : vocCitaPlural} hoy.`}
        </p>
      </div>

      <AvisoCalientes calientes={calientes} />

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
            Todavía no hay ningún tratamiento configurado en{" "}
            <a href="/dashboard/agenda-estetica" className="underline">Agenda</a>, así que no se pueden calcular huecos.
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

/** El banner rojo: leads calientes que siguen sin respuesta. */
function AvisoCalientes({
  calientes,
}: {
  calientes: Array<{ id: string; nombre: string; telefono: string; instagram?: string; tratamientoInteres?: string; motivoCaliente?: string; horasEsperando: number }>;
}) {
  if (!calientes.length) return null;
  return (
    <div>
      <h2 className="font-stencil text-xl mb-2 text-[color:var(--red)]">Leads calientes sin contestar</h2>
      <div className="space-y-2">
        {calientes.map((l) => (
          <a
            key={l.id}
            href="/dashboard/leads-valoraciones"
            className="card-hard bg-[color:var(--red)] text-white p-3 block hover:opacity-90"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="font-bold text-sm">
                {l.nombre || (l.instagram ? `@${l.instagram.replace(/^@/, "")}` : l.telefono) || "Sin nombre"}
                {l.tratamientoInteres ? ` · ${l.tratamientoInteres}` : ""}
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest border-2 border-white px-1.5 py-0.5 whitespace-nowrap">
                {esperando(l.horasEsperando)}
              </span>
            </div>
            {l.motivoCaliente && <div className="text-xs opacity-90 mt-1 leading-snug">{l.motivoCaliente}</div>}
          </a>
        ))}
      </div>
    </div>
  );
}
