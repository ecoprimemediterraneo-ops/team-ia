// CARMEN: llamadas salientes, urgencias, idioma e informe semanal.
//
// PROVEEDOR: Retell. Las llamadas ENTRANTES las contesta el agente de Carmen
// configurado en el panel de Retell (voz, modelo y número viven allí) y llama a
// este repo por funciones (`/api/carmen/agendar`, `/api/carmen/urgencia`,
// `/api/carmen/entrante`…). Las SALIENTES se piden a la API de Retell
// (`POST /v2/create-phone-call`) con:
//   RETELL_API_KEY                clave de la API de Retell
//   RETELL_AGENT_ID_SALIENTE      agente de Carmen para llamadas salientes
//   CARMEN_FROM_NUMBER            número de Retell desde el que se llama (E.164);
//                                 si falta, el `carmenPhoneNumber` del tenant
// Sin esas tres cosas, NO se llama a nadie: la llamada queda en MODO PRUEBA
// (se apunta en el registro y en el panel, sin gastar un céntimo).
//
// REGLAS FIJAS (no las decide ningún modelo):
//   · solo de 9:00 a 21:00 hora de España;
//   · solo a números que ya han hablado con el negocio (cita, WhatsApp o
//     llamada previa): nunca llamadas en frío;
//   · como mucho N llamadas al día por negocio (`carmenConfig.llamadasDiarias`,
//     20 por defecto);
//   · en local nunca sale una llamada real salvo al TEST_PHONE y con
//     CARMEN_LLAMADAS_REALES_LOCAL=1.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";
import { getTenant, type Tenant } from "./tenants";
import { getBusinessByTenant, listRecords } from "./booking";
import { logEvent, makeEventId, getMonthEvents, monthKey, type AnalyticsEvent } from "./event-log";
import { esLocal } from "./meta-graph-local";

export const LIMITE_DIARIO_POR_DEFECTO = 20;
export const URGENCIAS_POR_DEFECTO = ["urgencia", "urgente", "emergencia", "me duele mucho", "sangra", "reacción alérgica", "alergia", "hinchazón", "infección", "emergency", "urgent", "bleeding", "allergic"];

export type CarmenConfig = {
  /** Palabras que convierten una llamada en urgencia (se pasa al móvil del dueño). */
  urgencias?: string[];
  /** Máximo de llamadas salientes al día. */
  llamadasDiarias?: number;
};

const soloDigitos = (t: string) => (t || "").replace(/\D/g, "");
const cola9 = (t: string) => soloDigitos(t).slice(-9);

export function configCarmen(t: Tenant | null): Required<CarmenConfig> {
  const c = (t as (Tenant & { carmenConfig?: CarmenConfig }) | null)?.carmenConfig ?? {};
  return {
    urgencias: c.urgencias?.length ? c.urgencias : URGENCIAS_POR_DEFECTO,
    llamadasDiarias: c.llamadasDiarias && c.llamadasDiarias > 0 ? c.llamadasDiarias : LIMITE_DIARIO_POR_DEFECTO,
  };
}

// -----------------------------------------------------------------------------
// Idioma y urgencias
// -----------------------------------------------------------------------------

/** "en" si el texto está en inglés; si no, "es". Reglas simples, sin IA. */
export function idiomaDe(texto: string | undefined): "es" | "en" {
  const t = ` ${(texto || "").toLowerCase()} `;
  const en = (t.match(/\b(the|i|i'd|i'm|would|like|appointment|book|please|tomorrow|today|at|my|hello|hi|thanks|can|you|want|need|haircut|nails)\b/g) || []).length;
  const es = (t.match(/\b(el|la|de|que|quiero|cita|por|favor|mañana|hoy|a las|mi|hola|gracias|puedo|necesito|corte|uñas)\b/g) || []).length;
  return en > es ? "en" : "es";
}

/** ¿Hay alguna palabra de urgencia del negocio en lo que ha dicho el cliente? */
export function esUrgencia(texto: string, palabras: string[]): string | null {
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const t = norm(texto || "");
  return palabras.find((p) => p.trim() && t.includes(norm(p.trim()))) ?? null;
}

// -----------------------------------------------------------------------------
// Llamadas salientes
// -----------------------------------------------------------------------------

function horaMadrid(d = new Date()): { fecha: string; minutos: number } {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(d).reduce((a, x) => ((a[x.type] = x.value), a), {} as Record<string, string>);
  return { fecha: `${p.year}-${p.month}-${p.day}`, minutos: (+p.hour % 24) * 60 + +p.minute };
}

/** ¿Este teléfono ya ha tenido contacto con el negocio? (cita, WhatsApp o llamada) */
export async function yaContacto(tenantId: string, telefono: string): Promise<boolean> {
  const c = cola9(telefono);
  if (c.length < 9) return false;
  const negocio = await getBusinessByTenant(tenantId);
  if (negocio && (await listRecords()).some((r) => r.slug === negocio.slug && cola9(r.cliente?.telefono || "") === c)) return true;
  const ahora = new Date();
  const meses = [monthKey(ahora), monthKey(new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1, 1)))];
  for (const m of meses) {
    const ev = await getMonthEvents(tenantId, m).catch(() => [] as AnalyticsEvent[]);
    if (ev.some((e) => e.type === "message_in" && cola9(e.senderId || "") === c)) return true;
  }
  return false;
}

const FICHERO_CUENTA = path.join(process.cwd(), "data", "carmen-llamadas.json");
async function contarHoy(tenantId: string, sumar: boolean): Promise<number> {
  const k = `carmen-llamadas:${tenantId}:${horaMadrid().fecha}`;
  let n = 0;
  if (supabaseEnabled()) n = (await kvGet<number>(k)) ?? 0;
  else { try { n = (JSON.parse(await fs.readFile(FICHERO_CUENTA, "utf-8")) as Record<string, number>)[k] ?? 0; } catch { n = 0; } }
  if (sumar) {
    n++;
    if (supabaseEnabled()) await kvSet(k, n);
    else {
      let m: Record<string, number> = {};
      try { m = JSON.parse(await fs.readFile(FICHERO_CUENTA, "utf-8")); } catch { /* vacío */ }
      m[k] = n;
      await fs.mkdir(path.dirname(FICHERO_CUENTA), { recursive: true });
      await fs.writeFile(FICHERO_CUENTA, JSON.stringify(m, null, 2));
    }
  }
  return n;
}

export type MotivoLlamada = "recordatorio" | "rescate" | "demo";
export type ResultadoLlamada =
  | { ok: true; modo: "real" | "prueba"; callId?: string; detalle: string }
  | { ok: false; motivo: "fuera_de_hora" | "sin_contacto_previo" | "limite_diario" | "sin_telefono" | "error"; detalle: string };

export function estadoProveedor(tenant?: Tenant | null): { proveedor: "Retell"; listo: boolean; numero?: string; falta: string[] } {
  const numero = process.env.CARMEN_FROM_NUMBER || tenant?.carmenPhoneNumber || undefined;
  const falta = [
    !process.env.RETELL_API_KEY && "RETELL_API_KEY",
    !process.env.RETELL_AGENT_ID_SALIENTE && "RETELL_AGENT_ID_SALIENTE",
    !numero && "CARMEN_FROM_NUMBER (o el número de Carmen del negocio)",
  ].filter(Boolean) as string[];
  return { proveedor: "Retell", listo: falta.length === 0, numero, falta };
}

/**
 * Pide a Carmen que llame. Pasa SIEMPRE por las reglas fijas; si falta algo del
 * proveedor, queda en modo prueba.
 */
export async function lanzarLlamada(o: {
  tenantId: string; telefono: string; motivo: MotivoLlamada; variables?: Record<string, string>; ahora?: Date;
}): Promise<ResultadoLlamada> {
  const tel = soloDigitos(o.telefono);
  if (tel.length < 9) return { ok: false, motivo: "sin_telefono", detalle: "Falta un teléfono válido." };
  const { minutos } = horaMadrid(o.ahora);
  if (minutos < 9 * 60 || minutos >= 21 * 60) return { ok: false, motivo: "fuera_de_hora", detalle: "Carmen solo llama de 9:00 a 21:00 (hora de España)." };
  const tenant = await getTenant(o.tenantId);
  const esPrueba = o.motivo === "demo";
  // La demo solo puede ir al móvil de prueba (TEST_PHONE) o a un contacto real.
  const esTestPhone = !!process.env.TEST_PHONE && cola9(process.env.TEST_PHONE) === cola9(tel);
  if (!(esPrueba && esTestPhone) && !(await yaContacto(o.tenantId, tel))) {
    return { ok: false, motivo: "sin_contacto_previo", detalle: "Ese número nunca ha contactado con el negocio: Carmen no hace llamadas en frío." };
  }
  const limite = configCarmen(tenant).llamadasDiarias;
  if ((await contarHoy(o.tenantId, false)) >= limite) return { ok: false, motivo: "limite_diario", detalle: `Ya se han hecho las ${limite} llamadas de hoy.` };

  const destino = `+${tel.startsWith("34") || tel.length > 9 ? tel : `34${tel}`}`;
  const prov = estadoProveedor(tenant);
  const negocio = await getBusinessByTenant(o.tenantId);
  const variables = { negocio: negocio?.nombre || tenant?.name || "", motivo: o.motivo, ...(o.variables ?? {}) };
  const localBloqueado = esLocal() && !(process.env.CARMEN_LLAMADAS_REALES_LOCAL === "1" && esTestPhone);

  let res: ResultadoLlamada;
  if (!prov.listo || localBloqueado) {
    res = {
      ok: true, modo: "prueba",
      detalle: !prov.listo
        ? `Modo prueba: falta ${prov.falta.join(", ")}. No se ha llamado a nadie.`
        : "Modo prueba en local: no se llama a nadie (solo al TEST_PHONE con CARMEN_LLAMADAS_REALES_LOCAL=1).",
    };
  } else {
    try {
      const r = await fetch("https://api.retellai.com/v2/create-phone-call", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RETELL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from_number: prov.numero, to_number: destino, override_agent_id: process.env.RETELL_AGENT_ID_SALIENTE, retell_llm_dynamic_variables: variables, metadata: { tenantId: o.tenantId, motivo: o.motivo } }),
        signal: AbortSignal.timeout(15_000),
      });
      const j = (await r.json().catch(() => ({}))) as { call_id?: string; message?: string };
      res = r.ok ? { ok: true, modo: "real", callId: j.call_id, detalle: "Llamada en curso." } : { ok: false, motivo: "error", detalle: `Retell: ${j.message || r.status}` };
    } catch (e) {
      res = { ok: false, motivo: "error", detalle: e instanceof Error ? e.message : String(e) };
    }
  }
  if (res.ok) await contarHoy(o.tenantId, true);
  await logEvent(o.tenantId, {
    id: makeEventId("carmen_saliente", tel, String(Date.now())),
    type: "message_out",
    channel: "carmen",
    senderId: tel,
    meta: { kind: "llamada_saliente", motivo: o.motivo, modo: res.ok ? res.modo : "rechazada", detalle: res.detalle, callId: res.ok ? res.callId : undefined },
  }).catch(() => {});
  return res;
}

// -----------------------------------------------------------------------------
// Informe semanal
// -----------------------------------------------------------------------------

export type InformeCarmen = { desde: string; hasta: string; llamadas: number; citas: number; rescatadas: number; euros: number; texto: string };

/** Lo que ha hecho Carmen en los últimos 7 días. Todo sale de datos guardados; nada estimado. */
export async function informeSemanal(tenantId: string, ahora = new Date()): Promise<InformeCarmen> {
  const hasta = new Date(ahora);
  const desde = new Date(ahora.getTime() - 7 * 86_400_000);
  const meses = [...new Set([monthKey(desde), monthKey(hasta)])];
  const ev = (await Promise.all(meses.map((m) => getMonthEvents(tenantId, m).catch(() => [] as AnalyticsEvent[])))).flat()
    .filter((e) => e.channel === "carmen" && Date.parse(e.ts) >= desde.getTime() && Date.parse(e.ts) <= hasta.getTime());
  const llamadas = ev.filter((e) => e.type === "message_in" && (e.meta as { kind?: string } | undefined)?.kind === "llamada").length;
  const citasEv = ev.filter((e) => e.type === "appointment_set");
  const salientes = new Set(ev.filter((e) => (e.meta as { kind?: string } | undefined)?.kind === "llamada_saliente").map((e) => cola9(e.senderId || "")));
  const rescatadas = citasEv.filter((e) => salientes.has(cola9(e.senderId || ""))).length;
  const negocio = await getBusinessByTenant(tenantId);
  const recs = negocio ? (await listRecords()).filter((r) => r.slug === negocio.slug) : [];
  let euros = 0;
  for (const e of citasEv) {
    const eid = (e.meta as { eventId?: string } | undefined)?.eventId;
    const r = recs.find((x) => x.eventId === eid) ?? recs.find((x) => cola9(x.cliente?.telefono || "") === cola9(e.senderId || "") && x.estado !== "cancelada");
    const precio = r?.precioEUR ?? negocio?.servicios.find((s) => s.id === r?.serviceId)?.precioEUR ?? 0;
    if (r?.estado !== "cancelada") euros += precio || 0;
  }
  const f = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" });
  const texto = [
    `Carmen, semana del ${f(desde)} al ${f(hasta)}${negocio ? ` en ${negocio.nombre}` : ""}:`,
    `- Llamadas atendidas: ${llamadas}`,
    `- Citas cerradas: ${citasEv.length}`,
    `- Perdidas rescatadas: ${rescatadas}`,
    `- Euros recuperados: ${Math.round(euros)} €`,
  ].join("\n");
  return { desde: desde.toISOString(), hasta: hasta.toISOString(), llamadas, citas: citasEv.length, rescatadas, euros: Math.round(euros), texto };
}

// -----------------------------------------------------------------------------
// WhatsApp al dueño (urgencias e informe)
// -----------------------------------------------------------------------------

/**
 * Manda un aviso al WhatsApp del dueño (`ownerWhatsapp`). Fuera de la ventana de
 * 24 h Meta solo acepta plantillas: si existe la plantilla indicada (aprobada),
 * va por plantilla; si no, se intenta el texto (MODO PRUEBA: solo llega si el
 * dueño escribió al número en las últimas 24 h) y se dice así.
 */
export async function avisarAlDueno(tenantId: string, texto: string, plantilla?: { nombre?: string; idioma?: string; variables: string[] }): Promise<{ enviado: boolean; modo: string; detalle?: string }> {
  const t = await getTenant(tenantId);
  const a = t?.ownerWhatsapp;
  if (!a) return { enviado: false, modo: "sin_movil_del_dueno", detalle: "El negocio no tiene WhatsApp del dueño (ownerWhatsapp)." };
  const { sendWhatsAppText, sendWhatsAppTemplate } = await import("./whatsapp-sender");
  const rastro = { tenantId, a, motivo: "aviso_dueno_carmen" };
  if (plantilla?.nombre) {
    const r = await sendWhatsAppTemplate(a, plantilla.nombre, plantilla.idioma || "es", plantilla.variables, rastro);
    return { enviado: r.ok, modo: r.ok ? (("simulado" in r && r.simulado) ? "simulado_local" : "plantilla") : "error", detalle: r.ok ? undefined : r.detail };
  }
  const r = await sendWhatsAppText(a, texto, rastro);
  return { enviado: r.ok, modo: r.ok ? (("simulado" in r && r.simulado) ? "simulado_local" : "texto_modo_prueba") : "error", detalle: r.ok ? undefined : r.detail };
}

// -----------------------------------------------------------------------------
// Recordatorio: WhatsApp primero; si en 3 h no confirma, llama Carmen
// -----------------------------------------------------------------------------
// UN SOLO SISTEMA para los dos agentes: el cron de recordatorios manda el
// WhatsApp y apunta `recordatorioEnviadoEn`; esta pasada (cada hora, desde n8n)
// llama a quien no haya contestado "sí" en 3 horas. Cada cita se llama UNA vez
// (`llamadaRecordatorioEn`), y si el cliente confirma por WhatsApp
// (`confirmadaPorClienteEn`) ya no se le llama.

export async function pasadaLlamadasRecordatorio(ahora = new Date()): Promise<{ llamadas: number; prueba: number; saltadas: string[] }> {
  const { listRecords: lr, actualizarRecord, getBusinessBySlug, localToEpoch } = await import("./booking");
  const { agenteContratado } = await import("./tenants");
  const out = { llamadas: 0, prueba: 0, saltadas: [] as string[] };
  const pendiente = (x: { tipo?: string; estado: string; recordatorioEnviadoEn?: string; confirmadaPorClienteEn?: string; llamadaRecordatorioEn?: string }) =>
    x.tipo !== "bloqueo" && x.estado === "confirmada" && !!x.recordatorioEnviadoEn && !x.confirmadaPorClienteEn && !x.llamadaRecordatorioEn &&
    Date.parse(x.recordatorioEnviadoEn) <= ahora.getTime() - 3 * 3600_000;
  for (const r of await lr()) {
    if (!pendiente(r)) continue;
    const tel = r.cliente?.telefono || "";
    if (!tel || /^ig:/i.test(tel)) continue;
    const b = await getBusinessBySlug(r.slug);
    if (!b || localToEpoch(r.startIso, b.timezone || "Europe/Madrid") < ahora.getTime()) continue;
    if (!(await agenteContratado(b.tenantId, "carmen"))) continue;
    // UNA SOLA LLAMADA POR CITA. Se "reserva" la llamada ANTES de hacerla, con el
    // candado de la agenda y sobre la cita tal como está ahora: si dos pasadas
    // coinciden (n8n cada hora + una a mano), solo una la consigue; y si el
    // cliente ha confirmado o cancelado mientras tanto, no se llama. Antes se
    // apuntaba DESPUÉS de llamar, con la copia vieja: dos pasadas llamaban dos
    // veces, y una cancelación hecha durante la llamada se deshacía.
    const marca = ahora.toISOString();
    const reservada = await actualizarRecord(r.id, "llamada-recordatorio", (fresca) =>
      pendiente(fresca) ? { ...fresca, llamadaRecordatorioEn: marca } : null,
    );
    if (!reservada.ok || !reservada.record) continue;
    const res = await lanzarLlamada({ tenantId: b.tenantId, telefono: tel, motivo: "recordatorio", ahora, variables: { cliente: r.cliente.nombre, servicio: r.servicioNombre || "", cuando: r.startIso.slice(0, 16).replace("T", " "), anular: r.token } });
    if (!res.ok) {
      // No se ha llamado: se quita la marca para que la siguiente pasada lo intente.
      await actualizarRecord(r.id, "llamada-recordatorio", (fresca) =>
        fresca.llamadaRecordatorioEn === marca ? { ...fresca, llamadaRecordatorioEn: undefined } : null,
      );
      out.saltadas.push(`${r.id}: ${res.motivo}`);
      continue;
    }
    if (res.modo === "real") out.llamadas++; else out.prueba++;
  }
  return out;
}
