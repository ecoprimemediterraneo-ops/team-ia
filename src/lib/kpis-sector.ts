// KPIs con los que abre el panel de cada sector.
//
// HONESTIDAD POR DELANTE: un KPI sin dato sale con un guion y explicando por
// qué. Nunca un cero, nunca un número parecido, nunca uno inventado. Un cero
// dice "no ha pasado nada"; un guion dice "no lo sabemos", y son cosas
// distintas.
//
// De los seis que no se medían, cuatro se calculan ya con datos que el sistema
// YA guardaba (ver cada caso abajo). Dos siguen sin fuente porque harían falta
// modelos de datos que no existen: recall de revisiones y presupuestos.

import "server-only";
import { getMonthEvents, monthKey, type AnalyticsEvent } from "./event-log";
import { listLeads } from "./pipeline";
import { informe, getBusinessByTenant, listRecords, type BookingRecord } from "./booking";
import type { Kpi, KpiId, PerfilSector } from "./sectores";

export type ValorKpi = {
  id: KpiId;
  etiqueta: string;
  ayuda: string;
  /** null = todavía no se mide. El panel lo dice, no lo disimula. */
  valor: string | null;
  /** Por qué no hay dato, cuando valor es null. */
  motivo?: string;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function inicioSemana(): Date {
  const d = new Date();
  const dia = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dia);
  d.setHours(0, 0, 0, 0);
  return d;
}

// -----------------------------------------------------------------------------
// Tiempo de respuesta — SALE GRATIS
// -----------------------------------------------------------------------------
// El webhook de Pablo ya guardaba `meta.latencyMs` en cada `message_out`: los
// milisegundos entre que entra el mensaje y sale la respuesta. Estaba escrito y
// nadie lo leía. No hace falta registrar nada nuevo, y además es retroactivo.
function tiempoRespuesta(eventos: AnalyticsEvent[]): string | null {
  const ms = eventos
    .filter((e) => e.type === "message_out")
    .map((e) => e.meta?.latencyMs)
    .filter((x): x is number => typeof x === "number" && x >= 0 && x < 30 * 60_000);
  if (!ms.length) return null;
  // Mediana, no media: una respuesta lenta suelta no debe desvirtuar el dato.
  const orden = [...ms].sort((a, b) => a - b);
  const mediana = orden[Math.floor(orden.length / 2)];
  const seg = Math.round(mediana / 1000);
  if (seg < 60) return `${seg} s`;
  return `${Math.round(seg / 60)} min`;
}

// -----------------------------------------------------------------------------
// Huecos rellenados — SALE GRATIS
// -----------------------------------------------------------------------------
// Cada reserva guarda `creadaEn` y `canceladaEn`. Un hueco rellenado es una cita
// cancelada cuyo sitio (mismo negocio y misma hora de inicio) lo ocupa después
// otra reserva viva, creada DESPUÉS de la cancelación. No hace falta ningún
// evento nuevo, y también es retroactivo.
function huecosRellenados(recs: BookingRecord[], desde: string, hasta: string): number {
  const canceladas = recs.filter(
    (r) => r.estado === "cancelada" && r.canceladaEn &&
           r.startIso.slice(0, 10) >= desde && r.startIso.slice(0, 10) <= hasta,
  );
  let n = 0;
  for (const c of canceladas) {
    const ocupado = recs.some(
      (o) =>
        o.id !== c.id &&
        o.slug === c.slug &&
        o.startIso === c.startIso &&
        o.estado !== "cancelada" &&
        o.tipo !== "bloqueo" &&
        !!o.creadaEn &&
        o.creadaEn > c.canceladaEn!,
    );
    if (ocupado) n++;
  }
  return n;
}

// -----------------------------------------------------------------------------
// Conversión: quién escribió y acabó reservando — DESDE HOY
// -----------------------------------------------------------------------------
// `message_in` siempre ha llevado `senderId` (el teléfono). A `appointment_set`
// se le acaba de añadir el mismo identificador, así que ya se pueden cruzar.
// OJO: solo cuenta de aquí en adelante. Las citas ya registradas no lo llevan, y
// por eso si no hay ni una con identificador se devuelve null en vez de un cero
// que parecería "no convierte nadie".
function conversion(eventos: AnalyticsEvent[]): { valor: string | null; motivo?: string } {
  const escribieron = new Set(
    eventos.filter((e) => e.type === "message_in" && e.senderId).map((e) => e.senderId!),
  );
  const citasConId = eventos.filter((e) => e.type === "appointment_set" && e.senderId);
  if (!escribieron.size) return { valor: null, motivo: "Todavía no ha escrito nadie este mes." };
  if (!citasConId.length) {
    return {
      valor: null,
      motivo: "Se empieza a medir ahora: las citas anteriores no guardaban con quién se cruzaban.",
    };
  }
  const reservaron = new Set(citasConId.map((e) => e.senderId!));
  const n = [...reservaron].filter((s) => escribieron.has(s)).length;
  return { valor: `${n} de ${escribieron.size}` };
}

/**
 * Calcula los KPIs del perfil para un tenant. Nunca lanza: si una fuente falla,
 * ese KPI sale sin dato en vez de tumbar el panel.
 */
export async function calcularKpis(tenantId: string, perfil: PerfilSector): Promise<ValorKpi[]> {
  const mes = monthKey();
  const eventos = await getMonthEvents(tenantId, mes).catch(() => []);
  const negocio = await getBusinessByTenant(tenantId).catch(() => null);

  const desde = ymd(inicioSemana());
  const hasta = ymd(new Date());
  const inf = negocio ? await informe(negocio.slug, desde, hasta).catch(() => null) : null;

  // Reservas del negocio, para los huecos rellenados.
  const recs = negocio
    ? await listRecords().then((rs) => rs.filter((r) => r.slug === negocio.slug)).catch(() => [])
    : [];

  const leads = await listLeads().catch(() => []);
  const leadsTenant = leads.filter((l) => (l.tenantId || "tenant_aiteam") === tenantId);

  const cuenta = (t: string) => eventos.filter((e) => e.type === t).length;
  const remitentes = new Set(eventos.filter((e) => e.type === "message_in" && e.senderId).map((e) => e.senderId));

  const valor = (k: Kpi): ValorKpi => {
    const base = { id: k.id, etiqueta: k.etiqueta, ayuda: k.ayuda };
    switch (k.id) {
      case "ocupacion_semana":
        return inf ? { ...base, valor: `${inf.ocupacion.pct}%` }
                   : { ...base, valor: null, motivo: "Sin motor de reservas conectado." };
      case "no_shows":
        return inf ? { ...base, valor: String(inf.citas.noShow) }
                   : { ...base, valor: null, motivo: "Sin motor de reservas conectado." };
      case "citas_semana":
        return inf ? { ...base, valor: String(inf.citas.total) }
                   : { ...base, valor: null, motivo: "Sin motor de reservas conectado." };
      case "leads":
        return { ...base, valor: String(cuenta("lead_captured") || leadsTenant.length) };
      case "pipeline":
        return { ...base, valor: String(leadsTenant.filter((l) => l.stage !== "client" && l.stage !== "lost").length) };
      case "consultas_recibidas":
        return { ...base, valor: String(remitentes.size) };

      // --- Los cuatro que se han desbloqueado ---
      case "tiempo_respuesta": {
        const v = tiempoRespuesta(eventos);
        return v
          ? { ...base, valor: v }
          : { ...base, valor: null, motivo: "Todavía no se ha contestado ningún mensaje este mes." };
      }
      case "huecos_rellenados":
        return negocio
          ? { ...base, valor: String(huecosRellenados(recs, desde, hasta)) }
          : { ...base, valor: null, motivo: "Sin motor de reservas conectado." };
      case "consultas_a_primera_cita":
      case "leads_a_valoracion": {
        const c = conversion(eventos);
        return { ...base, ...c };
      }

      // --- Los dos que siguen sin fuente de datos ---
      case "revisiones_recuperadas":
        return { ...base, valor: null, motivo: "No hay registro de avisos de revisión: haría falta el recall." };
      case "presupuestos_convertidos":
        return { ...base, valor: null, motivo: "No hay modelo de presupuestos en el sistema." };
      default:
        return { ...base, valor: null, motivo: "Todavía no se mide." };
    }
  };

  return perfil.kpis.map(valor);
}
