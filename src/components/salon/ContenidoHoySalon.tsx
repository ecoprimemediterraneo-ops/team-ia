// HOY — la pantalla con la que se abre el ordenador en un salón: la agenda del
// día POR PROFESIONAL, en columnas (quién viene, a qué hora, con quién y qué
// servicio), y debajo los huecos libres de hoy y mañana por profesional.
//
// Lo que distingue al salón de las clínicas es que trabajan varias personas a la
// vez: una sola lista de citas no dice quién tiene el hueco. Por eso aquí cada
// profesional tiene SU columna y SU rejilla de huecos.
//
// NADA nuevo por debajo: `listRecordsForRange` y `computeFreeSlots` son el mismo
// motor de reservas de la agenda semanal y la página pública. Los huecos de cada
// profesional se calculan con un servicio que ELLA hace (el primero de los suyos)
// y con su propio turno; si el negocio no tiene personal, hay una sola columna.

import "server-only";
import { headers } from "next/headers";
import {
  getBusinessesForTenant,
  listRecordsForRange,
  computeFreeSlots,
  resolverServicio,
  type BookingRecord,
  type BookingService,
  type Empleado,
} from "@/lib/booking";
import { getRedirectUri } from "@/lib/gmail";
import { calcularKpis } from "@/lib/kpis-sector";
import { getPerfilSector } from "@/lib/sectores";

function hoyEnTZ(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}
function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const hora = (iso: string) => iso.match(/T(\d{2}):(\d{2})/)?.slice(1).join(":") ?? iso;
const nombreServicio = (r: BookingRecord) => [r.servicioNombre, r.varianteNombre].filter(Boolean).join(" · ") || "Cita";

type Columna = { id?: string; nombre: string; color?: string; servicioRef?: BookingService };

export default async function ContenidoHoySalon({
  tenantId,
  vocCita = "cita",
  vocCitaPlural = "citas",
}: {
  tenantId: string;
  /** Del vocabulario del perfil, no a fuego. */
  vocCita?: string;
  vocCitaPlural?: string;
}) {
  const negocio = (await getBusinessesForTenant(tenantId))[0];
  if (!negocio) {
    return (
      <div className="card-hard bg-white p-6 text-sm text-black/70">
        Todavía no hay una agenda conectada. Configúrala desde{" "}
        <a href="/dashboard/agenda-salon" className="underline font-bold">Agenda</a>.
      </div>
    );
  }

  const hoy = hoyEnTZ(negocio.timezone || "Europe/Madrid");
  const manana = sumarDias(hoy, 1);
  const activos = negocio.servicios.filter((s) => s.activo);
  const equipo: Empleado[] = (negocio.empleados || []).filter((e) => e.activo);

  const citasHoy = (await listRecordsForRange(negocio.slug, hoy, hoy)).filter(
    (r) => r.tipo === "cita" && (r.estado === "pendiente" || r.estado === "confirmada" || r.estado === "completada"),
  );

  const columnas: Columna[] = equipo.length
    ? equipo.map((e) => ({
        id: e.id, nombre: e.nombre, color: e.color,
        servicioRef: activos.find((s) => !e.serviceIds?.length || e.serviceIds.includes(s.id)),
      }))
    : [{ nombre: "Agenda del salón", servicioRef: activos[0] }];
  const sinAsignar = equipo.length ? citasHoy.filter((r) => !r.empleadoId || !equipo.some((e) => e.id === r.empleadoId)) : [];

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);

  // Huecos por profesional, hoy y mañana.
  const huecos = await Promise.all(
    columnas.map(async (c) => {
      if (!c.servicioRef) return { c, hoy: null as string[] | null, manana: null as string[] | null, motivo: undefined as string | undefined };
      const sel = resolverServicio(c.servicioRef, {});
      const [rH, rM] = await Promise.all([
        computeFreeSlots(negocio, sel, hoy, redirectUri, undefined, c.id),
        computeFreeSlots(negocio, sel, manana, redirectUri, undefined, c.id),
      ]);
      return { c, hoy: rH.ok ? rH.slots : null, manana: rM.ok ? rM.slots : null, motivo: rH.ok ? undefined : rH.detail };
    }),
  );

  const kpis = await calcularKpis(tenantId, getPerfilSector("salon")).catch(() => []);
  const totalHoy = citasHoy.filter((r) => r.estado !== "completada").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Hoy</h1>
        <p className="text-sm text-black/60 mt-1">
          {totalHoy === 0 ? `No hay ${vocCitaPlural} para hoy.` : `${totalHoy} ${totalHoy === 1 ? vocCita : vocCitaPlural} hoy.`}
        </p>
      </div>

      {/* KPIs de la semana. Los que no se pueden calcular salen con guion y su
          motivo: nunca un cero que parezca "no funciona" ni un número inventado. */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="kpis-salon">
          {kpis.map((k) => (
            <div key={k.id} className="card-hard bg-white p-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">{k.etiqueta}</div>
              {k.valor === null ? (
                <>
                  <div className="font-stencil text-3xl mt-1 text-black/25">—</div>
                  <div className="text-[11px] text-black/50 mt-1 leading-snug">{k.motivo}</div>
                </>
              ) : (
                <>
                  <div className="font-stencil text-3xl mt-1">{k.valor}</div>
                  <div className="text-[11px] text-black/50 mt-1">{k.ayuda}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* LA AGENDA DEL DÍA, EN COLUMNAS: una por profesional. */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${columnas.length > 3 ? "10rem" : "13rem"}, 1fr))` }}>
        {columnas.map((c) => {
          const mias = citasHoy.filter((r) => (c.id ? r.empleadoId === c.id : true));
          return (
            <div key={c.nombre} className="card-hard bg-white">
              <div className="px-3 py-2 border-b-2 border-black flex items-center gap-2" style={c.color ? { borderTop: `6px solid ${c.color}` } : undefined}>
                <span className="font-stencil text-lg leading-none">{c.nombre}</span>
                <span className="text-[10px] font-mono text-black/40 ml-auto">{mias.length}</span>
              </div>
              <div className="p-2 space-y-1.5 min-h-[4rem]">
                {mias.length === 0 && <p className="text-xs text-black/40 px-1 py-2">Sin {vocCitaPlural}.</p>}
                {mias.map((r) => (
                  <div key={r.id} className={`border-2 border-black/15 p-2 ${r.estado === "completada" ? "opacity-50" : ""}`}>
                    <div className="flex items-baseline gap-2">
                      <span className="font-stencil text-lg leading-none">{hora(r.startIso)}</span>
                      {r.estado === "pendiente" && <span className="text-[9px] font-mono uppercase bg-[color:var(--mustard)] border border-black px-1">pendiente</span>}
                    </div>
                    <div className="font-bold text-sm leading-tight mt-0.5">{r.cliente.nombre || "Sin nombre"}</div>
                    <div className="text-xs text-black/60 leading-tight">{nombreServicio(r)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {sinAsignar.length > 0 && (
          <div className="card-hard bg-white">
            <div className="px-3 py-2 border-b-2 border-black flex items-center gap-2">
              <span className="font-stencil text-lg leading-none">Sin asignar</span>
              <span className="text-[10px] font-mono text-black/40 ml-auto">{sinAsignar.length}</span>
            </div>
            <div className="p-2 space-y-1.5">
              {sinAsignar.map((r) => (
                <div key={r.id} className="border-2 border-black/15 p-2">
                  <span className="font-stencil text-lg leading-none">{hora(r.startIso)}</span>
                  <div className="font-bold text-sm leading-tight mt-0.5">{r.cliente.nombre || "Sin nombre"}</div>
                  <div className="text-xs text-black/60 leading-tight">{nombreServicio(r)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-stencil text-xl mb-2">Huecos libres</h2>
        {activos.length === 0 ? (
          <div className="border-2 border-dashed border-black p-4 text-sm text-black/60">
            Todavía no hay ningún servicio configurado en <a href="/dashboard/agenda-salon" className="underline">Agenda</a>, así que no se pueden calcular huecos.
          </div>
        ) : (
          <div className="space-y-3">
            {huecos.map(({ c, hoy: hH, manana: hM, motivo }) => (
              <div key={c.nombre} className="card-hard bg-white p-3">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-stencil text-lg leading-none" style={c.color ? { borderBottom: `4px solid ${c.color}` } : undefined}>{c.nombre}</span>
                  {c.servicioRef && <span className="text-[10px] font-mono text-black/40">para {c.servicioRef.nombre.toLowerCase()}, {c.servicioRef.durationMin} min</span>}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Rejilla titulo="Hoy" slots={hH} vacio="Sin huecos libres hoy." motivo={motivo} />
                  <Rejilla titulo="Mañana" slots={hM} vacio="Sin huecos libres mañana." />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Rejilla({ titulo, slots, vacio, motivo }: { titulo: string; slots: string[] | null; vacio: string; motivo?: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-black/50 mb-1.5">{titulo}</div>
      {slots === null ? (
        <p className="text-sm text-black/50">— {motivo || "No se ha podido consultar la agenda."}</p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-black/60">{vacio}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {slots.map((s) => (
            <span key={s} className="text-xs font-mono border-2 border-black px-1.5 py-0.5">{hora(s)}</span>
          ))}
        </div>
      )}
    </div>
  );
}
