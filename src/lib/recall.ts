// Recall de revisiones — el paciente que se fue y no volvió.
//
// Una clínica dental no pierde pacientes de golpe: los pierde por olvido. Vino,
// se hizo la limpieza, quedó en volver "en seis meses" y nadie se lo recordó.
// Este módulo calcula a quién le toca hoy y deja que Pablo se lo diga.
//
// De dónde salen los datos: NO hace falta ningún registro nuevo. Las visitas ya
// están en las reservas (`BookingRecord`), con la fecha y el nombre del
// tratamiento. Lo único que se añade es el evento `recall_enviado`, que sirve
// para dos cosas: no avisar dos veces, y poder medir después cuántos volvieron.
//
// Aislamiento: TODO se lee por `tenantId`. `candidatosRecall` filtra las reservas
// por los negocios de ese tenant y nunca mira las de otro.

import "server-only";
import { getBusinessesForTenant, listRecords, type BookingRecord } from "./booking";
import { getMonthEvents, logEvent, makeEventId, monthKey, type AnalyticsEvent } from "./event-log";
import { sendWhatsAppTemplate } from "./whatsapp-sender";

// -----------------------------------------------------------------------------
// Cada cuánto toca volver, según lo que se hizo
// -----------------------------------------------------------------------------
// La regla la escribe la clínica, no la IA. Aquí está en una tabla legible para
// poder discutirla con el dentista y cambiarla en un sitio.
//
// El orden importa: gana la PRIMERA regla que encaje, así que lo específico va
// antes que lo genérico ("revisión de implantes" es implante, no revisión).

type Regla = { meses: number; etiqueta: string; patrones: string[] };

const REGLAS: Regla[] = [
  {
    meses: 12,
    etiqueta: "control anual",
    patrones: ["implante", "ortodoncia", "invisalign", "bracket", "ferula", "férula", "corona", "puente", "protesis", "prótesis", "carilla", "blanqueamiento"],
  },
  {
    meses: 6,
    etiqueta: "revisión semestral",
    patrones: ["endodoncia", "empaste", "obturacion", "obturación", "extraccion", "extracción", "periodoncia", "curetaje", "encias", "encías"],
  },
  {
    meses: 6,
    etiqueta: "limpieza y revisión",
    patrones: ["revision", "revisión", "limpieza", "higiene", "profilaxis", "tartrectomia", "tartrectomía", "consulta", "primera visita", "valoracion", "valoración"],
  },
];

/** Meses hasta la siguiente visita según el tratamiento. Por defecto, 6. */
export function intervaloDe(servicio: string | undefined): { meses: number; etiqueta: string } {
  const s = (servicio || "").toLowerCase();
  for (const r of REGLAS) {
    if (r.patrones.some((p) => s.includes(p))) return { meses: r.meses, etiqueta: r.etiqueta };
  }
  return { meses: 6, etiqueta: "revisión semestral" };
}

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------

/** Teléfono comparable: solo dígitos, y sin el 34 de España delante. */
export function telefonoClave(t: string | undefined): string {
  const d = (t || "").replace(/\D+/g, "");
  return d.startsWith("34") && d.length > 9 ? d.slice(2) : d;
}

function sumarMeses(iso: string, meses: number): number {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + meses);
  return d.getTime();
}

function dias(ms: number): number {
  return Math.floor(ms / 86_400_000);
}

/** Meses "YYYY-MM" hacia atrás desde hoy, incluido el actual. */
function ultimosMeses(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(monthKey(d));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

/** Eventos del tenant de los últimos `n` meses. Nunca lanza. */
export async function eventosRecientes(tenantId: string, n = 4): Promise<AnalyticsEvent[]> {
  const listas = await Promise.all(
    ultimosMeses(n).map((m) => getMonthEvents(tenantId, m).catch(() => [] as AnalyticsEvent[])),
  );
  return listas.flat();
}

// -----------------------------------------------------------------------------
// A quién le toca
// -----------------------------------------------------------------------------

export type CandidatoRecall = {
  /** Clave estable del paciente dentro del tenant (teléfono normalizado). */
  clave: string;
  telefono: string;
  nombre: string;
  slug: string;
  /** Fecha de la última visita que consta (YYYY-MM-DD). */
  ultimaVisita: string;
  ultimoServicio: string;
  mesesRecomendados: number;
  motivo: string;
  /** Días que lleva pasado el momento de volver. 0 = le toca justo hoy. */
  diasDeRetraso: number;
  /** ISO del último aviso, si ya se le avisó. */
  avisadoEn?: string;
};

/** Días que se dejan pasar antes de volver a avisar al mismo paciente. */
export const DIAS_ENTRE_AVISOS = 90;

/** Tope de avisos por tenant y pasada, para que un cron no dispare cientos. */
export const MAX_POR_PASADA = 25;

function esVisitaReal(r: BookingRecord): boolean {
  if (r.tipo === "bloqueo") return false;
  if (r.estado === "cancelada" || r.estado === "no_show") return false;
  return true;
}

/**
 * Pacientes de un tenant a los que les toca revisión.
 *
 * Un paciente entra si: su ÚLTIMA visita fue hace más de lo que marca su
 * tratamiento, no tiene ninguna cita futura ya puesta, y no se le ha avisado en
 * los últimos DIAS_ENTRE_AVISOS días.
 *
 * `incluirAvisados: true` los devuelve igualmente (con `avisadoEn` relleno) para
 * poder enseñarlos en el panel sin volver a escribirles.
 */
export async function candidatosRecall(
  tenantId: string,
  opts: { incluirAvisados?: boolean } = {},
): Promise<CandidatoRecall[]> {
  const negocios = await getBusinessesForTenant(tenantId).catch(() => []);
  if (!negocios.length) return [];
  const slugs = new Set(negocios.map((b) => b.slug));

  const todas = await listRecords().catch(() => []);
  // Doble filtro (slug del tenant + tenantId del registro): ninguna reserva de
  // otro cliente puede colarse aunque uno de los dos campos venga mal.
  const propias = todas.filter((r) => slugs.has(r.slug) && r.tenantId === tenantId);

  const ahora = Date.now();
  const porPaciente = new Map<string, BookingRecord[]>();
  for (const r of propias) {
    const k = telefonoClave(r.cliente?.telefono);
    if (!k) continue;
    const l = porPaciente.get(k);
    if (l) l.push(r);
    else porPaciente.set(k, [r]);
  }

  // Avisos ya enviados, para no repetir.
  const eventos = await eventosRecientes(tenantId, 4);
  const ultimoAviso = new Map<string, string>();
  for (const e of eventos) {
    if (e.type !== "recall_enviado" || !e.senderId) continue;
    const k = telefonoClave(e.senderId);
    const prev = ultimoAviso.get(k);
    if (!prev || e.ts > prev) ultimoAviso.set(k, e.ts);
  }

  const out: CandidatoRecall[] = [];
  for (const [clave, citas] of porPaciente) {
    const validas = citas.filter(esVisitaReal);
    if (!validas.length) continue;

    // ¿Tiene algo ya en agenda? Entonces no hay nada que recordarle.
    const tieneFutura = validas.some((r) => Date.parse(r.startIso) > ahora);
    if (tieneFutura) continue;

    const pasadas = validas
      .filter((r) => Date.parse(r.startIso) <= ahora)
      .sort((a, b) => b.startIso.localeCompare(a.startIso));
    if (!pasadas.length) continue;

    const ultima = pasadas[0];
    const { meses, etiqueta } = intervaloDe(ultima.servicioNombre);
    const toca = sumarMeses(ultima.startIso, meses);
    if (toca > ahora) continue;

    const avisadoEn = ultimoAviso.get(clave);
    const avisadoHacePoco = !!avisadoEn && dias(ahora - Date.parse(avisadoEn)) < DIAS_ENTRE_AVISOS;
    if (avisadoHacePoco && !opts.incluirAvisados) continue;

    out.push({
      clave,
      telefono: ultima.cliente?.telefono || "",
      nombre: ultima.cliente?.nombre || "",
      slug: ultima.slug,
      ultimaVisita: ultima.startIso.slice(0, 10),
      ultimoServicio: ultima.servicioNombre || "—",
      mesesRecomendados: meses,
      motivo: etiqueta,
      diasDeRetraso: dias(ahora - toca),
      ...(avisadoHacePoco ? { avisadoEn } : {}),
    });
  }

  // Primero el que lleva más tiempo esperando.
  return out.sort((a, b) => b.diasDeRetraso - a.diasDeRetraso);
}

// -----------------------------------------------------------------------------
// Aviso por WhatsApp (Pablo)
// -----------------------------------------------------------------------------

/**
 * Interruptor maestro. OFF por defecto: el recall se calcula y se ve en el panel,
 * pero NO escribe a nadie. Se enciende cuando la clínica lo quiera y tenga la
 * plantilla de WhatsApp aprobada.
 */
export function recallSendEnabled(): boolean {
  return (process.env.RECALL_SEND_ENABLED || "").toLowerCase() === "true";
}

/**
 * Nombre de la plantilla aprobada en Meta, si la hay.
 *
 * IMPORTANTE Y SIN ADORNOS: un recall llega SIEMPRE fuera de la ventana de 24 h
 * (por definición, el paciente lleva meses sin escribir). WhatsApp solo permite
 * abrir conversación con una plantilla aprobada. Sin `RECALL_TEMPLATE` el texto
 * libre se enviará igual, pero Meta lo rechazará: por eso el resultado lo
 * distingue como `sin_plantilla` en vez de contarlo como enviado.
 */
function plantillaRecall(): string | null {
  return process.env.RECALL_TEMPLATE || null;
}

export type ResultadoAviso = {
  clave: string;
  telefono: string;
  enviado: boolean;
  modo: "enviado" | "flag_off" | "sin_plantilla" | "sin_credenciales" | "sin_telefono" | "error";
  detalle?: string;
};

/** Texto del aviso. Corto, sin presión y con la puerta abierta a responder. */
export function textoRecall(c: CandidatoRecall, negocio: string): string {
  const nombre = c.nombre ? c.nombre.split(" ")[0] : "";
  const saludo = nombre ? `Hola ${nombre}` : "Hola";
  return (
    `${saludo}, te escribimos de ${negocio}. ` +
    `Han pasado ${c.mesesRecomendados} meses desde tu última visita y te toca ${c.motivo}. ` +
    `¿Te viene bien que te busquemos hueco? Dime qué días te van mejor y lo miramos.`
  );
}

/**
 * Avisa a un paciente y deja el evento `recall_enviado`.
 *
 * El evento se escribe SOLO si el mensaje ha salido de verdad. Un aviso que no
 * se envió no debe contar luego como "revisión recuperada".
 */
export async function avisarRecall(
  tenantId: string,
  c: CandidatoRecall,
  negocio: string,
): Promise<ResultadoAviso> {
  const base = { clave: c.clave, telefono: c.telefono };
  if (!c.telefono) return { ...base, enviado: false, modo: "sin_telefono" };
  if (!recallSendEnabled()) return { ...base, enviado: false, modo: "flag_off" };

  const plantilla = plantillaRecall();
  if (!plantilla) {
    return {
      ...base,
      enviado: false,
      modo: "sin_plantilla",
      detalle: "Falta RECALL_TEMPLATE: fuera de la ventana de 24 h WhatsApp exige plantilla aprobada.",
    };
  }

  try {
    const r = await sendWhatsAppTemplate(c.telefono, plantilla, process.env.RECALL_TEMPLATE_LANG || "es", [
      c.nombre || "hola",
      negocio,
      c.motivo,
    ]);
    if (!r.ok) {
      return {
        ...base,
        enviado: false,
        modo: r.reason === "missing_credentials" ? "sin_credenciales" : "error",
        detalle: r.detail,
      };
    }
  } catch (e) {
    return { ...base, enviado: false, modo: "error", detalle: e instanceof Error ? e.message : "error" };
  }

  await logEvent(tenantId, {
    id: makeEventId("recall_enviado", c.clave, new Date().toISOString().slice(0, 10)),
    type: "recall_enviado",
    channel: "pablo",
    senderId: c.telefono,
    meta: {
      ultimaVisita: c.ultimaVisita,
      ultimoServicio: c.ultimoServicio,
      mesesRecomendados: c.mesesRecomendados,
      diasDeRetraso: c.diasDeRetraso,
    },
  }).catch(() => {});

  return { ...base, enviado: true, modo: "enviado" };
}

// -----------------------------------------------------------------------------
// Cuántos volvieron — el KPI
// -----------------------------------------------------------------------------

/**
 * Revisiones recuperadas: pacientes a los que se avisó y que DESPUÉS pidieron
 * cita. Se mira sobre los últimos meses porque un recall no se responde el mismo
 * día; encerrarlo en el mes natural daría casi siempre cero.
 *
 * Devuelve null si nunca se ha enviado un aviso: sin avisos no es que no vuelva
 * nadie, es que no hay nada que medir.
 */
export async function revisionesRecuperadas(
  tenantId: string,
): Promise<{ recuperadas: number; avisados: number } | null> {
  const eventos = await eventosRecientes(tenantId, 4);
  const avisos = eventos.filter((e) => e.type === "recall_enviado" && e.senderId);
  if (!avisos.length) return null;

  // Primer aviso de cada paciente.
  const primerAviso = new Map<string, string>();
  for (const e of avisos) {
    const k = telefonoClave(e.senderId);
    const prev = primerAviso.get(k);
    if (!prev || e.ts < prev) primerAviso.set(k, e.ts);
  }

  const citas = eventos.filter((e) => e.type === "appointment_set" && e.senderId);
  let recuperadas = 0;
  for (const [k, ts] of primerAviso) {
    if (citas.some((e) => telefonoClave(e.senderId) === k && e.ts > ts)) recuperadas++;
  }
  return { recuperadas, avisados: primerAviso.size };
}
