// Fechas y horas dichas en castellano ("mañana a las 10", "el jueves a las 5 de
// la tarde", "a las cinco y media") → "YYYY-MM-DDTHH:MM:SS" en hora de Madrid.
//
// Vivía dentro de la ruta de Carmen (`/api/carmen/agendar`). Se saca aquí para
// que Pablo lo use igual al mover una cita por WhatsApp: una sola forma de
// entender una hora dicha, no dos que acaben entendiendo cosas distintas.

import * as chrono from "chrono-node";

const PAD = (n: number) => String(n).padStart(2, "0");

/** Componentes de "ahora" en Europe/Madrid (para resolver relativos: mañana, jueves…). */
function madridNow(): { y: number; mo: number; d: number; h: number; mi: number } {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  })
    .formatToParts(new Date())
    .reduce((a, x) => ((a[x.type] = x.value), a), {} as Record<string, string>);
  return { y: +p.year, mo: +p.month, d: +p.day, h: p.hour === "24" ? 0 : +p.hour, mi: +p.minute };
}

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const sinTildes = (x: string) => x.normalize("NFD").replace(DIACRITICS, "");
const NUM_ES: Record<string, number> = {
  una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};

/**
 * Extrae la HORA de una expresión española y la devuelve en 24h. Cubre lo que
 * chrono.es NO resuelve bien: meridiano ("de la tarde/noche/mañana/madrugada"),
 * números escritos ("a las cinco"), "y media/cuarto", "mediodía/medianoche".
 * Solo la considera hora si va anclada a "a las…" o lleva meridiano → no confunde
 * el número de un día ("el 10 de julio"). Devuelve null si no hay hora clara.
 */
function parseHoraEs(textLow: string): { hour: number; min: number } | null {
  const t = sinTildes(textLow);
  if (/\bmediodia\b/.test(t)) return { hour: 12, min: 0 };
  if (/\bmedianoche\b/.test(t)) return { hour: 0, min: 0 };
  const num = Object.keys(NUM_ES).join("|");
  const meridiem = "(?:\\s+(?:de\\s+la|del|de)\\s+(manana|tarde|noche|madrugada|mediodia))?";
  const cuerpo = `\\b(\\d{1,2}|${num})\\b(?:\\s*[:.h]\\s*(\\d{2}))?(?:\\s+y\\s+(media|cuarto|treinta|quince))?${meridiem}`;
  // 1) "a las 4 [de la tarde]"  2) "4 de la tarde" (meridiano explícito).
  let m = t.match(new RegExp(`(?:a\\s+las?\\s+)${cuerpo}`));
  if (!m) m = t.match(new RegExp(`${cuerpo.replace(meridiem, "")}\\s+(?:de\\s+la|del|de)\\s+(manana|tarde|noche|madrugada|mediodia)`));
  if (!m) return null;
  let hour = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUM_ES[m[1]];
  if (hour == null || hour > 23) return null;
  let min = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3]) min = /media|treinta/.test(m[3]) ? 30 : 15;
  const mer = m[4];
  if (mer) {
    if (mer === "tarde") { if (hour >= 1 && hour < 12) hour += 12; }
    else if (mer === "noche") { if (hour >= 1 && hour < 12) hour += 12; else if (hour === 12) hour = 0; }
    else if (mer === "madrugada") { if (hour === 12) hour = 0; } // "12 de la madrugada" = 00:00
    // "de la mañana": AM tal cual; "las 12 de la mañana" = mediodía → se queda 12.
    else if (mer === "mediodia") hour = 12;
  }
  if (min > 59) return null;
  return { hour, min };
}

/**
 * Convierte la fecha a "YYYY-MM-DDTHH:MM:SS" (hora local Europe/Madrid) aceptando:
 *   - ISO ya formado ("2026-07-10T10:00[:00]") o con espacio → passthrough.
 *   - Lenguaje natural español: "mañana a las 10", "el 10 de julio a las 11",
 *     "jueves a las 4 de la tarde", "pasado mañana", "el lunes que viene a las 9:30"…
 * chrono.es resuelve la FECHA (forwardDate); la HORA la fija parseHoraEs (meridiano
 * español) y prevalece sobre la de chrono. SIEMPRE futuro (guardia anti-pasado).
 * Devuelve "" si no logra fecha CON hora (el llamador pedirá repetir).
 */
/** Lo que devuelve `normalizarFecha` cuando se pide una hora de HOY que ya ha pasado. */
export const PASADO = "PASADO";

export function normalizarFecha(raw: string, opts: { fechaBase?: string } = {}): string {
  let s = String(raw).trim();
  if (!s) return "";
  // Ya viene en ISO (o con espacio en vez de T): determinista, no tocamos.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) return s.replace(" ", "T");

  const now = madridNow();
  const low = s.toLowerCase();

  // "pasado mañana" → chrono.es no siempre lo cubre: lo sustituimos por su fecha.
  if (/\bpasado\s+ma[nñ]ana\b/.test(low)) {
    const t = new Date(Date.UTC(now.y, now.mo - 1, now.d + 2));
    s = low.replace(/\bpasado\s+ma[nñ]ana\b/, `${t.getUTCFullYear()}-${PAD(t.getUTCMonth() + 1)}-${PAD(t.getUTCDate())}`);
  }

  // Referencia = "ahora" en Madrid codificado como UTC → chrono opera sobre los
  // mismos números de calendario; solo usamos los COMPONENTES del resultado (TZ-safe).
  const ref = new Date(Date.UTC(now.y, now.mo - 1, now.d, now.h, now.mi));
  let results: ReturnType<typeof chrono.es.parse>;
  try {
    results = chrono.es.parse(s, ref, { forwardDate: true });
  } catch {
    return "";
  }
  const horaEs = parseHoraEs(low);
  if (!results.length && !(horaEs && opts.fechaBase)) return "";
  const c = results[0]?.start;
  // SIN DÍA DICHO Y CON FECHA DE REFERENCIA ("pásamela a las 17:00" hablando
  // de una cita concreta): el día es el de esa cita, no hoy.
  const diaDicho = !!c && (c.isCertain("day") || c.isCertain("weekday"));
  let y = c?.get("year") ?? null;
  let mo = c?.get("month") ?? null;
  let d = c?.get("day") ?? null;
  if (!diaDicho && opts.fechaBase && /^\d{4}-\d{2}-\d{2}/.test(opts.fechaBase) && !/\b(hoy|ma[nñ]ana)\b/.test(low)) {
    [y, mo, d] = opts.fechaBase.slice(0, 10).split("-").map(Number);
  }

  // HORA: parseHoraEs (español) manda; si no la detecta, la de chrono.
  const hh = horaEs ? horaEs.hour : c?.get("hour");
  const mi = horaEs ? horaEs.min : (c?.get("minute") ?? 0);
  if (!y || !mo || !d || hh === null || hh === undefined) return ""; // sin hora → que pida repetir

  // "HOY a las 11" cuando ya son las 18:45 NO es mañana a las 11: es una hora
  // pasada, y quien llama tiene que decirlo y ofrecer otra. Antes se empujaba
  // en silencio al día siguiente y se reservaba un día que nadie había pedido.
  const nowMs = Date.UTC(now.y, now.mo - 1, now.d, now.h, now.mi);
  if (/\bhoy\b/.test(low) && Date.UTC(y, mo - 1, d, hh, mi) < nowMs) return PASADO;

  // Guardia "nunca en el pasado": si quedó antes de ahora (Madrid), empuja al futuro
  // más cercano — mismo día ya pasado → +1 día; fecha absoluta ya pasada este año → +1 año.
  if (Date.UTC(y, mo - 1, d, hh, mi) < nowMs) {
    if (y === now.y && mo === now.mo && d === now.d) {
      const t = new Date(Date.UTC(y, mo - 1, d + 1, hh, mi));
      return `${t.getUTCFullYear()}-${PAD(t.getUTCMonth() + 1)}-${PAD(t.getUTCDate())}T${PAD(hh)}:${PAD(mi)}:00`;
    }
    return `${y + 1}-${PAD(mo)}-${PAD(d)}T${PAD(hh)}:${PAD(mi)}:00`;
  }
  return `${y}-${PAD(mo)}-${PAD(d)}T${PAD(hh)}:${PAD(mi)}:00`;
}

