// MEMORIA DE CLIENTA — lo que Pablo y Carmen recuerdan de cada clienta, por
// negocio (y por tanto por tenant) y por teléfono.
//
// Se guarda (en la ficha de la clienta del panel, junto a notas y etiquetas):
//   · nombre con el que quiere que la llamen e idioma;
//   · franja preferida ("por la tarde") y preferencias que ELLA dice
//     ("me gusta el esmalte nude").
// Se calcula de sus citas (no se duplica): últimos servicios con fecha y la
// profesional con la que suele ir → "¿lo de siempre, manicura con Ana?".
//
// RGPD, sin excepciones:
//   · solo datos útiles para el servicio; NUNCA datos de salud, aunque la
//     clienta los cuente (alergias, embarazo, medicación, enfermedades…): la
//     frase entera se descarta, también si la escribe la dueña en el panel;
//   · si pide que la olviden, se borra su memoria (y la conversación guardada)
//     y ya no se usa nada anterior a esa fecha. Sus citas siguen en la agenda
//     del negocio, que las necesita para dar el servicio.
import type { BookingRecord, BusinessBooking, ClienteMeta } from "./booking";

export type Franja = "mañana" | "tarde";
export type Preferencia = { texto: string; desde: string };
export type MemoriaGuardada = {
  nombre?: string;
  idioma?: "es" | "en";
  franja?: Franja;
  preferencias?: Preferencia[];
  /** Pidió que la olvidaran: no se usa nada anterior a esta fecha. */
  olvidadaEn?: string;
  actualizadaEn?: string;
};
export type MemoriaClienta = MemoriaGuardada & {
  ultimos: { servicio: string; fecha: string; profesional?: string }[];
  habitual?: { servicio: string; serviceId?: string; profesional?: string; empleadoId?: string };
};

const MAX_PREFERENCIAS = 12;
const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// -----------------------------------------------------------------------------
// Qué NO se guarda nunca
// -----------------------------------------------------------------------------

const SALUD = new RegExp([
  "alergi", "alergic", "allerg", "embaraz", "pregnan", "lactan", "medicac", "medicament", "medication", "pastilla",
  "enfermedad", "diabet", "cancer", "quimio", "tumor", "epilep", "hipertens", "tension alta", "corazon", "cardi",
  "asma", "tiroid", "hormona", "dermatitis", "psoriasis", "eccema", "atopic", "infecci", "herida", "cicatriz",
  "operacion", "operad", "cirugia", "surgery", "ansiedad", "depresi", "anxiety", "depress", "vih", "hepatitis",
  "anticoagul", "sintrom", "insulina", "marcapasos", "rosacea", "acne", "hongo", "migran", "dolor",
].join("|"));

/** ¿Es un dato de salud? Entonces NO se guarda (ni lo que dice la clienta ni lo que escribe la dueña). */
export function esDatoDeSalud(texto: string): boolean {
  return SALUD.test(sinTildes(texto));
}

// -----------------------------------------------------------------------------
// Lo que ella dice en la conversación
// -----------------------------------------------------------------------------

/** "Olvídame", "borra mis datos", "forget me"… */
export function pideOlvido(texto: string): boolean {
  const t = sinTildes(texto);
  return /\b(olvida(me|d|dme)?|borra(d|me)?|elimina(d|me)?|suprim\w*)\b[^.?!]{0,40}\b(mis datos|lo que sabes|lo que sabeis|de mi|todo sobre mi|mi informacion|mi memoria|mis preferencias)\b/.test(t) ||
    /\bolvidadme\b|\bolvidame\b/.test(t) ||
    /\bno quiero que (me )?(guardeis|guardes|recordeis|recuerdes)\b/.test(t) ||
    /\b(forget me|delete my (data|details|information)|erase my data)\b/.test(t);
}

/**
 * Preferencias que la clienta dice de sí misma: "me gusta el esmalte nude",
 * "prefiero por la tarde", "no me gusta que me corten mucho". Reglas, sin IA:
 * solo frases en primera persona con un verbo de preferencia. Las de salud,
 * fuera.
 */
export function preferenciasDeMensaje(texto: string): { preferencias: string[]; franja?: Franja } {
  const frases = texto.split(/(?<=[.!?\n])\s+|\s*;\s*/).map((f) => f.trim()).filter(Boolean);
  const out: string[] = [];
  let franja: Franja | undefined;
  for (const f of frases) {
    const t = sinTildes(f);
    if (/\bprefier\w*\b[^.]{0,25}\b(por|a) la (tarde|manana)\b|\b(mejor|siempre) (por|a) la (tarde|manana)\b|\bi prefer (the )?(afternoon|morning)/.test(t)) {
      franja = /tarde|afternoon/.test(t) ? "tarde" : "mañana";
      // Si la frase SOLO dice la franja, ya queda en `franja`: no se repite como preferencia.
      if (/^(yo )?(prefiero|mejor|siempre|i prefer)( venir| ir)? (por |a )?(la |the )?(tarde|manana|afternoon|morning)\b[^a-z]*([,.].*)?$/.test(t)) continue;
    }
    if (!/\b(me gusta|me gustan|me encanta|me encantan|prefiero|no me gusta|no me gustan|odio|siempre (me )?(pido|hago|llevo)|i like|i love|i prefer|i don'?t like)\b/.test(t)) continue;
    if (esDatoDeSalud(f)) continue;
    const limpia = f.replace(/^(y|pero|ah|por cierto),?\s+/i, "").replace(/[¡!]+/g, "").replace(/[.\s]+$/, "").trim().slice(0, 140);
    if (limpia.length >= 8) out.push(limpia.charAt(0).toUpperCase() + limpia.slice(1));
  }
  return { preferencias: out, franja };
}

// -----------------------------------------------------------------------------
// Memoria completa (guardada + calculada de sus citas)
// -----------------------------------------------------------------------------

export function componerMemoria(guardada: MemoriaGuardada | undefined, citas: BookingRecord[]): MemoriaClienta {
  const g = guardada || {};
  const desde = g.olvidadaEn || "";
  // Tras "olvídame" solo cuenta lo nuevo.
  const validas = citas
    .filter((r) => r.tipo !== "bloqueo" && r.estado !== "cancelada" && r.estado !== "no_show" && (r.creadaEn || r.startIso) > desde)
    .sort((a, b) => b.startIso.localeCompare(a.startIso));
  const pasadas = validas.filter((r) => r.startIso.slice(0, 10) <= new Date().toISOString().slice(0, 10) || r.estado === "completada");
  const base = pasadas.length ? pasadas : validas;
  const ultimos = base.slice(0, 3).map((r) => ({ servicio: r.servicioNombre, fecha: r.startIso.slice(0, 10), profesional: r.empleadoNombre }));
  // "Lo de siempre": el servicio que más repite (y, a igualdad, el último), con su profesional más habitual.
  let habitual: MemoriaClienta["habitual"];
  if (base.length) {
    const cuenta = new Map<string, { n: number; r: BookingRecord }>();
    for (const r of base) {
      const k = r.serviceId || r.servicioNombre;
      const c = cuenta.get(k);
      if (c) c.n++; else cuenta.set(k, { n: 1, r });
    }
    const top = [...cuenta.values()].sort((a, b) => b.n - a.n)[0].r;
    const conQuien = new Map<string, { n: number; id?: string }>();
    for (const r of base.filter((x) => (x.serviceId || x.servicioNombre) === (top.serviceId || top.servicioNombre) && x.empleadoNombre)) {
      const c = conQuien.get(r.empleadoNombre!);
      if (c) c.n++; else conQuien.set(r.empleadoNombre!, { n: 1, id: r.empleadoId });
    }
    const prof = [...conQuien.entries()].sort((a, b) => b[1].n - a[1].n)[0];
    habitual = { servicio: top.servicioNombre, serviceId: top.serviceId || undefined, profesional: prof?.[0], empleadoId: prof?.[1].id };
  }
  const nombre = g.nombre || (base[0]?.cliente?.nombre && !/^cliente$/i.test(base[0].cliente.nombre) ? base[0].cliente.nombre : undefined);
  return { ...g, nombre, ultimos, habitual };
}

/** Lo que se le dice al modelo (Pablo) sobre esta clienta. Vacío si no hay nada útil. */
export function contextoDeMemoria(m: MemoriaClienta, negocio?: Pick<BusinessBooking, "nombre">): string {
  const lineas: string[] = [];
  const primer = m.nombre?.split(" ")[0];
  if (primer) lineas.push(`Te escribe una clienta conocida de ${negocio?.nombre || "este negocio"}: se llama ${primer}. Salúdala por su nombre.`);
  if (m.ultimos.length) lineas.push(`Sus últimas citas: ${m.ultimos.map((u) => `${u.servicio}${u.profesional ? ` con ${u.profesional}` : ""} (${u.fecha})`).join("; ")}.`);
  if (m.habitual) {
    const siempre = `${m.habitual.servicio.toLowerCase()}${m.habitual.profesional ? ` con ${m.habitual.profesional}` : ""}`;
    lineas.push(`Si quiere cita y no dice qué, proponle lo de siempre con estas palabras: «¿Lo de siempre, ${siempre}?».`);
    if (m.habitual.profesional) lineas.push(`Ofrece primero a ${m.habitual.profesional}, que es con quien suele ir.`);
  }
  if (m.franja) lineas.push(`Prefiere venir por la ${m.franja}: ofrece primero huecos de esa franja.`);
  if (m.preferencias?.length) lineas.push(`Lo que ella ha dicho que le gusta: ${m.preferencias.map((p) => p.texto).join("; ")}.`);
  if (m.idioma === "en") lineas.push("Prefiere que le escriban en inglés.");
  if (!lineas.length) return "";
  lineas.push("Usa esto con naturalidad, sin recitarlo. No le hables de datos que no estén aquí.");
  return lineas.join("\n");
}

// -----------------------------------------------------------------------------
// Acceso a datos (ficha de la clienta en el panel)
// -----------------------------------------------------------------------------

export async function leerMemoria(slug: string, telefono: string): Promise<MemoriaClienta> {
  const B = await import("./booking");
  const key = B.clienteKey({ telefono });
  const meta = await B.getClienteMeta(slug, key);
  const citas = (await B.listRecordsDeNegocio(slug)).filter((r) => B.clienteKey(r.cliente) === key);
  return componerMemoria(meta.memoria, citas);
}

/** Aprende de un mensaje suyo: idioma, franja y preferencias (sin salud). */
export async function aprenderDeMensaje(slug: string, telefono: string, texto: string, idioma?: "es" | "en"): Promise<void> {
  const { preferencias, franja } = preferenciasDeMensaje(texto);
  if (!preferencias.length && !franja && !idioma) return;
  const B = await import("./booking");
  const key = B.clienteKey({ telefono });
  const meta = await B.getClienteMeta(slug, key);
  const g: MemoriaGuardada = { ...(meta.memoria || {}) };
  const ahora = new Date().toISOString();
  let cambio = false;
  if (idioma && g.idioma !== idioma) { g.idioma = idioma; cambio = true; }
  if (franja && g.franja !== franja) { g.franja = franja; cambio = true; }
  const previas = g.preferencias || [];
  for (const p of preferencias) {
    if (previas.some((x) => sinTildes(x.texto) === sinTildes(p))) continue;
    previas.push({ texto: p, desde: ahora });
    cambio = true;
  }
  if (!cambio) return;
  g.preferencias = previas.slice(-MAX_PREFERENCIAS);
  g.actualizadaEn = ahora;
  await B.saveClienteMeta(slug, key, { memoria: g });
}

/**
 * La dueña edita la memoria desde el panel. Lo que sea de salud se rechaza
 * (se devuelve para decírselo); lo demás se guarda tal cual.
 */
export async function editarMemoria(slug: string, key: string, cambios: { nombre?: string; idioma?: "es" | "en" | ""; franja?: Franja | ""; preferencias?: string[] }): Promise<{ rechazadas: string[] }> {
  const B = await import("./booking");
  const meta = await B.getClienteMeta(slug, key);
  const g: MemoriaGuardada = { ...(meta.memoria || {}) };
  const rechazadas: string[] = [];
  if (cambios.nombre !== undefined) g.nombre = cambios.nombre.trim() || undefined;
  if (cambios.idioma !== undefined) g.idioma = cambios.idioma || undefined;
  if (cambios.franja !== undefined) g.franja = cambios.franja || undefined;
  if (cambios.preferencias) {
    const ahora = new Date().toISOString();
    const antes = new Map((g.preferencias || []).map((p) => [p.texto, p.desde]));
    g.preferencias = cambios.preferencias.map((t) => t.trim()).filter(Boolean).filter((t) => {
      if (esDatoDeSalud(t)) { rechazadas.push(t); return false; }
      return true;
    }).slice(0, MAX_PREFERENCIAS).map((texto) => ({ texto, desde: antes.get(texto) || ahora }));
  }
  g.actualizadaEn = new Date().toISOString();
  await B.saveClienteMeta(slug, key, { memoria: g });
  return { rechazadas };
}

/** "Olvídame": se borra la memoria y la conversación guardada. */
export async function olvidarClienta(o: { slug: string; tenantId: string; telefono: string }): Promise<void> {
  const B = await import("./booking");
  const key = B.clienteKey({ telefono: o.telefono });
  const ahora = new Date().toISOString();
  // Solo queda la marca de cuándo pidió el olvido (para no volver a usar lo anterior).
  await B.saveClienteMeta(o.slug, key, { memoria: { olvidadaEn: ahora, actualizadaEn: ahora } });
  try {
    const { resetConversation } = await import("./conversation-store");
    const { aE164 } = await import("./telefono");
    const e164 = aE164(o.telefono);
    // Se borra la conversación con cualquiera de las formas en que pudo guardarse.
    for (const id of new Set([e164, e164.replace(/^\+/, ""), e164.slice(-9)])) await resetConversation("pablo", o.tenantId, id);
  } catch (e) {
    console.error("[memoria] no se pudo borrar la conversación guardada:", e instanceof Error ? e.message : e);
  }
}

export type { ClienteMeta };
