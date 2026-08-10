// =============================================================================
// RESTAURACIÓN — lo que un restaurante tiene y una peluquería no.
// =============================================================================
//
// El motor de reservas (booking.ts + orchestrator) NO se duplica: una mesa se
// guarda en el mismo `BookingRecord` que una cita, con los mismos estados y la
// misma agenda de Google. Lo que cambia es lo de aquí:
//
//   - Se reserva una MESA durante un rato (2 h por defecto) dentro de un TURNO,
//     no un servicio de duración variable a la hora que sea.
//   - Hay número de comensales y zona (terraza / interior).
//   - La reserva nace PENDIENTE y la valida el restaurante. Es lo que pidió el
//     sector: nadie deja que una IA confirme mesas el primer día.
//
// DOS MODOS DE USO, y esto manda sobre casi todo lo demás:
//
//   captacion → AI-Team recoge las reservas y las deja en su agenda; el dueño
//               las pasa a mano a su software de siempre. Por eso existe el
//               botón de COPIAR. Es el modo por defecto, porque entre el 60 y el
//               70 % de estos restaurantes ya pagan otro software y no lo van a
//               tirar el primer día.
//   gestion   → el restaurante trabaja solo con AI-Team.
//
// El plano de sala editable NO está aquí a propósito (va en un bloque posterior);
// lo único que se deja es el hueco en la config para que quepa sin migración.

// Módulo PURO, sin disco ni red, igual que `sectores.ts`: lo importan tanto el
// servidor como el panel del navegador (el botón de copiar necesita ZONA_LABEL).
// Por eso NO lleva `server-only`; los tipos de booking entran como `import type`
// y desaparecen en el build.
import type { BusinessBooking, BookingRecord } from "./booking";

// -----------------------------------------------------------------------------
// Configuración por negocio
// -----------------------------------------------------------------------------

export type ModoRestaurante = "captacion" | "gestion";

/** Dónde se sienta. "indiferente" es una respuesta válida, no un hueco sin rellenar. */
export type ZonaMesa = "terraza" | "interior" | "indiferente";

export const ZONAS: ZonaMesa[] = ["terraza", "interior", "indiferente"];

export const ZONA_LABEL: Record<ZonaMesa, string> = {
  terraza: "Terraza",
  interior: "Interior",
  indiferente: "Le da igual",
};

/**
 * Un turno de servicio. Los horarios NO se hardcodean: hay restaurantes que
 * abren el primer turno de cena a las 20:00 y otros a las 21:30, y ninguno de
 * los dos está equivocado.
 */
export type TurnoRestaurante = {
  id: string;
  nombre: string;
  /** Primera hora a la que se puede sentar alguien, "HH:mm". */
  desde: string;
  /** Última hora a la que se acepta una reserva de ese turno, "HH:mm". */
  hasta: string;
  /** Días de la semana en los que existe (0=domingo … 6=sábado). */
  dias: number[];
};

export type ConfigRestaurante = {
  modo: ModoRestaurante;
  /** Cuánto ocupa una mesa, en minutos. */
  duracionMesaMin: number;
  /** Margen de retraso antes de dar la mesa por perdida, en minutos. */
  cortesiaMin: number;
  turnos: TurnoRestaurante[];
  /**
   * false = confirmación HÍBRIDA: la reserva nace pendiente y la valida el
   * restaurante desde el panel. true = la IA confirma sola. Empieza en false y
   * lo enciende el dueño cuando coge confianza.
   */
  confirmacionAutomatica: boolean;
  zonas: { terraza: boolean; interior: boolean };
  /**
   * Hueco reservado para el PLANO DE SALA editable, que se construye aparte.
   * Se deja declarado para que añadirlo no obligue a migrar las configuraciones
   * ya guardadas.
   */
  plano?: { mesas?: unknown[]; version?: number };
};

/** Valores por defecto pactados: mesa de 2 h y 15 min de cortesía. */
export const DURACION_MESA_MIN = 120;
export const CORTESIA_MIN = 15;

/** Turnos de arranque. Se editan por restaurante; ninguno es obligatorio. */
export const TURNOS_POR_DEFECTO: TurnoRestaurante[] = [
  { id: "comida-1", nombre: "Comida · primer turno", desde: "13:00", hasta: "14:00", dias: [0, 1, 2, 3, 4, 5, 6] },
  { id: "comida-2", nombre: "Comida · segundo turno", desde: "15:00", hasta: "15:30", dias: [0, 5, 6] },
  { id: "cena-1", nombre: "Cena · primer turno", desde: "20:30", hasta: "21:15", dias: [1, 2, 3, 4, 5, 6] },
  { id: "cena-2", nombre: "Cena · segundo turno", desde: "22:30", hasta: "23:00", dias: [4, 5, 6] },
];

export const CONFIG_POR_DEFECTO: ConfigRestaurante = {
  modo: "captacion",
  duracionMesaMin: DURACION_MESA_MIN,
  cortesiaMin: CORTESIA_MIN,
  turnos: TURNOS_POR_DEFECTO,
  confirmacionAutomatica: false,
  zonas: { terraza: true, interior: true },
};

/**
 * La configuración de este negocio, con los valores por defecto rellenados.
 * Nunca devuelve null: un restaurante sin config es un restaurante con la de
 * serie, no un restaurante roto.
 */
export function configRestaurante(business?: Pick<BusinessBooking, "restaurante"> | null): ConfigRestaurante {
  const c = business?.restaurante;
  if (!c) return { ...CONFIG_POR_DEFECTO };
  return {
    modo: c.modo === "gestion" ? "gestion" : "captacion",
    duracionMesaMin: numeroPositivo(c.duracionMesaMin, DURACION_MESA_MIN),
    cortesiaMin: numeroPositivo(c.cortesiaMin, CORTESIA_MIN),
    turnos: c.turnos?.length ? c.turnos : TURNOS_POR_DEFECTO,
    confirmacionAutomatica: c.confirmacionAutomatica === true,
    zonas: { terraza: c.zonas?.terraza !== false, interior: c.zonas?.interior !== false },
    plano: c.plano,
  };
}

function numeroPositivo(v: unknown, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

// -----------------------------------------------------------------------------
// Turnos
// -----------------------------------------------------------------------------

const aMinutos = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
};

const aHora = (min: number): string =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Día de la semana (0=domingo) de una fecha "YYYY-MM-DD", sin líos de zona horaria. */
export function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
}

/** Turnos que existen ese día concreto. */
export function turnosDelDia(cfg: ConfigRestaurante, fecha: string): TurnoRestaurante[] {
  const dia = diaSemana(fecha);
  return cfg.turnos.filter((t) => t.dias.includes(dia));
}

/** A qué turno pertenece una hora "HH:mm" de ese día. null si no cae en ninguno. */
export function turnoDeHora(cfg: ConfigRestaurante, fecha: string, hora: string): TurnoRestaurante | null {
  const min = aMinutos(hora);
  if (Number.isNaN(min)) return null;
  return turnosDelDia(cfg, fecha).find((t) => min >= aMinutos(t.desde) && min <= aMinutos(t.hasta)) ?? null;
}

/**
 * Horas a las que se puede sentar gente ese día, en orden.
 *
 * Se generan del turno, cada `pasoMin` (15 por defecto): un restaurante no
 * sienta a las 21:07, sienta a y cuarto.
 */
export function horasDelDia(cfg: ConfigRestaurante, fecha: string, pasoMin = 15): string[] {
  const horas: string[] = [];
  for (const t of turnosDelDia(cfg, fecha)) {
    const desde = aMinutos(t.desde);
    const hasta = aMinutos(t.hasta);
    if (Number.isNaN(desde) || Number.isNaN(hasta)) continue;
    for (let m = desde; m <= hasta; m += pasoMin) horas.push(aHora(m));
  }
  return Array.from(new Set(horas)).sort();
}

/**
 * Dos alternativas para una hora que no puede ser, ordenadas por cercanía.
 *
 * Primero se buscan dentro del MISMO turno —cambiar de las 21:30 a las 21:45 es
 * un cambio que la gente acepta— y si ahí no queda nada, en el otro turno del
 * día. Devuelve como mucho dos: ofrecer cinco horas no es ayudar, es marear.
 */
export function alternativasDeHora(
  cfg: ConfigRestaurante,
  fecha: string,
  horaPedida: string,
  horasLibres: string[],
  cuantas = 2,
): string[] {
  const pedida = aMinutos(horaPedida);
  if (Number.isNaN(pedida)) return horasLibres.slice(0, cuantas);

  const turno = turnoDeHora(cfg, fecha, horaPedida);
  const enTurno = (h: string) => (turno ? turnoDeHora(cfg, fecha, h)?.id === turno.id : false);

  const ordenadas = [...horasLibres]
    .filter((h) => h !== horaPedida)
    .sort((a, b) => {
      // Mismo turno primero; dentro de cada grupo, lo más cerca de lo pedido.
      const ta = enTurno(a) ? 0 : 1;
      const tb = enTurno(b) ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return Math.abs(aMinutos(a) - pedida) - Math.abs(aMinutos(b) - pedida);
    });

  return ordenadas.slice(0, cuantas);
}

/**
 * Cuánto ocupa esta reserva en la agenda: la mesa más la cortesía.
 *
 * La cortesía se suma al bloque a propósito. Si la mesa son 2 h y das 15 min de
 * margen al que llega tarde, la mesa está pillada 2 h 15, no 2 h: sentar a otro
 * a las 2 h exactas es prometer una mesa que todavía está ocupada.
 */
export const minutosQueOcupa = (cfg: ConfigRestaurante): number => cfg.duracionMesaMin + cfg.cortesiaMin;

/**
 * Estado con el que nace una reserva nueva.
 *
 * Híbrido: pendiente por defecto, confirmada si el dueño ha encendido la
 * confirmación automática. `sinDatosPrevios` es la excepción que pidió el
 * sector: a un cliente del que no hay ficha, Carmen puede cerrarle la mesa en el
 * momento por teléfono en vez de dejarle esperando una confirmación.
 */
export function estadoInicialReserva(
  cfg: ConfigRestaurante,
  opts?: { sinDatosPrevios?: boolean },
): "pendiente" | "confirmada" {
  if (cfg.confirmacionAutomatica) return "confirmada";
  if (opts?.sinDatosPrevios) return "confirmada";
  return "pendiente";
}

// -----------------------------------------------------------------------------
// Interruptores de envío — todos FAIL-CLOSED
// -----------------------------------------------------------------------------
// Mismo criterio que el resto del sistema (WAITLIST_SEND_ENABLED,
// RECALL_SEND_ENABLED, INFORME_MENSUAL_SEND_ENABLED): si la variable no existe,
// no sale nada. Aquí importa más que en ningún otro sector: un restaurante mete
// cien reservas al día, así que un flag mal puesto son cien mensajes a gente
// real de una tacada.

/** Recordatorio de mesa del día antes, por WhatsApp, con confirmar/cancelar. */
export const restauranteRecordatorioEnabled = (): boolean =>
  (process.env.RESTAURANTE_RECORDATORIO_ENABLED || "").toLowerCase() === "true";

/** Aviso al comensal cuando se libera una mesa y estaba en lista de espera. */
export const restauranteEsperaEnabled = (): boolean =>
  (process.env.RESTAURANTE_ESPERA_SEND_ENABLED || "").toLowerCase() === "true";

// -----------------------------------------------------------------------------
// Ficha del comensal que vuelve — SOLO la ve el dueño
// -----------------------------------------------------------------------------

export type FichaComensal = {
  telefono: string;
  nombre: string;
  /** Veces que ha venido de verdad (reservas completadas). */
  visitas: number;
  /** Última visita, "YYYY-MM-DD". */
  ultimaVisita?: string;
  /** Zona que pide casi siempre. undefined = le da igual o no hay patrón. */
  zonaHabitual?: ZonaMesa;
  /** Con cuánta gente suele venir (lo más repetido). */
  personasHabituales?: number;
  /** Cuántas veces no apareció. */
  noShows: number;
  /** true a partir de la segunda visita: es lo que se marca en el panel del día. */
  habitual: boolean;
};

/** A partir de cuántas visitas se considera habitual. */
export const VISITAS_PARA_HABITUAL = 2;
/** Con qué proporción de repetición se da una zona por preferida. */
const UMBRAL_ZONA = 0.6;

const soloDigitos = (t: string) => (t || "").replace(/\D/g, "");

/**
 * Monta la ficha a partir de las reservas de ese teléfono.
 *
 * Es una función PURA: se le pasan los registros ya filtrados por negocio. Así
 * la puede usar el panel, el prompt del agente y una prueba sin tocar disco.
 */
export function fichaComensal(records: BookingRecord[], telefono: string): FichaComensal | null {
  const clave = soloDigitos(telefono);
  if (!clave) return null;

  const suyas = records
    .filter((r) => r.tipo !== "bloqueo" && soloDigitos(r.cliente?.telefono || "") === clave)
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
  if (!suyas.length) return null;

  const vinieron = suyas.filter((r) => r.estado === "completada");
  const noShows = suyas.filter((r) => r.estado === "no_show").length;
  const ultima = vinieron[vinieron.length - 1];

  // Zona: solo cuenta como preferencia si la pide de verdad casi siempre.
  const conZona = suyas.filter((r) => r.zona && r.zona !== "indiferente");
  const cuentaZona = new Map<string, number>();
  for (const r of conZona) cuentaZona.set(r.zona!, (cuentaZona.get(r.zona!) ?? 0) + 1);
  const [zonaTop, vecesZona] = [...cuentaZona.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const zonaHabitual =
    zonaTop && conZona.length > 0 && vecesZona / conZona.length >= UMBRAL_ZONA
      ? (zonaTop as ZonaMesa)
      : undefined;

  const cuentaPersonas = new Map<number, number>();
  for (const r of suyas) if (r.comensales) cuentaPersonas.set(r.comensales, (cuentaPersonas.get(r.comensales) ?? 0) + 1);
  const personasHabituales = [...cuentaPersonas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    telefono,
    nombre: ultima?.cliente?.nombre || suyas[suyas.length - 1].cliente?.nombre || "",
    visitas: vinieron.length,
    ultimaVisita: ultima?.startIso?.slice(0, 10),
    zonaHabitual,
    personasHabituales,
    noShows,
    habitual: vinieron.length >= VISITAS_PARA_HABITUAL,
  };
}

/**
 * Zona a proponer en la siguiente reserva. Si no hay patrón claro, NO se propone
 * nada: rellenar por él una preferencia que no tiene acaba sentando a la gente
 * donde no quería.
 */
export const zonaSugerida = (ficha: FichaComensal | null): ZonaMesa | undefined => ficha?.zonaHabitual;

// -----------------------------------------------------------------------------
// Cuántas alternativas se han ofrecido ya en esta conversación
// -----------------------------------------------------------------------------
//
// Hace falta para saber cuándo dejar de proponer horas y pasar a la lista de
// espera. Se cuenta leyendo el propio historial de la conversación en vez de
// guardar un contador aparte: ya se guarda el transcript, y un contador nuevo
// sería un estado más que mantener sincronizado y que caduca solo.

/** Marca invisible que se deja en el turno del agente al proponer horas. */
export const MARCA_ALTERNATIVA = "[alt]";

/** Cuántas veces se le han ofrecido horas alternativas en los últimos turnos. */
export function alternativasYaOfrecidas(turnos: Array<{ role: string; text: string }>): number {
  return turnos.filter((t) => t.role === "assistant" && t.text.includes(MARCA_ALTERNATIVA)).length;
}

/** Tras dos rondas de alternativas rechazadas se deja de insistir. */
export const MAX_RONDAS_ALTERNATIVAS = 2;

/**
 * Qué toca decir cuando la hora pedida no está libre.
 *
 * Devuelve las horas a ofrecer, o la orden de pasar a lista de espera. La
 * decisión vive aquí y no en el webhook para que Pablo y Carmen —que comparten
 * motor— hagan exactamente lo mismo.
 */
export function siguientePasoSinHueco(opts: {
  cfg: ConfigRestaurante;
  fecha: string;
  horaPedida: string;
  horasLibres: string[];
  rondasPrevias: number;
}): { accion: "ofrecer"; horas: string[] } | { accion: "lista_espera" } {
  if (opts.rondasPrevias >= MAX_RONDAS_ALTERNATIVAS) return { accion: "lista_espera" };
  const horas = alternativasDeHora(opts.cfg, opts.fecha, opts.horaPedida, opts.horasLibres);
  // Sin nada que ofrecer, no se marea: directo a la lista de espera.
  if (!horas.length) return { accion: "lista_espera" };
  return { accion: "ofrecer", horas };
}

/** El mensaje de las alternativas, con la marca para poder contarlas después. */
export function textoAlternativas(horas: string[]): string {
  if (horas.length === 1) return `${MARCA_ALTERNATIVA} A esa hora no me queda mesa. ¿Te encaja a las ${horas[0]}?`;
  return `${MARCA_ALTERNATIVA} A esa hora no me queda mesa. ¿Te encaja a las ${horas[0]} o a las ${horas[1]}?`;
}

/** El mensaje de la lista de espera, cuando ya no hay más horas que ofrecer. */
export function textoListaEspera(nombreNegocio?: string): string {
  return (
    `Ese día lo tengo completo${nombreNegocio ? ` en ${nombreNegocio}` : ""}. ` +
    `Te dejo apuntado en la lista de espera y te aviso por aquí si se libera una mesa. ¿Te va bien?`
  );
}

// -----------------------------------------------------------------------------
// Copiar la reserva — la pieza del modo CAPTACIÓN
// -----------------------------------------------------------------------------

/**
 * La reserva en texto plano, lista para pegar en el software del restaurante.
 *
 * Nada de integraciones con terceros: un botón que copia y un humano que pega
 * funciona el primer día, con cualquier software y sin pedirle credenciales a
 * nadie. Formato de una línea por dato, que es lo que se lee de un vistazo
 * mientras suena el teléfono.
 */
export function textoParaCopiar(rec: BookingRecord, cfg?: ConfigRestaurante): string {
  const hora = rec.startIso.slice(11, 16);
  const fecha = rec.startIso.slice(0, 10).split("-").reverse().join("/");
  const partes = [
    `${fecha} ${hora}`,
    `${rec.cliente?.nombre || "Sin nombre"}`,
    `${rec.comensales ?? "?"} personas`,
  ];
  if (rec.zona && rec.zona !== "indiferente") partes.push(ZONA_LABEL[rec.zona]);
  if (rec.cliente?.telefono) partes.push(rec.cliente.telefono);
  if (rec.nota?.trim()) partes.push(`Nota: ${rec.nota.trim()}`);
  if (cfg && cfg.duracionMesaMin !== DURACION_MESA_MIN) partes.push(`Mesa ${cfg.duracionMesaMin} min`);
  return partes.join(" · ");
}

// -----------------------------------------------------------------------------
// Panel del día
// -----------------------------------------------------------------------------

export type LineaDelDia = {
  record: BookingRecord;
  hora: string;
  comensales: number;
  zona: ZonaMesa;
  ficha: FichaComensal | null;
  /** Texto ya montado para el botón de copiar. */
  copiar: string;
};

export type ResumenDelDia = {
  fecha: string;
  lineas: LineaDelDia[];
  totalReservas: number;
  totalComensales: number;
  pendientes: number;
  confirmadas: number;
  sentadas: number;
  noShows: number;
};

/**
 * El servicio de hoy, ordenado por hora.
 *
 * `historico` son las reservas de siempre de ese negocio, para poder marcar
 * quién es habitual sin volver a leer disco por cada línea.
 */
export function resumenDelDia(
  delDia: BookingRecord[],
  historico: BookingRecord[],
  fecha: string,
  cfg: ConfigRestaurante,
): ResumenDelDia {
  const lineas = delDia
    .filter((r) => r.tipo !== "bloqueo" && r.estado !== "cancelada")
    .sort((a, b) => a.startIso.localeCompare(b.startIso))
    .map((record) => ({
      record,
      hora: record.startIso.slice(11, 16),
      comensales: record.comensales ?? 0,
      zona: (record.zona ?? "indiferente") as ZonaMesa,
      ficha: fichaComensal(historico, record.cliente?.telefono || ""),
      copiar: textoParaCopiar(record, cfg),
    }));

  return {
    fecha,
    lineas,
    totalReservas: lineas.length,
    totalComensales: lineas.reduce((s, l) => s + l.comensales, 0),
    pendientes: lineas.filter((l) => l.record.estado === "pendiente").length,
    confirmadas: lineas.filter((l) => l.record.estado === "confirmada").length,
    sentadas: lineas.filter((l) => l.record.estado === "completada").length,
    noShows: lineas.filter((l) => l.record.estado === "no_show").length,
  };
}
