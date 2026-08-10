// Servicio de hoy — la pantalla del restaurante.
//
// Solo existe donde el sector la enciende (`panelDelDia`). En un salón o en un
// despacho no se enseña: ahí no hay turnos ni comensales, y una pantalla vacía
// con nombre de restaurante confunde más de lo que ayuda.
//
// Todo se lee por `ctx.tenantId`, nunca por el email de la sesión — mismo
// criterio que /dashboard/seguimiento.

import { getSessionLocal } from "@/lib/auth";
import { redirect } from "next/navigation";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { getBusinessesForTenant, listRecordsForRange, listRecords } from "@/lib/booking";
import { configRestaurante, resumenDelDia } from "@/lib/restaurante";
import PanelDelDia, { type LineaDia } from "@/components/booking/PanelDelDia";

export const dynamic = "force-dynamic";

/** Hoy en la zona del negocio, "YYYY-MM-DD". */
function hoyEn(timezone: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(new Date());
}

export default async function ServicioPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; negocio?: string }>;
}) {
  const s = await getSessionLocal();
  if (!s) redirect("/login");

  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "panelDelDia")) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Servicio de hoy</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">
          Esta pantalla es para restaurantes, que trabajan por turnos y mesas. En {ctx.vocabulario.negocio} no
          aplica, así que no se enseña con datos vacíos.
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const negocios = await getBusinessesForTenant(ctx.tenantId);
  const negocio = negocios.find((n) => n.slug === sp.negocio) ?? negocios[0];

  if (!negocio) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Servicio de hoy</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">
          Todavía no hay un restaurante dado de alta en esta cuenta.
        </div>
      </div>
    );
  }

  const cfg = configRestaurante(negocio);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha || "") ? sp.fecha! : hoyEn(negocio.timezone);

  const delDia = await listRecordsForRange(negocio.slug, fecha, fecha).catch(() => []);
  // El histórico es lo que permite marcar "habitual" sin volver a leer por cada
  // línea. Se filtra por negocio: el comensal es de esta casa, no del tenant.
  const historico = await listRecords()
    .then((rs) => rs.filter((r) => r.slug === negocio.slug))
    .catch(() => []);

  const resumen = resumenDelDia(delDia, historico, fecha, cfg);

  const lineas: LineaDia[] = resumen.lineas.map((l) => ({
    id: l.record.id,
    hora: l.hora,
    nombre: l.record.cliente?.nombre || "",
    telefono: l.record.cliente?.telefono || "",
    comensales: l.comensales,
    zona: l.zona,
    estado: l.record.estado,
    nota: l.record.nota,
    copiar: l.copiar,
    habitual: l.ficha?.habitual
      ? {
          visitas: l.ficha.visitas,
          ultimaVisita: l.ficha.ultimaVisita,
          zonaHabitual: l.ficha.zonaHabitual,
          noShows: l.ficha.noShows,
        }
      : undefined,
  }));

  const fechaLegible = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-black/50">{negocio.nombre}</div>
          <h1 className="font-stencil text-3xl md:text-4xl leading-none">Servicio de hoy</h1>
          <p className="text-sm text-black/60 mt-1 first-letter:uppercase">{fechaLegible}</p>
        </div>
        {/* Cambiar de día sin JavaScript: un formulario GET y a correr. */}
        <form className="flex items-end gap-2 text-xs">
          {sp.negocio && <input type="hidden" name="negocio" value={sp.negocio} />}
          <label className="block">
            <span className="block font-mono uppercase tracking-widest text-black/50 mb-1">Día</span>
            <input type="date" name="fecha" defaultValue={fecha} className="card-hard bg-white px-2 py-1" />
          </label>
          <button className="btn-mustard text-xs px-3 py-1.5">Ver</button>
        </form>
      </div>

      <PanelDelDia fecha={fechaLegible} lineas={lineas} modo={cfg.modo} />

      <div className="card-hard bg-white p-3 text-[11px] font-mono text-black/60">
        Mesa de {cfg.duracionMesaMin} min · {cfg.cortesiaMin} min de cortesía ·{" "}
        {cfg.confirmacionAutomatica ? "la IA confirma sola" : "las reservas nacen PENDIENTES de que las valides"}
      </div>
    </div>
  );
}
