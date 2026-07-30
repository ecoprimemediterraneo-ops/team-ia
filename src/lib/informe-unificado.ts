// =============================================================================
// Informe mensual UNIFICADO — un solo renderer, un solo email.
// =============================================================================
//
// Antes había DOS informes que no se hablaban:
//   A) Reservas (ingresos/citas/ocupación) — se renderizaba en booking-email.ts
//      (`construirInformeMensual`) y SÍ se enviaba por Resend desde el cron.
//   B) Valor generado (mensajes/leads/ventas/tiempo/€) — se renderizaba en JSX
//      dentro de /admin/informe y NO se enviaba nunca a nadie.
//
// Este módulo los fusiona. Es la ÚNICA fuente del informe: lo consumen tanto el
// envío por email (/api/cron/informe-mensual) como la vista previa de admin
// (/admin/informe), que pinta exactamente el mismo HTML dentro de un iframe. Al
// no haber un segundo renderer, no pueden volver a divergir.
//
// Secciones, en orden:
//   1. Reservas y citas      ← informe() de booking.ts        (por SLUG de negocio)
//   2. Valor generado        ← generarInformeEsencial()       (por TENANT)
//   3. Contenido publicado   ← eventos post_published + calendario de Marta
//   4. Reseñas               ← PREPARADA, COMENTADA Y VACÍA hasta que Rocío se
//                              desbloquee (ver `seccionResenas` más abajo)
//
// OJO con las claves: las reservas van por `slug` de negocio y el valor generado
// por `tenantId`. Un tenant puede tener varios negocios (hoy `demo` y
// `bendito-arte` cuelgan los dos de `tenant_aiteam`): en ese caso cada negocio
// recibe SU sección de reservas, pero comparten las de valor y contenido, porque
// los eventos se registran a nivel de tenant, no de local.

import "server-only";
import {
  informe as informeReservas,
  getBusinessBySlug,
  listBusinesses,
  resolveCalendarEmail,
  type Informe,
  type BusinessBooking,
} from "./booking";
import {
  emailShell,
  esc,
  enviarEmail,
  yaAvisado,
  marcarAvisado,
} from "./booking-email";
import { generarInformeEsencial, type MetricasEsencial } from "./informe-mensual";
import { getMonthEvents } from "./event-log";
import { listCalendar } from "./marta-calendar";
import { getTenant, DEFAULT_TENANT_ID } from "./tenants";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// -----------------------------------------------------------------------------
// Periodo
// -----------------------------------------------------------------------------

export type Periodo = {
  from: string;       // "YYYY-MM-01"
  to: string;         // "YYYY-MM-<último día>"
  periodoKey: string; // "YYYY-MM"
  label: string;      // "julio 2026"
};

/**
 * Periodo del mes anterior a hoy, o del `YYYY-MM` explícito que se pase.
 * Vive aquí (y no en la ruta del cron) para que el email y la vista previa de
 * admin calculen el mismo rango sin copiar la lógica.
 */
export function periodoMes(mesParam?: string | null): Periodo | null {
  let y: number, m0: number; // m0 = mes 0-11
  if (mesParam) {
    const mm = /^(\d{4})-(\d{2})$/.exec(mesParam);
    if (!mm) return null;
    y = Number(mm[1]);
    m0 = Number(mm[2]) - 1;
    if (m0 < 0 || m0 > 11) return null;
  } else {
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    y = prev.getUTCFullYear();
    m0 = prev.getUTCMonth();
  }
  const ultimoDia = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  const mm2 = String(m0 + 1).padStart(2, "0");
  return {
    from: `${y}-${mm2}-01`,
    to: `${y}-${mm2}-${String(ultimoDia).padStart(2, "0")}`,
    periodoKey: `${y}-${mm2}`,
    label: `${MESES[m0]} ${y}`,
  };
}

// -----------------------------------------------------------------------------
// Sección 3 — contenido publicado por Marta
// -----------------------------------------------------------------------------

export type PostPublicado = {
  fecha: string;        // ISO de publicación REAL
  entryId?: string;
  igMediaId?: string;
  permalink?: string;   // enlace público; ausente si Meta no lo devolvió
  tema?: string;
  caption: string;
  mediaType?: string;
  origen: "evento" | "calendario";
};

/**
 * Posts que Marta publicó en el mes, con su enlace.
 *
 * Fuente principal: los eventos `post_published` del event-log, que es lo que
 * escribe el publicador real (ver marta-auto-publish). Fuente de respaldo: las
 * entradas del calendario en estado "published" de ese mes — necesaria porque
 * los posts publicados ANTES de que existiera el evento no tienen registro en el
 * log y, si no, el informe los contaría como cero. Se deduplican por entryId y
 * por igMediaId, así que un post nunca sale dos veces.
 */
export async function listarPostsPublicados(
  tenantId: string,
  mes: string,
): Promise<PostPublicado[]> {
  const posts: PostPublicado[] = [];
  const vistosEntry = new Set<string>();
  const vistosMedia = new Set<string>();

  const eventos = await getMonthEvents(tenantId, mes);
  for (const e of eventos) {
    if (e.type !== "post_published") continue;
    const meta = (e.meta ?? {}) as Record<string, unknown>;
    const entryId = typeof meta.entryId === "string" ? meta.entryId : undefined;
    const igMediaId = typeof meta.igMediaId === "string" ? meta.igMediaId : undefined;
    if (entryId) vistosEntry.add(entryId);
    if (igMediaId) vistosMedia.add(igMediaId);
    posts.push({
      fecha: e.ts,
      entryId,
      igMediaId,
      permalink: typeof meta.permalink === "string" ? meta.permalink : undefined,
      tema: typeof meta.tema === "string" ? meta.tema : undefined,
      caption: typeof meta.caption === "string" ? meta.caption : "",
      mediaType: typeof meta.mediaType === "string" ? meta.mediaType : undefined,
      origen: "evento",
    });
  }

  // Respaldo: publicados que el log no tiene (histórico anterior al evento).
  try {
    const entradas = await listCalendar(tenantId);
    for (const c of entradas) {
      if (c.status !== "published") continue;
      const fecha = c.publishedAt || c.scheduledAt;
      if (!fecha.startsWith(mes)) continue;
      if (vistosEntry.has(c.id)) continue;
      if (c.igMediaId && vistosMedia.has(c.igMediaId)) continue;
      posts.push({
        fecha,
        entryId: c.id,
        igMediaId: c.igMediaId,
        tema: c.tema,
        caption: c.caption,
        mediaType: c.mediaType,
        origen: "calendario",
      });
    }
  } catch (err) {
    console.warn("[informe-unificado] no se pudo leer el calendario de Marta:", err);
  }

  return posts.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// -----------------------------------------------------------------------------
// Recopilación de datos
// -----------------------------------------------------------------------------

export type InformeUnificado = {
  generadoEn: string;
  tenantId: string;
  nombreCabecera: string;         // negocio si lo hay; si no, nombre del tenant
  slug?: string;
  periodo: Periodo;
  reservas: Informe | null;       // null = el tenant no tiene negocio de reservas
  valor: MetricasEsencial | null; // null = el tenant no existe
  narrativa: string;
  contenido: PostPublicado[];
  // resenas: pendiente de Rocío — ver `seccionResenas`.
};

/**
 * Junta las tres secciones. No renderiza nada: solo datos, para que el mismo
 * objeto sirva al email y a la vista previa.
 *
 * `business` manda: si viene, la sección de reservas es la suya y el tenant sale
 * de `business.tenantId`. Sin negocio (preview de un tenant suelto) la sección
 * de reservas se omite y el informe se queda en valor + contenido.
 */
export async function recopilarInforme(opts: {
  business?: BusinessBooking | null;
  tenantId?: string;
  periodo: Periodo;
}): Promise<InformeUnificado> {
  const { business, periodo } = opts;
  const tenantId = business?.tenantId || opts.tenantId || DEFAULT_TENANT_ID;

  const reservas = business
    ? await informeReservas(business.slug, periodo.from, periodo.to)
    : null;

  // Reutiliza tal cual el bloque "esencial": métricas + narrativa de Haiku.
  const esencial = await generarInformeEsencial(tenantId, periodo.periodoKey);
  const bloque = esencial?.bloques[0] ?? null;

  const contenido = await listarPostsPublicados(tenantId, periodo.periodoKey);

  const tenant = business ? null : await getTenant(tenantId);
  const nombreCabecera = business?.nombre || tenant?.name || tenantId;

  return {
    generadoEn: new Date().toISOString(),
    tenantId,
    nombreCabecera,
    slug: business?.slug,
    periodo,
    reservas,
    valor: bloque?.metricas ?? null,
    narrativa: bloque?.narrativa ?? "",
    contenido,
  };
}

// -----------------------------------------------------------------------------
// Render — HTML de email (tablas inline, sin CSS externo ni flex/grid)
// -----------------------------------------------------------------------------

const euros = (n: number) => `${Math.round(n || 0)} €`;
const plural = (n: number, sing: string, pl: string) => (n === 1 ? sing : pl);

function tituloSeccion(n: number, texto: string): string {
  return `<div style="font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.14em;text-transform:uppercase;color:#fff;background:#000;padding:7px 10px;margin:26px 0 12px">${n}. ${esc(texto)}</div>`;
}

/**
 * Rejilla de KPIs, a prueba de clientes de correo.
 *
 * OJO — no volver al patrón anterior (`border-spacing:6px` + `margin:0 -6px`):
 * el margen negativo desplazaba la tabla 6px a la izquierda respecto a los
 * títulos de sección y al botón final (medido: KPIs en 161→717 y el resto en
 * 167→723), y encima Gmail y Outlook tratan los márgenes negativos en <table>
 * de forma inconsistente. Aquí el hueco entre tarjetas se hace con PADDING
 * dentro de cada <td> y la tarjeta visible es un <div> interior, así que la
 * tabla mide exactamente el ancho del contenido y todo queda a la misma línea.
 */
type CeldaKpi = { label: string; valor: string; destacado?: boolean };

function filaKpi(celdas: CeldaKpi[]): string {
  const n = celdas.length;
  const tds = celdas.map((c, i) => {
    const izq = i === 0 ? 0 : 3;
    const der = i === n - 1 ? 0 : 3;
    return `<td width="${Math.round(100 / n)}%" style="width:${Math.round(100 / n)}%;padding:0 ${der}px 6px ${izq}px;vertical-align:top">
        <div style="padding:12px;border:2px solid #000;background:${c.destacado ? "#F5C518" : "#fff"};font-family:Arial,sans-serif">
          <div style="font-size:11px;color:${c.destacado ? "#5a4a00" : "#777"};text-transform:uppercase;letter-spacing:.05em">${esc(c.label)}</div>
          <div style="font-size:22px;font-weight:bold;color:#0c0c0c;margin-top:2px">${c.valor}</div>
        </div>
      </td>`;
  });
  return `<tr>${tds.join("")}</tr>`;
}

function tablaKpis(filas: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
      ${filas.join("")}
    </table>`;
}

function parrafoVacio(texto: string): string {
  return `<p style="font-family:Arial,sans-serif;font-size:14px;color:#999;margin:6px 0 0">${esc(texto)}</p>`;
}

// --- 1. Reservas --------------------------------------------------------------

function seccionReservas(inf: Informe | null, nombreNegocio: string): string {
  if (!inf) {
    return tituloSeccion(1, "Reservas y citas") +
      parrafoVacio("Este cliente todavía no tiene el motor de reservas activo.");
  }
  const lista = (items: { nombre: string; citas: number; ingresos: number }[]) =>
    `<ul style="margin:6px 0 0;padding-left:18px;font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#333">
      ${items.map((s) => `<li>${esc(s.nombre)} — <b>${s.citas}</b> ${plural(s.citas, "cita", "citas")}${s.ingresos ? ` · ${euros(s.ingresos)}` : ""}</li>`).join("")}
    </ul>`;
  const topSvc = (inf.porServicio || []).slice(0, 5);
  const topEmp = (inf.porEmpleado || []).slice(0, 5);
  const svcHtml = topSvc.length ? lista(topSvc) : parrafoVacio("Sin servicios este mes.");
  const empHtml = topEmp.length > 1
    ? `<div style="font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#0c0c0c;margin:18px 0 0">Por profesional</div>${lista(topEmp)}`
    : "";

  return tituloSeccion(1, "Reservas y citas") +
    `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333;margin:0 0 12px">Cómo ha ido la agenda de ${esc(nombreNegocio)}:</div>
    ${tablaKpis([
      filaKpi([
        { label: "Ingresos", valor: euros(inf.ingresos), destacado: true },
        { label: "Citas completadas", valor: String(inf.citas.completadas) },
      ]),
      filaKpi([
        { label: "Clientas nuevas", valor: String(inf.clientes.nuevos) },
        { label: "Ocupación", valor: `${inf.ocupacion.pct}%` },
      ]),
    ])}
    <div style="font-family:Arial,sans-serif;font-size:13px;color:#555;margin:12px 0 0;line-height:1.6">
      ${inf.citas.total} citas en total · ${inf.citas.canceladas} ${plural(inf.citas.canceladas, "cancelada", "canceladas")} · ${inf.citas.noShow} no-show (${inf.tasaNoShow}%) · ${inf.clientes.recurrentes} ${plural(inf.clientes.recurrentes, "clienta recurrente", "clientas recurrentes")}.
    </div>
    <div style="font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#0c0c0c;margin:18px 0 0">Servicios más pedidos</div>
    ${svcHtml}
    ${empHtml}`;
}

// --- 2. Valor generado --------------------------------------------------------

function seccionValor(m: MetricasEsencial | null, narrativa: string, minutosPorInteraccion: number): string {
  if (!m) {
    return tituloSeccion(2, "Valor generado por tu equipo IA") +
      parrafoVacio("Sin datos de agentes este mes.");
  }
  const narrativaHtml = narrativa
    ? `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#333;margin:14px 0 0;padding:14px;background:#FAF8F3;border-left:4px solid #F5C518">${esc(narrativa)}</div>`
    : "";

  return tituloSeccion(2, "Valor generado por tu equipo IA") +
    tablaKpis([
      filaKpi([
        { label: "Valor económico", valor: euros(m.valorEconomicoEUR), destacado: true },
        { label: "Tiempo ahorrado", valor: `${m.tiempoAhorradoHoras} h`, destacado: true },
      ]),
      filaKpi([
        { label: "Mensajes atendidos", valor: String(m.mensajesAtendidos) },
        { label: "Conversaciones", valor: String(m.conversacionesUnicas) },
      ]),
      filaKpi([
        { label: "Leads captados", valor: String(m.leads) },
        { label: "Ventas cerradas", valor: String(m.ventas) },
      ]),
    ]) +
    `<div style="font-family:Arial,sans-serif;font-size:13px;color:#555;margin:12px 0 0;line-height:1.6">
      ${m.citas} ${plural(m.citas, "cita agendada", "citas agendadas")} por los agentes · conversión lead→venta ${Math.round(m.tasaConversion * 100)}% · tiempo estimado a ${minutosPorInteraccion} min por interacción.
    </div>
    ${narrativaHtml}`;
}

// --- 3. Contenido publicado ---------------------------------------------------

function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${parseInt(m[3], 10)} de ${MESES[parseInt(m[2], 10) - 1]}`;
}

function seccionContenido(posts: PostPublicado[], mesLabel: string): string {
  const cab = tituloSeccion(3, "Contenido publicado");
  if (!posts.length) {
    return cab + parrafoVacio(`Marta no publicó ningún post en ${mesLabel}.`);
  }
  const items = posts.map((p) => {
    const titulo = p.tema?.trim() || p.caption.split("\n")[0].slice(0, 80) || "Post";
    const extracto = p.caption.replace(/\s+/g, " ").trim().slice(0, 120);
    const enlace = p.permalink
      ? `<a href="${esc(p.permalink)}" style="color:#C8202A;font-weight:bold;text-decoration:none">Ver en Instagram →</a>`
      : `<span style="color:#999">Publicado (enlace no disponible)</span>`;
    // El hueco entre tarjetas va en el padding-bottom del <td>, no en
    // border-spacing: mismo criterio que la rejilla de KPIs, para que todas las
    // secciones caigan exactamente sobre la misma línea izquierda y derecha.
    return `<tr><td style="padding:0 0 6px 0">
        <div style="padding:10px 12px;border:2px solid #000;background:#fff;font-family:Arial,sans-serif">
          <div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:.05em">${esc(fechaCorta(p.fecha))}${p.mediaType && p.mediaType !== "IMAGE" ? ` · ${esc(p.mediaType)}` : ""}</div>
          <div style="font-size:15px;font-weight:bold;color:#0c0c0c;margin:2px 0">${esc(titulo)}</div>
          ${extracto ? `<div style="font-size:13px;color:#555;line-height:1.5;margin:0 0 6px">${esc(extracto)}…</div>` : ""}
          <div style="font-size:13px">${enlace}</div>
        </div>
      </td></tr>`;
  }).join("");

  return cab +
    `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333;margin:0 0 10px"><b>${posts.length}</b> ${plural(posts.length, "post publicado", "posts publicados")} en ${esc(mesLabel)}.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${items}</table>`;
}

// --- 4. Reseñas — PREPARADA, COMENTADA Y VACÍA --------------------------------

/**
 * Sección de reseñas de Google (Rocío). BLOQUEADA: Rocío está pendiente de la
 * API de Google, así que hoy esta función devuelve "" y en el informe no aparece
 * nada — ni un hueco, ni un "próximamente".
 *
 * Para activarla cuando Rocío se desbloquee:
 *   1. Los eventos ya existen en el event-log: `review_in` (reseña recibida) y
 *      `review_replied` (contestada por Rocío). No hay que inventar tipos.
 *   2. Descomentar el cuerpo de abajo y añadir `resenas` a InformeUnificado,
 *      rellenándolo en `recopilarInforme` con un getMonthCounts() del tenant.
 *   3. Llamarla desde `renderInformeUnificado` justo después de seccionContenido.
 *
 * export type ResumenResenas = { recibidas: number; respondidas: number; mediaEstrellas?: number };
 *
 * function seccionResenas(r: ResumenResenas | null, mesLabel: string): string {
 *   const cab = tituloSeccion(4, "Reseñas de Google");
 *   if (!r || !r.recibidas) return cab + parrafoVacio(`Sin reseñas nuevas en ${mesLabel}.`);
 *   return cab + tablaKpis([
 *     filaKpi([
 *       { label: "Reseñas recibidas", valor: String(r.recibidas), destacado: true },
 *       { label: "Respondidas por Rocío", valor: String(r.respondidas) },
 *     ]),
 *     ...(r.mediaEstrellas ? [filaKpi([
 *       { label: "Valoración media", valor: `${r.mediaEstrellas.toFixed(1)} ★` },
 *       { label: "Sin responder", valor: String(r.recibidas - r.respondidas) },
 *     ])] : []),
 *   ]);
 * }
 */
function seccionResenas(): string {
  return "";
}

// --- Ensamblado ---------------------------------------------------------------

/**
 * Base ABSOLUTA del panel. El informe se lee en Gmail, fuera de la app: un
 * enlace relativo o al host de la petición (localhost en la vista previa) no
 * sirve. Mismo patrón que `calendar.ts`.
 */
const PANEL_BASE = (process.env.NEXT_PUBLIC_SITE_URL || "https://aiteam.marketing").replace(/\/$/, "");

/**
 * URL del botón final: abre el panel de reservas YA colocado en el negocio del
 * informe, en la pestaña Informes y con el mes del informe cargado, sin que el
 * dueño toque nada. El soporte de estos tres parámetros se añadió al panel
 * (`dashboard/reservas/page.tsx` → `ReservasPanel` → `InformesView`); antes no
 * existía y el enlace aterrizaba en Agenda con el primer negocio de la lista,
 * que no tenía por qué ser el del informe.
 */
export function urlPanelInformes(slug?: string, mes?: string): string {
  if (!slug) return `${PANEL_BASE}/dashboard`;
  const qs = new URLSearchParams({ negocio: slug, tab: "informes" });
  if (mes) qs.set("mes", mes);
  return `${PANEL_BASE}/dashboard/reservas?${qs.toString()}`;
}

/**
 * Bloque final: botón centrado "a prueba de balas" para email — tabla anidada
 * con `align="center"`, el color y el borde en el <td> y el <a> en `display:block`
 * con el padding dentro (así toda la superficie es pulsable en Gmail móvil).
 *
 * La tabla exterior va a `width:100%` y sin márgenes, de modo que el bloque
 * ocupa exactamente el mismo ancho que los títulos de sección y las rejillas de
 * KPIs, y el centrado del botón coincide con el centro real del contenido.
 */
function bloqueCta(url: string, nombreNegocio: string, mesLabel: string, tieneNegocio: boolean): string {
  const nota = tieneNegocio
    ? `Se abre en los informes de <b>${esc(nombreNegocio)}</b>, con ${esc(mesLabel)} ya cargado.`
    : `Se abre en tu panel de AI-Team.`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:26px 0 0">
      <tr><td align="center" style="padding:0">
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="border-collapse:collapse">
          <tr><td align="center" style="background:#F5C518;border:2px solid #000">
            <a href="${esc(url)}" style="display:block;padding:13px 26px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#000;text-decoration:none;line-height:1.2">Ver el detalle en tu panel →</a>
          </td></tr>
        </table>
        <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#777;margin:10px 0 0">${nota}</div>
      </td></tr>
    </table>`;
}

/**
 * EL renderer. Devuelve el asunto y el HTML completo del email. Lo usan por
 * igual el envío (/api/cron/informe-mensual) y la vista previa (/admin/informe).
 */
export function renderInformeUnificado(
  inf: InformeUnificado,
  minutosPorInteraccion = 4,
): { subject: string; html: string } {
  const subject = `Tu informe de ${inf.periodo.label} — ${inf.nombreCabecera}`.slice(0, 140);
  const dash = urlPanelInformes(inf.slug, inf.periodo.periodoKey);

  const cuerpo =
    `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333;margin:0 0 4px">Este es el resumen de <b>${esc(inf.periodo.label)}</b>: lo que ha pasado en tu agenda, lo que ha generado tu equipo de agentes y lo que se ha publicado.</div>` +
    seccionReservas(inf.reservas, inf.nombreCabecera) +
    seccionValor(inf.valor, inf.narrativa, minutosPorInteraccion) +
    seccionContenido(inf.contenido, inf.periodo.label) +
    seccionResenas() +
    bloqueCta(dash, inf.nombreCabecera, inf.periodo.label, !!inf.slug);

  return {
    subject,
    html: emailShell(inf.nombreCabecera, `📊 Informe de ${inf.periodo.label}`, cuerpo, undefined, 600),
  };
}

// -----------------------------------------------------------------------------
// Atajos de alto nivel
// -----------------------------------------------------------------------------

/** Recopila + renderiza de un tirón. Lo que llama la vista previa de admin. */
export async function construirInformeUnificado(opts: {
  business?: BusinessBooking | null;
  tenantId?: string;
  periodo: Periodo;
}): Promise<{ subject: string; html: string; informe: InformeUnificado }> {
  const informe = await recopilarInforme(opts);
  const tenant = await getTenant(informe.tenantId);
  const { subject, html } = renderInformeUnificado(informe, tenant?.minutesPerInteraction ?? 4);
  return { subject, html, informe };
}

/**
 * Envía el informe unificado al dueño del negocio (resolveCalendarEmail) por
 * Resend. Anti-duplicado por (slug, mes) con el mismo ledger de siempre: no
 * reenvía el mismo mes salvo `force`. Best-effort — nunca lanza.
 */
export async function enviarInformeUnificado(
  business: BusinessBooking,
  periodo: Periodo,
  opts?: { force?: boolean },
): Promise<{ enviado: boolean; modo: string; to?: string; posts?: number }> {
  const key = `informe:${business.slug}:${periodo.periodoKey}`;
  if (!opts?.force && (await yaAvisado(key))) return { enviado: false, modo: "duplicado" };

  let to: string | undefined;
  try {
    to = await resolveCalendarEmail(business);
  } catch {
    to = undefined;
  }
  if (!to) return { enviado: false, modo: "sin_email_dueno" };

  const { subject, html, informe } = await construirInformeUnificado({ business, periodo });
  const r = await enviarEmail(to, subject, html);
  if (r.intentado) await marcarAvisado(key);
  return { enviado: r.enviado, modo: r.modo, to, posts: informe.contenido.length };
}

/** Negocio de reservas de un tenant (el primero). null si el tenant no tiene ninguno. */
export async function primerNegocioDelTenant(tenantId: string): Promise<BusinessBooking | null> {
  const todos = await listBusinesses();
  return todos.find((b) => b.tenantId === tenantId) ?? null;
}

export { getBusinessBySlug };
