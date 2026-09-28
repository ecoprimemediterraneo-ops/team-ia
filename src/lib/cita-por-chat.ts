// Lo que Pablo (WhatsApp) hace con las citas SIN depender del criterio del
// modelo: reglas fijas, con el estado de la conversación guardado.
//
//   · El guion cuando la hora pedida no está libre (ver `guion-huecos.ts`).
//   · Cancelar y cambiar la hora DESDE EL CHAT. Antes Pablo solo mandaba el
//     enlace de autocancelación y el cliente tenía que salir a la web; ahora lo
//     hace él: pregunta, el cliente contesta, y la cita se cancela o se mueve con
//     el mismo motor que los botones de la agenda. El hueco queda libre solo,
//     porque una cita cancelada o movida deja de ocupar la agenda.
//
// Todo devuelve `{ texto, via }` (lo que se contesta y cómo se registra) o null
// si no le toca: entonces sigue el flujo normal.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";
import {
  getBusinessByTenant, citasActivasDeCliente, cambiarEstadoRecord, reprogramarRecord, getRecord, getEmpleado, ausenteEl,
  localToEpoch, type BookingRecord, type BusinessBooking,
} from "./booking";
import { reservarSlot } from "./orchestrator";
import type { EventChannel } from "./event-log";
import { avisarHuecoLiberado } from "./booking-liberado";
import { normalizarFecha, PASADO } from "./fecha-es";
import {
  huecosCercanos, huecosSegunPreferencia, leerPreferencia, eligeOpcion, esRechazo, cuandoHablado, listaDeOpciones,
  urlHuecos, leerGuion, guardarGuion, type EstadoGuion,
} from "./guion-huecos";
import { esIntencionCancelar } from "./booking-cancel-intent";
import { esSi, esNo } from "./chat-honesto";

const REDIRECT = "https://aiteam.marketing/api/lucia/callback";
const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_URL || "https://aiteam.marketing").replace(/\/$/, "");
const FUNDADOR = () => process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export type Respuesta = { texto: string; via: string };

// =============================================================================
// EL GUION DE "ESA HORA NO ESTÁ LIBRE"
// =============================================================================

/**
 * La hora pedida no se puede: se ofrecen dos huecos reales cercanos. Si ya se
 * han fallado dos rondas, se manda el enlace de huecos libres.
 */
export async function ofrecerAlternativas(o: {
  tenantId: string; contacto: string; startIso: string; motivo: string; nombre?: string; empleadoId?: string;
  porque?: "pasado" | "fuera_de_horario" | "ocupado" | "no_calendar";
}): Promise<Respuesta> {
  const negocio = await getBusinessByTenant(o.tenantId);
  const previo = await leerGuion(o.tenantId, o.contacto);
  // Pedir otra hora concreta que tampoco está libre, con una oferta ya hecha, es una ronda fallida.
  const rondas = previo ? previo.rondasFallidas + 1 : 0;
  const intro =
    o.porque === "pasado" ? "Esa hora ya ha pasado."
    : o.porque === "fuera_de_horario" ? "A esa hora no estamos abiertos."
    : `A las ${o.startIso.slice(11, 16)} no me queda hueco.`;

  if (rondas >= 2 && negocio) return enlace(o.tenantId, o.contacto, negocio, o.motivo, intro);

  const opciones = await huecosCercanos(o.tenantId, { startIso: o.startIso, motivo: o.motivo, empleadoId: o.empleadoId });
  if (!opciones.length) {
    await guardarGuion(o.tenantId, o.contacto, { fase: "preguntado", rondasFallidas: Math.max(1, rondas), ofrecidos: [], motivo: o.motivo, nombre: o.nombre, empleadoId: o.empleadoId, ts: Date.now() });
    return { texto: `${intro} Esa semana lo tengo complicado: dime que dias y a que horas te vienen bien y te lo busco.`, via: "agenda_guion_pregunta" };
  }
  await guardarGuion(o.tenantId, o.contacto, { fase: "ofrecido", rondasFallidas: rondas, ofrecidos: opciones, motivo: o.motivo, nombre: o.nombre, empleadoId: o.empleadoId, ts: Date.now() });
  return {
    texto: `${intro} Te puedo dar ${listaDeOpciones(opciones)}. Te va bien ${opciones.length > 1 ? "alguna" : "esa"}?`,
    via: "agenda_guion_oferta",
  };
}

async function enlace(tenantId: string, contacto: string, negocio: BusinessBooking, motivo: string, intro = ""): Promise<Respuesta> {
  await guardarGuion(tenantId, contacto, null);
  return {
    texto: `${intro ? `${intro} ` : ""}Te dejo aqui todos los huecos libres para que elijas el que mejor te venga, y se reserva al momento:\n${urlHuecos(negocio.slug, motivo)}`,
    via: "agenda_guion_enlace",
  };
}

/** El cliente contesta a una oferta o a "qué días te vienen bien". */
export async function pasoGuion(o: {
  tenantId: string; contacto: string; texto: string; nombreCliente?: string; agenteOrigen: EventChannel;
}): Promise<Respuesta | null> {
  const g = await leerGuion(o.tenantId, o.contacto);
  if (!g) return null;
  const negocio = await getBusinessByTenant(o.tenantId);
  if (!negocio) return null;

  // 1) Elige una de las que se le ofrecieron → se reserva esa, sin pasar por la IA.
  const elegido = g.fase === "ofrecido" ? eligeOpcion(o.texto, g.ofrecidos) : null;
  if (elegido) {
    const res = await reservarSlot({
      tenantId: o.tenantId, userEmail: FUNDADOR(), redirectUri: REDIRECT,
      nombre: g.nombre || o.nombreCliente || "Cliente", motivo: g.motivo, startIso: elegido,
      agenteOrigen: o.agenteOrigen, customerPhone: o.contacto, empleadoId: g.empleadoId,
    });
    if (res.ok) {
      await guardarGuion(o.tenantId, o.contacto, null);
      return { texto: `Hecho, te dejo ${g.motivo} ${cuandoHablado(elegido)}. Si necesitas cambiarla, dimelo por aqui.`, via: "agenda_cita_creada" };
    }
    if (res.reason === "slot_taken" || res.reason === "locked") {
      return ofrecerAlternativas({ tenantId: o.tenantId, contacto: o.contacto, startIso: elegido, motivo: g.motivo, nombre: g.nombre, empleadoId: g.empleadoId, porque: "ocupado" });
    }
    return null;
  }

  // 2) Se le preguntó qué le viene bien → se busca en toda la semana con eso.
  if (g.fase === "preguntado") {
    const pref = leerPreferencia(o.texto);
    if (pref) {
      const opciones = await huecosSegunPreferencia(o.tenantId, { motivo: g.motivo, empleadoId: g.empleadoId, pref });
      if (!opciones.length) return enlace(o.tenantId, o.contacto, negocio, g.motivo, "Con eso no me queda nada esta semana.");
      await guardarGuion(o.tenantId, o.contacto, { ...g, fase: "ofrecido", ofrecidos: opciones });
      return { texto: `Con eso tengo ${listaDeOpciones(opciones)}. Te encaja ${opciones.length > 1 ? "alguna" : "esa"}?`, via: "agenda_guion_oferta" };
    }
    if (esRechazo(o.texto)) return enlace(o.tenantId, o.contacto, negocio, g.motivo);
    return null; // dice otra cosa (p. ej. un día y hora concretos): sigue el flujo normal
  }

  // 3) No quiere ninguna de las ofrecidas.
  if (esRechazo(o.texto)) {
    const rondas = g.rondasFallidas + 1;
    if (rondas >= 2) return enlace(o.tenantId, o.contacto, negocio, g.motivo, "Vaya.");
    await guardarGuion(o.tenantId, o.contacto, { ...g, fase: "preguntado", rondasFallidas: rondas, ofrecidos: [] });
    return { texto: "Vale. Dime que dias y a que horas te vienen bien y te lo busco en toda la semana.", via: "agenda_guion_pregunta" };
  }
  return null;
}

/** Tras reservar por el camino normal, el guion ya no pinta nada. */
export async function cerrarGuion(tenantId: string, contacto: string): Promise<void> {
  await guardarGuion(tenantId, contacto, null).catch(() => {});
}
export type { EstadoGuion };

// =============================================================================
// CANCELAR Y CAMBIAR LA HORA DESDE EL CHAT
// =============================================================================

type Pendiente =
  | { accion: "confirmar_cancelar"; recordId: string; ts: number }
  | { accion: "pedir_hora"; recordId: string; ofrecidos?: string[]; ts: number }
  | { accion: "elegir"; ids: string[]; para: "cancelar" | "mover"; horaNueva?: string; ts: number };

const FICHERO = path.join(process.cwd(), "data", "pablo-gestion.json");
const clave = (t: string, c: string) => `gestion:${t}:${c}`;
const TTL_MS = 24 * 3600_000;

async function leerP(t: string, c: string): Promise<Pendiente | null> {
  const k = clave(t, c);
  let v: Pendiente | null = null;
  if (supabaseEnabled()) v = await kvGet<Pendiente>(k);
  else { try { v = (JSON.parse(await fs.readFile(FICHERO, "utf-8")) as Record<string, Pendiente>)[k] ?? null; } catch { v = null; } }
  return v && v.ts && Date.now() - v.ts < TTL_MS ? v : null;
}
async function guardarP(t: string, c: string, v: Pendiente | null): Promise<void> {
  const k = clave(t, c);
  if (supabaseEnabled()) { await kvSet(k, v ?? { ts: 0 }); return; }
  let todo: Record<string, Pendiente> = {};
  try { todo = JSON.parse(await fs.readFile(FICHERO, "utf-8")); } catch { /* vacío */ }
  if (v) todo[k] = v; else delete todo[k];
  await fs.mkdir(path.dirname(FICHERO), { recursive: true });
  await fs.writeFile(FICHERO, JSON.stringify(todo, null, 2));
}

const servicioDe = (r: BookingRecord) => [r.servicioNombre, r.varianteNombre].filter(Boolean).join(" · ") || "tu cita";
const describir = (r: BookingRecord) => `${servicioDe(r)} ${cuandoHablado(r.startIso)}${r.empleadoNombre ? ` con ${r.empleadoNombre}` : ""}`;

/** "cambiar", "mover", "pasar a", "otra hora"… (frente a cancelar sin más). */
export function esIntencionMover(t: string): boolean {
  return /\b(cambi\w*|mov\w*|reprogram\w*|pas(a|ar|ame|amela|ármela|armela|ala|arla) (la|mi)?\s*(cita)? ?(a|al|para)\b|otra hora|otro d[ií]a|adelant\w*|retras\w*|atras\w*|aplaz\w*|pospon\w*)/i.test(t);
}

async function cancelar(tenantId: string, r: BookingRecord): Promise<Respuesta> {
  const res = await cambiarEstadoRecord(r.id, "cancelada", REDIRECT, r.slug);
  if (!res.ok) return { texto: "No he podido cancelarla ahora mismo. Te la cancela alguien del equipo en un momento.", via: "cancelacion_fallida" };
  // Lista de espera: el mismo aviso que el botón de la agenda.
  await avisarHuecoLiberado(res.record, SITE(), REDIRECT).catch(() => {});
  void tenantId;
  return { texto: `Cancelada tu cita de ${describir(r)}. Si quieres otra, dime que dia y a que hora.`, via: "cancelacion_hecha" };
}

async function mover(tenantId: string, contacto: string, r: BookingRecord, nuevo: string): Promise<Respuesta> {
  const negocio = await getBusinessByTenant(tenantId);
  if (!negocio) return { texto: "No encuentro la agenda ahora mismo.", via: "cambio_fallido" };
  // Mismas reglas que una reserva nueva: horario de SU profesional, vacaciones y antelación.
  const emp = r.empleadoId ? getEmpleado(negocio, r.empleadoId) : undefined;
  const dia = (emp?.horario ?? negocio.horario)[new Date(`${nuevo.slice(0, 10)}T12:00:00Z`).getUTCDay()];
  const min = Number(nuevo.slice(11, 13)) * 60 + Number(nuevo.slice(14, 16));
  const cabe = !!dia?.abierto && dia.franjas.some((f) => {
    const [a, b] = f.desde.split(":").map(Number); const [c, d] = f.hasta.split(":").map(Number);
    return min >= a * 60 + b && min + r.durationMin <= c * 60 + d;
  });
  const lead = negocio.leadTimeMin ?? 60;
  const pasada = localToEpoch(nuevo, negocio.timezone || "Europe/Madrid") < Date.now() + lead * 60_000;
  let porque: "pasado" | "fuera_de_horario" | "ocupado" | null = pasada ? "pasado" : !cabe || ausenteEl(emp, nuevo) ? "fuera_de_horario" : null;
  if (!porque) {
    const res = await reprogramarRecord(r.id, nuevo, undefined, REDIRECT, r.slug);
    if (res.ok) {
      await guardarP(tenantId, contacto, null);
      // El hueco viejo queda libre: aviso a la lista de espera, como en la agenda.
      await avisarHuecoLiberado({ ...r }, SITE(), REDIRECT).catch(() => {});
      return { texto: `Hecho, te paso ${servicioDe(r)} a ${cuandoHablado(nuevo)}${r.empleadoNombre ? ` con ${r.empleadoNombre}` : ""}. Te esperamos.`, via: "cambio_hecho" };
    }
    if (res.reason !== "slot_taken" && res.reason !== "locked") return { texto: "No he podido moverla ahora mismo. Te escribe alguien del equipo.", via: "cambio_fallido" };
    porque = "ocupado";
  }
  const opciones = await huecosCercanos(tenantId, { startIso: nuevo, motivo: r.servicioNombre || "", empleadoId: r.empleadoId });
  await guardarP(tenantId, contacto, { accion: "pedir_hora", recordId: r.id, ofrecidos: opciones, ts: Date.now() });
  const intro = porque === "pasado" ? "Esa hora ya ha pasado." : porque === "fuera_de_horario" ? "A esa hora no estamos abiertos." : `A las ${nuevo.slice(11, 16)} no hay hueco.`;
  return {
    texto: opciones.length ? `${intro} Te la puedo pasar a ${listaDeOpciones(opciones)}. Cual prefieres?` : `${intro} Dime otro dia y hora y lo miro.`,
    via: "cambio_alternativas",
  };
}

/**
 * ¿Quiere cancelar o cambiar su cita (o está contestando a eso)? Lo resuelve
 * aquí, en el chat. `contacto` es el teléfono (Pablo).
 */
export async function gestionarCitaExistente(o: { tenantId: string; contacto: string; texto: string }): Promise<Respuesta | null> {
  const negocio = await getBusinessByTenant(o.tenantId);
  if (!negocio) return null;
  const p = await leerP(o.tenantId, o.contacto);

  // "SÍ" AL RECORDATORIO. Si tiene una cita con recordatorio enviado y sin
  // confirmar, un "sí" la confirma y Carmen ya no le llamará.
  if (!p && esSi(o.texto)) {
    const pendientes = (await citasActivasDeCliente(negocio.slug, o.contacto)).filter((c) => c.recordatorioEnviadoEn && !c.confirmadaPorClienteEn);
    if (pendientes.length) {
      const { saveRecord } = await import("./booking");
      for (const c of pendientes) await saveRecord({ ...c, confirmadaPorClienteEn: new Date().toISOString() });
      return { texto: `Perfecto, confirmada: ${describir(pendientes[0])}. Te esperamos.`, via: "recordatorio_confirmado" };
    }
  }

  // --- Está contestando a algo que le preguntamos ---
  if (p?.accion === "confirmar_cancelar") {
    const r = await getRecord(p.recordId);
    if (esSi(o.texto) || /\b(si|sí|cancela(la)?|confirmo)\b/i.test(o.texto) && !esNo(o.texto)) {
      await guardarP(o.tenantId, o.contacto, null);
      if (!r || r.estado === "cancelada") return { texto: "Esa cita ya estaba cancelada.", via: "cancelacion_hecha" };
      return cancelar(o.tenantId, r);
    }
    if (esNo(o.texto) || /\bno\b/i.test(o.texto)) {
      await guardarP(o.tenantId, o.contacto, null);
      return { texto: "Vale, la dejo como esta.", via: "cancelacion_descartada" };
    }
  }
  if (p?.accion === "pedir_hora") {
    const r = await getRecord(p.recordId);
    if (r && r.estado !== "cancelada") {
      const elegido = p.ofrecidos?.length ? eligeOpcion(o.texto, p.ofrecidos) : null;
      const nuevo = elegido || normalizarFecha(o.texto, { fechaBase: r.startIso });
      if (nuevo === PASADO) return mover(o.tenantId, o.contacto, r, `${r.startIso.slice(0, 10)}T00:00:00`);
      if (nuevo && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(nuevo)) return mover(o.tenantId, o.contacto, r, nuevo.slice(0, 19));
      if (esNo(o.texto) || esRechazo(o.texto)) {
        await guardarP(o.tenantId, o.contacto, null);
        return { texto: `Vale, la dejo como esta: ${describir(r)}.`, via: "cambio_descartado" };
      }
    }
  }
  if (p?.accion === "elegir") {
    const citas = (await Promise.all(p.ids.map((id) => getRecord(id)))).filter((x): x is BookingRecord => !!x && x.estado !== "cancelada");
    const n = o.texto.match(/\b([1-9])\b/)?.[1];
    const t = o.texto.toLowerCase();
    const r = n ? citas[Number(n) - 1] : citas.find((c) => t.includes((c.servicioNombre || "").toLowerCase().split(" ")[0]) || t.includes(String(Number(c.startIso.slice(8, 10)))));
    if (r) {
      if (p.para === "cancelar") {
        await guardarP(o.tenantId, o.contacto, { accion: "confirmar_cancelar", recordId: r.id, ts: Date.now() });
        return { texto: `Cancelo ${describir(r)}? Contesta si o no.`, via: "cancelacion_pregunta" };
      }
      if (p.horaNueva) return mover(o.tenantId, o.contacto, r, p.horaNueva);
      await guardarP(o.tenantId, o.contacto, { accion: "pedir_hora", recordId: r.id, ts: Date.now() });
      return { texto: `A que dia y hora te paso ${describir(r)}?`, via: "cambio_pregunta" };
    }
  }

  // --- Pide cancelar o cambiar ---
  if (!esIntencionCancelar(o.texto) && !esIntencionMover(o.texto)) return null;
  const quiereMover = esIntencionMover(o.texto) && !/\bcancel/i.test(o.texto);
  const citas = await citasActivasDeCliente(negocio.slug, o.contacto);
  if (!citas.length) {
    // Un "quiero cambiar de hora" sin cita puede ser alguien reservando: que siga el flujo normal.
    if (quiereMover) return null;
    return { texto: "No veo ninguna cita a tu nombre. Si quieres pedir una, dime que dia y a que hora.", via: "cancelacion_sin_cita" };
  }
  if (citas.length > 1) {
    const lista = citas.map((c, i) => `${i + 1}. ${describir(c)}`).join("\n");
    const horaNueva = quiereMover ? normalizarFecha(o.texto) : "";
    await guardarP(o.tenantId, o.contacto, { accion: "elegir", ids: citas.map((c) => c.id), para: quiereMover ? "mover" : "cancelar", horaNueva: /^\d{4}-/.test(horaNueva) ? horaNueva : undefined, ts: Date.now() });
    return { texto: `Tienes ${citas.length} citas:\n${lista}\nCual quieres ${quiereMover ? "cambiar" : "cancelar"}? Dime el numero.`, via: quiereMover ? "cambio_pregunta" : "cancelacion_pregunta" };
  }
  const r = citas[0];
  if (quiereMover) {
    const nuevo = normalizarFecha(o.texto, { fechaBase: r.startIso });
    if (nuevo === PASADO) return mover(o.tenantId, o.contacto, r, `${r.startIso.slice(0, 10)}T00:00:00`);
    if (nuevo && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(nuevo)) return mover(o.tenantId, o.contacto, r, nuevo.slice(0, 19));
    await guardarP(o.tenantId, o.contacto, { accion: "pedir_hora", recordId: r.id, ts: Date.now() });
    return { texto: `Claro. A que dia y hora te paso ${describir(r)}?`, via: "cambio_pregunta" };
  }
  await guardarP(o.tenantId, o.contacto, { accion: "confirmar_cancelar", recordId: r.id, ts: Date.now() });
  return { texto: `Cancelo tu cita de ${describir(r)}? Contesta si o no.`, via: "cancelacion_pregunta" };
}
